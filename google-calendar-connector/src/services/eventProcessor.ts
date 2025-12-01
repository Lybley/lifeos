/**
 * Event Processor - Create Event nodes and Person relationships
 */

import { CalendarEvent } from './calendarClient';
import { postgresClient, neo4jDriver } from '../config/databases';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

interface ProcessedEvent {
  eventId: string;
  calendarEventId: string;
  title: string;
  description?: string;
  location?: string;
  startTime: Date;
  endTime: Date;
  isAllDay: boolean;
  attendees: string[];
  organizer?: string;
}

/**
 * Map Calendar event to PMG Event schema
 */
function mapCalendarToPMG(event: CalendarEvent): ProcessedEvent {
  const startTime = event.start.dateTime
    ? new Date(event.start.dateTime)
    : new Date(event.start.date!);

  const endTime = event.end.dateTime
    ? new Date(event.end.dateTime)
    : new Date(event.end.date!);

  const isAllDay = !event.start.dateTime;

  const attendees = (event.attendees || [])
    .map((a) => a.email)
    .filter((email) => email);

  const organizer = event.organizer?.email;

  return {
    eventId: `event-${uuidv4()}`,
    calendarEventId: event.id,
    title: event.summary || '(No title)',
    description: event.description,
    location: event.location,
    startTime,
    endTime,
    isAllDay,
    attendees,
    organizer,
  };
}

/**
 * Store event in PostgreSQL
 */
async function storeInPostgres(
  userId: string,
  event: ProcessedEvent
): Promise<void> {
  const nodeQuery = `
    INSERT INTO nodes (
      id, neo4j_id, node_type, user_id, title,
      created_at, updated_at, is_deleted, metadata
    ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), false, $6)
    ON CONFLICT (neo4j_id) DO UPDATE SET
      title = EXCLUDED.title,
      updated_at = NOW(),
      metadata = EXCLUDED.metadata
  `;

  const metadata = {
    calendar_event_id: event.calendarEventId,
    description: event.description,
    location: event.location,
    start_time: event.startTime.toISOString(),
    end_time: event.endTime.toISOString(),
    is_all_day: event.isAllDay,
    attendees: event.attendees,
    organizer: event.organizer,
  };

  await postgresClient.query(nodeQuery, [
    uuidv4(),
    event.eventId,
    'Event',
    userId,
    event.title,
    JSON.stringify(metadata),
  ]);

  logger.info(`Stored event metadata in PostgreSQL: ${event.eventId}`);
}

/**
 * Create or get Person node
 */
async function createOrGetPerson(
  userId: string,
  email: string,
  displayName?: string
): Promise<string> {
  const session = neo4jDriver.session();

  try {
    const personId = `person-${uuidv4()}`;

    // Create or match person by email
    const query = `
      MERGE (p:Person {email: $email})
      ON CREATE SET
        p.id = $personId,
        p.name = $name,
        p.created_at = datetime(),
        p.source = 'google_calendar'
      ON MATCH SET
        p.updated_at = datetime()
      RETURN p.id as id
    `;

    const result = await session.run(query, {
      personId,
      email: email.toLowerCase(),
      name: displayName || email.split('@')[0],
    });

    return result.records[0].get('id');
  } finally {
    await session.close();
  }
}

/**
 * Create Event node in Neo4j with relationships
 */
async function storeInNeo4j(
  userId: string,
  event: ProcessedEvent
): Promise<void> {
  const session = neo4jDriver.session();

  try {
    // Create Event node
    const createEventQuery = `
      MERGE (e:Event {id: $eventId})
      ON CREATE SET
        e.title = $title,
        e.description = $description,
        e.event_type = 'meeting',
        e.location = $location,
        e.start_time = datetime($startTime),
        e.end_time = datetime($endTime),
        e.all_day = $isAllDay,
        e.created_at = datetime(),
        e.platform = 'google_calendar',
        e.metadata = $metadata
      ON MATCH SET
        e.updated_at = datetime()
      RETURN e
    `;

    await session.run(createEventQuery, {
      eventId: event.eventId,
      title: event.title,
      description: event.description || '',
      location: event.location || '',
      startTime: event.startTime.toISOString(),
      endTime: event.endTime.toISOString(),
      isAllDay: event.isAllDay,
      metadata: JSON.stringify({
        calendar_event_id: event.calendarEventId,
        organizer: event.organizer,
      }),
    });

    // Create ownership relationship
    const ownershipQuery = `
      MATCH (u:User {id: $userId})
      MATCH (e:Event {id: $eventId})
      MERGE (u)-[r:OWNS]->(e)
      ON CREATE SET r.created_at = datetime()
    `;

    await session.run(ownershipQuery, {
      userId,
      eventId: event.eventId,
    });

    // Create Person nodes and ATTENDED_BY relationships
    for (const email of event.attendees) {
      const personId = await createOrGetPerson(userId, email);

      const attendeeQuery = `
        MATCH (e:Event {id: $eventId})
        MATCH (p:Person {id: $personId})
        MERGE (e)-[r:ATTENDED_BY]->(p)
        ON CREATE SET
          r.attendance_status = 'accepted',
          r.created_at = datetime()
      `;

      await session.run(attendeeQuery, {
        eventId: event.eventId,
        personId,
      });
    }

    // Create organizer relationship if present
    if (event.organizer) {
      const organizerId = await createOrGetPerson(userId, event.organizer);

      const organizerQuery = `
        MATCH (e:Event {id: $eventId})
        MATCH (p:Person {id: $organizerId})
        MERGE (p)-[r:ORGANIZED]->(e)
        ON CREATE SET r.created_at = datetime()
      `;

      await session.run(organizerQuery, {
        eventId: event.eventId,
        organizerId,
      });
    }

    logger.info(
      `Created Event node with ${event.attendees.length} attendee relationships`
    );
  } finally {
    await session.close();
  }
}

/**
 * Process single event
 */
export async function processEvent(
  userId: string,
  calendarEvent: CalendarEvent
): Promise<void> {
  try {
    const event = mapCalendarToPMG(calendarEvent);

    logger.info(`Processing event: ${event.title} (${event.calendarEventId})`);

    // Store in PostgreSQL
    await storeInPostgres(userId, event);

    // Store in Neo4j with relationships
    await storeInNeo4j(userId, event);

    logger.info(`Successfully processed event: ${event.eventId}`);
  } catch (error) {
    logger.error(
      `Failed to process event ${calendarEvent.id}:`,
      error
    );
    throw error;
  }
}

/**
 * Process events in batch
 */
export async function processBatch(
  userId: string,
  events: CalendarEvent[]
): Promise<{ processed: number; failed: number }> {
  let processed = 0;
  let failed = 0;

  for (const event of events) {
    try {
      await processEvent(userId, event);
      processed++;
    } catch (error) {
      logger.error(`Failed to process event:`, error);
      failed++;
    }
  }

  return { processed, failed };
}

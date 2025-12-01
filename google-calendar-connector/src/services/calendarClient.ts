/**
 * Google Calendar API Client
 */

import { google, calendar_v3 } from 'googleapis';
import { getAuthenticatedClient } from './tokenManager';
import logger from '../utils/logger';

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
    organizer?: boolean;
  }>;
  organizer?: { email: string; displayName?: string; self?: boolean };
  creator?: { email: string; displayName?: string };
  recurrence?: string[];
  recurringEventId?: string;
  htmlLink?: string;
  status?: string;
  created: string;
  updated: string;
}

export class CalendarClient {
  private calendar: calendar_v3.Calendar | null = null;
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  private async getCalendarClient(): Promise<calendar_v3.Calendar> {
    if (!this.calendar) {
      const auth = await getAuthenticatedClient(this.userId);
      this.calendar = google.calendar({ version: 'v3', auth });
    }
    return this.calendar;
  }

  /**
   * List all calendars
   */
  async listCalendars(): Promise<calendar_v3.Schema$CalendarListEntry[]> {
    const calendar = await this.getCalendarClient();

    const response = await calendar.calendarList.list();

    return response.data.items || [];
  }

  /**
   * List events in date range
   */
  async listEvents(
    calendarId: string = 'primary',
    timeMin: Date,
    timeMax: Date,
    pageToken?: string
  ): Promise<{ events: CalendarEvent[]; nextPageToken?: string }> {
    const calendar = await this.getCalendarClient();

    const response = await calendar.events.list({
      calendarId,
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      maxResults: 250,
      singleEvents: true,
      orderBy: 'startTime',
      pageToken,
    });

    return {
      events: (response.data.items || []) as CalendarEvent[],
      nextPageToken: response.data.nextPageToken || undefined,
    };
  }

  /**
   * Get all events in date range (with pagination)
   */
  async getAllEvents(
    calendarId: string = 'primary',
    timeMin: Date,
    timeMax: Date
  ): Promise<CalendarEvent[]> {
    const allEvents: CalendarEvent[] = [];
    let pageToken: string | undefined;

    do {
      const response = await this.listEvents(
        calendarId,
        timeMin,
        timeMax,
        pageToken
      );

      allEvents.push(...response.events);
      pageToken = response.nextPageToken;

      logger.info(
        `Fetched ${allEvents.length} events from ${calendarId} (pageToken: ${pageToken ? 'has more' : 'done'})`
      );
    } while (pageToken);

    return allEvents;
  }

  /**
   * Get event details
   */
  async getEvent(
    eventId: string,
    calendarId: string = 'primary'
  ): Promise<CalendarEvent> {
    const calendar = await this.getCalendarClient();

    const response = await calendar.events.get({
      calendarId,
      eventId,
    });

    return response.data as CalendarEvent;
  }
}

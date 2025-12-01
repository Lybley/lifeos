/**
 * Action Handlers - Execute specific action types
 */

import {
  CreateCalendarEventPayload,
  SendEmailPayload,
  MoveFilePayload,
  CreateDocumentPayload,
  CalendarEventRollback,
  EmailRollback,
  MoveFileRollback,
  CreateDocumentRollback,
} from './types';
import logger from '../../utils/logger';

// ============================================================================
// BASE ACTION HANDLER
// ============================================================================

export interface ActionExecutionResult {
  success: boolean;
  result?: any;
  rollback_data?: any;
  error?: string;
}

export interface ActionHandler {
  execute(payload: any): Promise<ActionExecutionResult>;
  rollback(rollbackData: any): Promise<boolean>;
  validate(payload: any): { valid: boolean; error?: string };
}

// ============================================================================
// CREATE CALENDAR EVENT HANDLER
// ============================================================================

export class CreateCalendarEventHandler implements ActionHandler {
  validate(payload: CreateCalendarEventPayload): { valid: boolean; error?: string } {
    if (!payload.title || payload.title.trim().length === 0) {
      return { valid: false, error: 'Title is required' };
    }

    if (!payload.start_time || !payload.end_time) {
      return { valid: false, error: 'Start and end times are required' };
    }

    const startDate = new Date(payload.start_time);
    const endDate = new Date(payload.end_time);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return { valid: false, error: 'Invalid date format' };
    }

    if (startDate >= endDate) {
      return { valid: false, error: 'End time must be after start time' };
    }

    return { valid: true };
  }

  async execute(payload: CreateCalendarEventPayload): Promise<ActionExecutionResult> {
    try {
      logger.info('Creating calendar event:', payload.title);

      // TODO: Integrate with actual calendar service (Google Calendar, etc.)
      // For now, simulate the creation
      const eventId = `event_${Date.now()}`;
      const calendarId = payload.calendar_id || 'primary';

      // Simulate API call
      await this.simulateApiCall();

      const rollbackData: CalendarEventRollback = {
        event_id: eventId,
        calendar_id: calendarId,
      };

      logger.info(`Calendar event created: ${eventId}`);

      return {
        success: true,
        result: {
          event_id: eventId,
          calendar_id: calendarId,
          title: payload.title,
          start_time: payload.start_time,
          end_time: payload.end_time,
        },
        rollback_data: rollbackData,
      };
    } catch (error) {
      logger.error('Failed to create calendar event:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async rollback(rollbackData: CalendarEventRollback): Promise<boolean> {
    try {
      logger.info(`Rolling back calendar event: ${rollbackData.event_id}`);

      // TODO: Delete the calendar event via API
      await this.simulateApiCall();

      logger.info(`Calendar event deleted: ${rollbackData.event_id}`);
      return true;
    } catch (error) {
      logger.error('Failed to rollback calendar event:', error);
      return false;
    }
  }

  private async simulateApiCall(): Promise<void> {
    // Simulate API latency
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

// ============================================================================
// SEND EMAIL HANDLER
// ============================================================================

export class SendEmailHandler implements ActionHandler {
  validate(payload: SendEmailPayload): { valid: boolean; error?: string } {
    if (!payload.to || payload.to.length === 0) {
      return { valid: false, error: 'At least one recipient is required' };
    }

    if (!payload.subject || payload.subject.trim().length === 0) {
      return { valid: false, error: 'Subject is required' };
    }

    if (!payload.body || payload.body.trim().length === 0) {
      return { valid: false, error: 'Body is required' };
    }

    // Validate email addresses
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const allEmails = [...payload.to, ...(payload.cc || []), ...(payload.bcc || [])];
    const invalidEmails = allEmails.filter((email) => !emailRegex.test(email));

    if (invalidEmails.length > 0) {
      return { valid: false, error: `Invalid email addresses: ${invalidEmails.join(', ')}` };
    }

    return { valid: true };
  }

  async execute(payload: SendEmailPayload): Promise<ActionExecutionResult> {
    try {
      logger.info(`Sending email to ${payload.to.length} recipients`);

      // TODO: Integrate with actual email service (SendGrid, AWS SES, etc.)
      // For now, simulate sending
      const messageId = `msg_${Date.now()}`;

      await this.simulateApiCall();

      const rollbackData: EmailRollback = {
        message_id: messageId,
        sent_to: payload.to,
      };

      logger.info(`Email sent: ${messageId}`);

      return {
        success: true,
        result: {
          message_id: messageId,
          sent_to: payload.to,
          sent_at: new Date().toISOString(),
        },
        rollback_data: rollbackData,
      };
    } catch (error) {
      logger.error('Failed to send email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async rollback(rollbackData: EmailRollback): Promise<boolean> {
    // NOTE: Emails cannot be truly rolled back once sent
    // We can only log the rollback attempt for audit purposes
    logger.warn(
      `Email rollback requested for ${rollbackData.message_id}, but emails cannot be unsent`
    );
    logger.info('Logging rollback attempt for audit trail');
    
    // In a real system, you might:
    // 1. Send a follow-up email explaining the previous was an error
    // 2. Mark the message in your system as "recalled"
    // 3. Notify recipients if possible
    
    return true; // Return true since we've logged it
  }

  private async simulateApiCall(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

// ============================================================================
// MOVE FILE HANDLER
// ============================================================================

export class MoveFileHandler implements ActionHandler {
  validate(payload: MoveFilePayload): { valid: boolean; error?: string } {
    if (!payload.source_path || payload.source_path.trim().length === 0) {
      return { valid: false, error: 'Source path is required' };
    }

    if (!payload.destination_path || payload.destination_path.trim().length === 0) {
      return { valid: false, error: 'Destination path is required' };
    }

    if (payload.source_path === payload.destination_path) {
      return { valid: false, error: 'Source and destination cannot be the same' };
    }

    return { valid: true };
  }

  async execute(payload: MoveFilePayload): Promise<ActionExecutionResult> {
    try {
      logger.info(`Moving file from ${payload.source_path} to ${payload.destination_path}`);

      // TODO: Integrate with actual file system or cloud storage
      // For now, simulate the move
      const backupPath = payload.create_backup
        ? `${payload.source_path}.backup_${Date.now()}`
        : undefined;

      await this.simulateApiCall();

      const rollbackData: MoveFileRollback = {
        original_path: payload.source_path,
        current_path: payload.destination_path,
        backup_path: backupPath,
      };

      logger.info('File moved successfully');

      return {
        success: true,
        result: {
          source: payload.source_path,
          destination: payload.destination_path,
          backup: backupPath,
          moved_at: new Date().toISOString(),
        },
        rollback_data: rollbackData,
      };
    } catch (error) {
      logger.error('Failed to move file:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async rollback(rollbackData: MoveFileRollback): Promise<boolean> {
    try {
      logger.info(
        `Rolling back file move: ${rollbackData.current_path} -> ${rollbackData.original_path}`
      );

      // Move file back to original location
      await this.simulateApiCall();

      logger.info('File moved back to original location');
      return true;
    } catch (error) {
      logger.error('Failed to rollback file move:', error);
      return false;
    }
  }

  private async simulateApiCall(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

// ============================================================================
// CREATE DOCUMENT HANDLER
// ============================================================================

export class CreateDocumentHandler implements ActionHandler {
  validate(payload: CreateDocumentPayload): { valid: boolean; error?: string } {
    if (!payload.title || payload.title.trim().length === 0) {
      return { valid: false, error: 'Title is required' };
    }

    if (!payload.content || payload.content.trim().length === 0) {
      return { valid: false, error: 'Content is required' };
    }

    const validFormats = ['text', 'markdown', 'html'];
    if (payload.format && !validFormats.includes(payload.format)) {
      return {
        valid: false,
        error: `Invalid format. Must be one of: ${validFormats.join(', ')}`,
      };
    }

    return { valid: true };
  }

  async execute(payload: CreateDocumentPayload): Promise<ActionExecutionResult> {
    try {
      logger.info(`Creating document: ${payload.title}`);

      // TODO: Integrate with actual document storage system
      const documentId = `doc_${Date.now()}`;
      const storageLocation = `/documents/${payload.folder || 'default'}/${documentId}`;

      await this.simulateApiCall();

      const rollbackData: CreateDocumentRollback = {
        document_id: documentId,
        storage_location: storageLocation,
      };

      logger.info(`Document created: ${documentId}`);

      return {
        success: true,
        result: {
          document_id: documentId,
          title: payload.title,
          storage_location: storageLocation,
          format: payload.format || 'text',
          created_at: new Date().toISOString(),
        },
        rollback_data: rollbackData,
      };
    } catch (error) {
      logger.error('Failed to create document:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async rollback(rollbackData: CreateDocumentRollback): Promise<boolean> {
    try {
      logger.info(`Rolling back document creation: ${rollbackData.document_id}`);

      // Delete the document
      await this.simulateApiCall();

      logger.info(`Document deleted: ${rollbackData.document_id}`);
      return true;
    } catch (error) {
      logger.error('Failed to rollback document creation:', error);
      return false;
    }
  }

  private async simulateApiCall(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

// ============================================================================
// HANDLER REGISTRY
// ============================================================================

export const actionHandlers: Record<string, ActionHandler> = {
  create_calendar_event: new CreateCalendarEventHandler(),
  send_email: new SendEmailHandler(),
  move_file: new MoveFileHandler(),
  create_document: new CreateDocumentHandler(),
};

export function getActionHandler(actionType: string): ActionHandler | null {
  return actionHandlers[actionType] || null;
}

/**
 * Action Engine Types
 */

export type ActionType = 
  | 'create_calendar_event'
  | 'send_email'
  | 'move_file'
  | 'create_document'
  | 'make_payment'
  | 'make_purchase';

export type ActionStatus = 
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'rolled_back';

export type SafetyRuleType = 
  | 'blocked'
  | 'requires_approval'
  | 'requires_kyc'
  | 'rate_limit';

export interface Action {
  id: string;
  user_id: string;
  action_type: ActionType;
  status: ActionStatus;
  priority: number;
  payload: any;
  requires_approval: boolean;
  approval_token?: string;
  approval_expires_at?: Date;
  scheduled_for?: Date;
  rollback_data?: any;
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// ACTION PAYLOADS
// ============================================================================

export interface CreateCalendarEventPayload {
  title: string;
  description?: string;
  start_time: string; // ISO 8601
  end_time: string;
  attendees?: string[];
  location?: string;
  calendar_id?: string;
}

export interface SendEmailPayload {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: string; // base64
    contentType: string;
  }>;
}

export interface MoveFilePayload {
  source_path: string;
  destination_path: string;
  create_backup?: boolean;
}

export interface CreateDocumentPayload {
  title: string;
  content: string;
  format?: 'text' | 'markdown' | 'html';
  folder?: string;
  tags?: string[];
}

// ============================================================================
// ROLLBACK DATA
// ============================================================================

export interface CalendarEventRollback {
  event_id: string;
  calendar_id: string;
}

export interface EmailRollback {
  message_id: string;
  sent_to: string[];
  // Note: Emails can't truly be rolled back, but we can log for reference
}

export interface MoveFileRollback {
  original_path: string;
  current_path: string;
  backup_path?: string;
}

export interface CreateDocumentRollback {
  document_id: string;
  storage_location: string;
}

// ============================================================================
// SAFETY RULES
// ============================================================================

export interface SafetyRule {
  id: string;
  action_type: ActionType;
  rule_name: string;
  rule_type: SafetyRuleType;
  rule_config: any;
  enabled: boolean;
}

export interface RateLimitConfig {
  limit: number;
  window: string; // e.g., '1 hour', '1 day'
}

export interface SafetyCheckResult {
  allowed: boolean;
  requires_approval: boolean;
  requires_kyc: boolean;
  blocked: boolean;
  reason?: string;
  rate_limit_exceeded?: boolean;
}

// ============================================================================
// AUDIT LOG
// ============================================================================

export type AuditEventType = 
  | 'created'
  | 'approved'
  | 'rejected'
  | 'started'
  | 'completed'
  | 'failed'
  | 'rolled_back'
  | 'retried';

export interface AuditLog {
  id: string;
  action_id: string;
  user_id: string;
  event_type: AuditEventType;
  event_data?: any;
  ip_address?: string;
  user_agent?: string;
  source: 'api' | 'webhook' | 'email_link' | 'ui';
  created_at: Date;
}

// ============================================================================
// APPROVAL
// ============================================================================

export interface ApprovalRequest {
  action_id: string;
  action_type: ActionType;
  payload: any;
  approval_token: string;
  expires_at: Date;
  approval_url: string;
}

export interface ApprovalDecision {
  action_id: string;
  approved: boolean;
  reason?: string;
  approved_by: string;
  source: 'api' | 'webhook' | 'email_link' | 'ui';
  ip_address?: string;
  user_agent?: string;
}

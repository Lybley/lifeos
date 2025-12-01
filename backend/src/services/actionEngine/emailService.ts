/**
 * Email Service - Send approval emails
 */

import logger from '../../utils/logger';
import { ActionType } from './types';

// Get base URL from environment
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

/**
 * Send approval email to user
 */
export async function sendApprovalEmail(
  userId: string,
  actionId: string,
  actionType: ActionType,
  payload: any,
  approvalToken: string
): Promise<void> {
  logger.info(`Sending approval email for action ${actionId}`);

  // Construct approval and rejection URLs
  const approveUrl = `${BASE_URL}/api/actions/approve?token=${approvalToken}`;
  const rejectUrl = `${BASE_URL}/api/actions/reject?token=${approvalToken}`;

  // Format action details
  const actionDetails = formatActionDetails(actionType, payload);

  // Email content
  const subject = `Action Approval Required: ${formatActionType(actionType)}`;
  const body = `
Dear User,

An action requires your approval:

Action Type: ${formatActionType(actionType)}
Action ID: ${actionId}

${actionDetails}

To approve this action, click here:
${approveUrl}

To reject this action, click here:
${rejectUrl}

This approval link will expire in 24 hours.

Best regards,
LifeOS Team
  `.trim();

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      text-align: center;
      border-radius: 8px 8px 0 0;
    }
    .content {
      background: #f9fafb;
      padding: 30px;
      border: 1px solid #e5e7eb;
    }
    .action-details {
      background: white;
      padding: 20px;
      margin: 20px 0;
      border-left: 4px solid #667eea;
      border-radius: 4px;
    }
    .action-details h3 {
      margin-top: 0;
      color: #667eea;
    }
    .buttons {
      text-align: center;
      margin: 30px 0;
    }
    .button {
      display: inline-block;
      padding: 12px 30px;
      margin: 0 10px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: bold;
      font-size: 16px;
    }
    .approve {
      background: #10b981;
      color: white;
    }
    .approve:hover {
      background: #059669;
    }
    .reject {
      background: #ef4444;
      color: white;
    }
    .reject:hover {
      background: #dc2626;
    }
    .footer {
      background: #f3f4f6;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #6b7280;
      border-radius: 0 0 8px 8px;
    }
    .warning {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🔔 Action Approval Required</h1>
  </div>
  
  <div class="content">
    <p>Dear User,</p>
    
    <p>An AI-generated action requires your approval before execution:</p>
    
    <div class="action-details">
      <h3>${formatActionType(actionType)}</h3>
      <p><strong>Action ID:</strong> ${actionId}</p>
      ${actionDetails}
    </div>
    
    <div class="warning">
      <strong>⚠️ Important:</strong> Please review the action details carefully before approving.
    </div>
    
    <div class="buttons">
      <a href="${approveUrl}" class="button approve">✓ Approve Action</a>
      <a href="${rejectUrl}" class="button reject">✗ Reject Action</a>
    </div>
    
    <p style="font-size: 14px; color: #6b7280; text-align: center;">
      This approval link will expire in <strong>24 hours</strong>
    </p>
  </div>
  
  <div class="footer">
    <p>This is an automated message from LifeOS Action Engine</p>
    <p>If you did not request this action, please reject it immediately</p>
  </div>
</body>
</html>
  `.trim();

  // TODO: Integrate with actual email service (SendGrid, AWS SES, etc.)
  // For now, just log the email content
  logger.info('='.repeat(80));
  logger.info('EMAIL TO SEND:');
  logger.info(`To: ${userId}`);
  logger.info(`Subject: ${subject}`);
  logger.info('-'.repeat(80));
  logger.info(body);
  logger.info('='.repeat(80));

  // In production, you would call an email service here:
  // await emailClient.send({
  //   to: userEmail,
  //   subject,
  //   text: body,
  //   html: htmlBody,
  // });
}

/**
 * Format action type for display
 */
function formatActionType(actionType: ActionType): string {
  const formatted: Record<ActionType, string> = {
    create_calendar_event: 'Create Calendar Event',
    send_email: 'Send Email',
    move_file: 'Move File',
    create_document: 'Create Document',
    make_payment: 'Make Payment',
    make_purchase: 'Make Purchase',
  };

  return formatted[actionType] || actionType;
}

/**
 * Format action payload for email display
 */
function formatActionDetails(actionType: ActionType, payload: any): string {
  switch (actionType) {
    case 'create_calendar_event':
      return `
<strong>Event Details:</strong>
<ul>
  <li>Title: ${payload.title}</li>
  <li>Start: ${new Date(payload.start_time).toLocaleString()}</li>
  <li>End: ${new Date(payload.end_time).toLocaleString()}</li>
  ${payload.description ? `<li>Description: ${payload.description}</li>` : ''}
  ${payload.location ? `<li>Location: ${payload.location}</li>` : ''}
  ${payload.attendees ? `<li>Attendees: ${payload.attendees.join(', ')}</li>` : ''}
</ul>
      `.trim();

    case 'send_email':
      return `
<strong>Email Details:</strong>
<ul>
  <li>To: ${payload.to.join(', ')}</li>
  <li>Subject: ${payload.subject}</li>
  <li>Body Preview: ${payload.body.substring(0, 100)}...</li>
  ${payload.cc ? `<li>CC: ${payload.cc.join(', ')}</li>` : ''}
  ${payload.attachments ? `<li>Attachments: ${payload.attachments.length} file(s)</li>` : ''}
</ul>
      `.trim();

    case 'move_file':
      return `
<strong>File Move Details:</strong>
<ul>
  <li>From: ${payload.source_path}</li>
  <li>To: ${payload.destination_path}</li>
  <li>Create Backup: ${payload.create_backup ? 'Yes' : 'No'}</li>
</ul>
      `.trim();

    case 'create_document':
      return `
<strong>Document Details:</strong>
<ul>
  <li>Title: ${payload.title}</li>
  <li>Format: ${payload.format || 'text'}</li>
  <li>Content Preview: ${payload.content.substring(0, 100)}...</li>
  ${payload.folder ? `<li>Folder: ${payload.folder}</li>` : ''}
  ${payload.tags ? `<li>Tags: ${payload.tags.join(', ')}</li>` : ''}
</ul>
      `.trim();

    default:
      return `<pre>${JSON.stringify(payload, null, 2)}</pre>`;
  }
}

/**
 * Permission & Consent System Types
 */

// Permission scopes
export enum PermissionScope {
  EMAILS_FULL = 'emails.full',
  EMAILS_METADATA = 'emails.metadata',
  FILES_FULL = 'files.full',
  FILES_METADATA = 'files.metadata',
  CALENDAR_READ = 'calendar.read',
  CALENDAR_WRITE = 'calendar.write',
  MESSAGES_READ = 'messages.read',
  CONTACTS_READ = 'contacts.read',
  HEALTH_READ = 'health.read',
  PURCHASES_READ = 'purchases.read',
  PURCHASES_WRITE = 'purchases.write'
}

// Permission status
export enum PermissionStatus {
  ACTIVE = 'active',
  REVOKED = 'revoked',
  EXPIRED = 'expired',
  PENDING = 'pending'
}

// Consent version
export enum ConsentVersion {
  V1 = 'v1',
  V2 = 'v2'
}

// Risk levels
export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Permission interface
export interface Permission {
  id: string;
  userId: string;
  scope: PermissionScope;
  status: PermissionStatus;
  grantedAt: Date;
  revokedAt?: Date;
  expiresAt?: Date;
  lastUsedAt?: Date;
  grantedBy?: string;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  consentVersion: ConsentVersion;
  scopeHash: string;
}

// Scope definition
export interface ScopeDefinition {
  scope: PermissionScope;
  name: string;
  description: string;
  category: string;
  riskLevel: RiskLevel;
  defaultEnabled: boolean;
  requiresExplicitConsent: boolean;
  version: ConsentVersion;
  scopeHash: string;
}

// Consent audit log
export interface ConsentAuditLog {
  id: string;
  userId: string;
  permissionId?: string;
  action: string;
  scope?: PermissionScope;
  previousStatus?: PermissionStatus;
  newStatus?: PermissionStatus;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  reason?: string;
  metadata?: Record<string, any>;
}

// Permission check result
export interface PermissionCheckResult {
  allowed: boolean;
  scope: PermissionScope;
  reason?: string;
  permission?: Permission;
}

// Bulk permission grant
export interface BulkPermissionGrant {
  scopes: PermissionScope[];
  expiresAt?: Date;
  reason?: string;
}

// Permission summary
export interface PermissionSummary {
  userId: string;
  category: string;
  totalPermissions: number;
  activePermissions: number;
  revokedPermissions: number;
  criticalPermissions: number;
}

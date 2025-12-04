/**
 * Event Types and Interfaces for Real-Time Event Stream
 */

// Event types that can be published
export enum EventType {
  SYNC_UPDATE = 'SYNC_UPDATE',
  TASK_CREATED = 'TASK_CREATED',
  ACTION_STATUS = 'ACTION_STATUS',
  ALERT = 'ALERT',
  PREDICTION_RISK = 'PREDICTION_RISK',
  AGENT_PROGRESS = 'AGENT_PROGRESS',
  
  // System events
  CONNECTION_ESTABLISHED = 'CONNECTION_ESTABLISHED',
  HEARTBEAT = 'HEARTBEAT',
  ERROR = 'ERROR'
}

// Base event interface
export interface BaseEvent {
  id: string;
  type: EventType;
  timestamp: number;
  userId: string;
}

// Specific event payloads
export interface SyncUpdateEvent extends BaseEvent {
  type: EventType.SYNC_UPDATE;
  data: {
    source: 'gmail' | 'drive' | 'calendar';
    status: 'started' | 'progress' | 'completed' | 'failed';
    itemsProcessed?: number;
    totalItems?: number;
    error?: string;
  };
}

export interface TaskCreatedEvent extends BaseEvent {
  type: EventType.TASK_CREATED;
  data: {
    taskId: string;
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high';
    dueDate?: string;
  };
}

export interface ActionStatusEvent extends BaseEvent {
  type: EventType.ACTION_STATUS;
  data: {
    actionId: string;
    actionType: string;
    status: 'pending' | 'approved' | 'executing' | 'completed' | 'failed' | 'rejected';
    result?: any;
    error?: string;
  };
}

export interface AlertEvent extends BaseEvent {
  type: EventType.ALERT;
  data: {
    severity: 'info' | 'warning' | 'error' | 'critical';
    title: string;
    message: string;
    action?: {
      label: string;
      url: string;
    };
  };
}

export interface PredictionRiskEvent extends BaseEvent {
  type: EventType.PREDICTION_RISK;
  data: {
    riskType: string;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    confidence: number;
    recommendations?: string[];
  };
}

export interface AgentProgressEvent extends BaseEvent {
  type: EventType.AGENT_PROGRESS;
  data: {
    agentId: string;
    agentName: string;
    step: string;
    progress: number; // 0-100
    status: 'running' | 'paused' | 'completed' | 'failed';
    message?: string;
  };
}

// Union type for all events
export type Event =
  | SyncUpdateEvent
  | TaskCreatedEvent
  | ActionStatusEvent
  | AlertEvent
  | PredictionRiskEvent
  | AgentProgressEvent;

// Client subscription message
export interface SubscriptionMessage {
  action: 'subscribe' | 'unsubscribe' | 'ping';
  channels?: string[];
}

// Server message to client
export interface ServerMessage {
  type: 'event' | 'error' | 'pong' | 'subscribed' | 'unsubscribed';
  data?: any;
  error?: string;
}

// Connection metadata
export interface ConnectionMetadata {
  userId: string;
  connectionId: string;
  connectedAt: number;
  channels: Set<string>;
  transport: 'websocket' | 'sse';
}

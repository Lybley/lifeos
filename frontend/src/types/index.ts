// Core Types for LifeOS

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  preferences: UserPreferences;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  notifications: boolean;
  language: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: string;
  estimatedDuration?: number;
  tags: string[];
  category: string;
  createdAt: string;
  updatedAt: string;
}

export interface Memory {
  id: string;
  type: 'episodic' | 'semantic' | 'procedural';
  content: string;
  timestamp: string;
  importance: number;
  tags: string[];
  connections: string[];
  embedding?: number[];
}

export interface Person {
  id: string;
  name: string;
  relationship: string;
  lastContact?: string;
  relationshipScore: number;
  sentimentScore: number;
  notes?: string;
  tags: string[];
}

export interface HealthMetric {
  id: string;
  type: 'sleep' | 'exercise' | 'nutrition' | 'mood' | 'stress';
  value: number;
  unit: string;
  timestamp: string;
  notes?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  citations?: Citation[];
  metadata?: Record<string, any>;
}

export interface Citation {
  id: string;
  source: string;
  title: string;
  url?: string;
  excerpt: string;
  relevance: number;
}

export interface Connection {
  id: string;
  provider: 'google' | 'github' | 'slack' | 'notion' | 'calendar';
  status: 'connected' | 'disconnected' | 'error';
  scopes: string[];
  lastSync?: string;
  email?: string;
}

export interface PlanDay {
  date: string;
  tasks: Task[];
  events: ScheduledEvent[];
  energyLevel?: number;
  focus: string[];
}

export interface ScheduledEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  type: 'meeting' | 'task' | 'break' | 'focus';
  attendees?: string[];
}

export interface DashboardWidget {
  id: string;
  type: string;
  title: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  visible: boolean;
}

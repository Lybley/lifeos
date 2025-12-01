import { io, Socket } from 'socket.io-client';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:8000';

export interface AgentProgress {
  id: string;
  type: 'rag' | 'task_extract' | 'summarize' | 'draft';
  status: 'started' | 'processing' | 'completed' | 'error';
  progress: number;
  message: string;
  result?: any;
  error?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations?: Citation[];
  timestamp: Date;
  metadata?: any;
}

export interface Citation {
  id: string;
  title: string;
  source: string;
  snippet: string;
  url?: string;
  confidence?: number;
}

class WebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect(userId: string): Socket {
    if (this.socket && this.socket.connected) {
      return this.socket;
    }

    this.socket = io(WS_URL, {
      auth: {
        userId,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
      }
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Subscribe to agent progress updates
  onAgentProgress(callback: (progress: AgentProgress) => void) {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }
    this.socket.on('agent:progress', callback);
  }

  // Subscribe to chat messages
  onChatMessage(callback: (message: ChatMessage) => void) {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }
    this.socket.on('chat:message', callback);
  }

  // Subscribe to action updates
  onActionUpdate(callback: (action: any) => void) {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }
    this.socket.on('action:update', callback);
  }

  // Subscribe to ingestion progress
  onIngestionProgress(callback: (progress: any) => void) {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }
    this.socket.on('ingestion:progress', callback);
  }

  // Send a chat message
  sendChatMessage(message: string, conversationId?: string) {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }
    this.socket.emit('chat:send', { message, conversationId });
  }

  // Join a conversation room
  joinConversation(conversationId: string) {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }
    this.socket.emit('conversation:join', { conversationId });
  }

  // Leave a conversation room
  leaveConversation(conversationId: string) {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }
    this.socket.emit('conversation:leave', { conversationId });
  }

  // Remove event listener
  off(event: string, callback?: any) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  // Check if connected
  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const wsService = new WebSocketService();
export default wsService;

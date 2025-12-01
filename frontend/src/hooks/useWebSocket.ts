'use client';

import { useEffect, useState, useCallback } from 'react';
import { wsService } from '@/lib/websocket';

interface UseWebSocketOptions {
  userId?: string;
  autoConnect?: boolean;
}

interface WebSocketHook {
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  sendMessage: (event: string, data: any) => void;
  on: (event: string, callback: (data: any) => void) => void;
  off: (event: string, callback?: (data: any) => void) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}): WebSocketHook {
  const { userId = 'demo-user', autoConnect = true } = options;
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback(() => {
    try {
      wsService.connect(userId);
      setIsConnected(true);
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      setIsConnected(false);
    }
  }, [userId]);

  const disconnect = useCallback(() => {
    wsService.disconnect();
    setIsConnected(false);
  }, []);

  const sendMessage = useCallback((event: string, data: any) => {
    if (!wsService.isConnected()) {
      console.warn('WebSocket not connected, attempting to connect...');
      connect();
    }
    // Send via socket if available
    const socket = (wsService as any).socket;
    if (socket) {
      socket.emit(event, data);
    }
  }, [connect]);

  const on = useCallback((event: string, callback: (data: any) => void) => {
    const socket = (wsService as any).socket;
    if (socket) {
      socket.on(event, callback);
    }
  }, []);

  const off = useCallback((event: string, callback?: (data: any) => void) => {
    wsService.off(event, callback);
  }, []);

  useEffect(() => {
    if (autoConnect && userId) {
      connect();
    }

    return () => {
      if (autoConnect) {
        disconnect();
      }
    };
  }, [userId, autoConnect, connect, disconnect]);

  return {
    isConnected,
    connect,
    disconnect,
    sendMessage,
    on,
    off,
  };
}

/**
 * Hook specifically for chat real-time updates
 */
export function useChatWebSocket(userId?: string) {
  const ws = useWebSocket({ userId, autoConnect: true });
  const [messages, setMessages] = useState<any[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    // Listen for incoming messages
    ws.on('chat:message', (message) => {
      setMessages((prev) => [...prev, message]);
    });

    // Listen for chat response chunks (streaming)
    ws.on('chat:response', (data) => {
      if (data.isComplete) {
        setIsTyping(false);
      } else {
        setIsTyping(true);
      }
    });

    // Listen for typing indicators
    ws.on('chat:typing', (data) => {
      setIsTyping(data.isTyping);
    });

    return () => {
      ws.off('chat:message');
      ws.off('chat:response');
      ws.off('chat:typing');
    };
  }, [ws]);

  const sendMessage = useCallback((content: string) => {
    ws.sendMessage('chat:message', { content });
  }, [ws]);

  return {
    ...ws,
    messages,
    isTyping,
    sendMessage,
  };
}

/**
 * Hook for action status updates
 */
export function useActionWebSocket(userId?: string) {
  const ws = useWebSocket({ userId, autoConnect: true });
  const [actionUpdates, setActionUpdates] = useState<any[]>([]);

  useEffect(() => {
    ws.on('action:update', (update) => {
      setActionUpdates((prev) => [...prev, update]);
    });

    return () => {
      ws.off('action:update');
    };
  }, [ws]);

  const subscribeToAction = useCallback((actionId: string) => {
    ws.sendMessage('action:subscribe', actionId);
  }, [ws]);

  const unsubscribeFromAction = useCallback((actionId: string) => {
    ws.sendMessage('action:unsubscribe', actionId);
  }, [ws]);

  return {
    ...ws,
    actionUpdates,
    subscribeToAction,
    unsubscribeFromAction,
  };
}

/**
 * Hook for sync progress updates
 */
export function useSyncWebSocket(userId?: string) {
  const ws = useWebSocket({ userId, autoConnect: true });
  const [syncProgress, setSyncProgress] = useState<any>(null);

  useEffect(() => {
    ws.on('sync:progress', (progress) => {
      setSyncProgress(progress);
    });

    return () => {
      ws.off('sync:progress');
    };
  }, [ws]);

  return {
    ...ws,
    syncProgress,
  };
}

/**
 * LifeOS Event Client
 * 
 * WebSocket client with automatic fallback to SSE and reconnection strategy
 */

class EventClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || window.location.origin;
    this.token = options.token;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 10;
    this.reconnectDelay = options.reconnectDelay || 1000;
    this.maxReconnectDelay = options.maxReconnectDelay || 30000;
    this.heartbeatInterval = options.heartbeatInterval || 30000;
    this.useWebSocket = options.useWebSocket !== false;
    this.eventHandlers = new Map();
    this.connection = null;
    this.heartbeatTimer = null;
    this.reconnectTimer = null;
    this.connected = false;
    
    // Bind methods
    this.connect = this.connect.bind(this);
    this.disconnect = this.disconnect.bind(this);
    this.on = this.on.bind(this);
    this.off = this.off.bind(this);
    this.subscribe = this.subscribe.bind(this);
    this.unsubscribe = this.unsubscribe.bind(this);
  }
  
  /**
   * Connect to event server
   */
  async connect() {
    if (this.connected) {
      console.warn('[EventClient] Already connected');
      return;
    }
    
    // Try WebSocket first, fallback to SSE
    if (this.useWebSocket && typeof WebSocket !== 'undefined') {
      await this.connectWebSocket();
    } else {
      await this.connectSSE();
    }
  }
  
  /**
   * Connect via WebSocket
   */
  async connectWebSocket() {
    return new Promise((resolve, reject) => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/events/subscribe?token=${this.token}`;
        
        console.log('[EventClient] Connecting to WebSocket:', wsUrl);
        
        this.connection = new WebSocket(wsUrl);
        this.transportType = 'websocket';
        
        this.connection.onopen = () => {
          console.log('[EventClient] WebSocket connected');
          this.connected = true;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.emit('connected', { transport: 'websocket' });
          resolve();
        };
        
        this.connection.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('[EventClient] Failed to parse message:', error);
          }
        };
        
        this.connection.onerror = (error) => {
          console.error('[EventClient] WebSocket error:', error);
          this.emit('error', error);
        };
        
        this.connection.onclose = () => {
          console.log('[EventClient] WebSocket closed');
          this.connected = false;
          this.stopHeartbeat();
          this.emit('disconnected');
          this.attemptReconnect();
        };
        
      } catch (error) {
        console.error('[EventClient] WebSocket connection failed:', error);
        reject(error);
        // Fallback to SSE
        this.connectSSE();
      }
    });
  }
  
  /**
   * Connect via SSE
   */
  async connectSSE() {
    return new Promise((resolve) => {
      try {
        const sseUrl = `${this.baseUrl}/events/subscribe/sse?token=${this.token}`;
        
        console.log('[EventClient] Connecting to SSE:', sseUrl);
        
        this.connection = new EventSource(sseUrl);
        this.transportType = 'sse';
        
        this.connection.onopen = () => {
          console.log('[EventClient] SSE connected');
          this.connected = true;
          this.reconnectAttempts = 0;
          this.emit('connected', { transport: 'sse' });
          resolve();
        };
        
        this.connection.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('[EventClient] Failed to parse SSE message:', error);
          }
        };
        
        this.connection.onerror = (error) => {
          console.error('[EventClient] SSE error:', error);
          this.connected = false;
          this.emit('error', error);
          this.emit('disconnected');
          this.attemptReconnect();
        };
        
      } catch (error) {
        console.error('[EventClient] SSE connection failed:', error);
        resolve(); // Don't reject, just log
      }
    });
  }
  
  /**
   * Handle incoming message
   */
  handleMessage(message) {
    console.log('[EventClient] Message received:', message);
    
    switch (message.type) {
      case 'event':
        this.emit('event', message.data);
        if (message.data.type) {
          this.emit(message.data.type, message.data);
        }
        break;
        
      case 'subscribed':
        this.emit('subscribed', message.data);
        break;
        
      case 'unsubscribed':
        this.emit('unsubscribed', message.data);
        break;
        
      case 'pong':
        // Heartbeat response
        break;
        
      case 'error':
        this.emit('error', message.error);
        break;
    }
  }
  
  /**
   * Subscribe to additional channels
   */
  subscribe(channels) {
    if (!this.connected || !this.connection) {
      console.warn('[EventClient] Not connected');
      return;
    }
    
    if (this.transportType === 'websocket') {
      this.connection.send(JSON.stringify({
        action: 'subscribe',
        channels: Array.isArray(channels) ? channels : [channels]
      }));
    } else {
      console.warn('[EventClient] Channel subscription not supported for SSE');
    }
  }
  
  /**
   * Unsubscribe from channels
   */
  unsubscribe(channels) {
    if (!this.connected || !this.connection) {
      console.warn('[EventClient] Not connected');
      return;
    }
    
    if (this.transportType === 'websocket') {
      this.connection.send(JSON.stringify({
        action: 'unsubscribe',
        channels: Array.isArray(channels) ? channels : [channels]
      }));
    }
  }
  
  /**
   * Register event handler
   */
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
  }
  
  /**
   * Unregister event handler
   */
  off(event, handler) {
    if (!this.eventHandlers.has(event)) return;
    
    const handlers = this.eventHandlers.get(event);
    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
    }
  }
  
  /**
   * Emit event to handlers
   */
  emit(event, data) {
    if (!this.eventHandlers.has(event)) return;
    
    const handlers = this.eventHandlers.get(event);
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error('[EventClient] Handler error:', error);
      }
    });
  }
  
  /**
   * Start heartbeat
   */
  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      if (this.connected && this.transportType === 'websocket') {
        this.connection.send(JSON.stringify({ action: 'ping' }));
      }
    }, this.heartbeatInterval);
  }
  
  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
  
  /**
   * Attempt reconnection with exponential backoff
   */
  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[EventClient] Max reconnect attempts reached');
      this.emit('max_reconnect_attempts');
      return;
    }
    
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );
    
    this.reconnectAttempts++;
    
    console.log(`[EventClient] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }
  
  /**
   * Disconnect
   */
  disconnect() {
    this.connected = false;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    this.stopHeartbeat();
    
    if (this.connection) {
      if (this.transportType === 'websocket') {
        this.connection.close();
      } else {
        this.connection.close();
      }
      this.connection = null;
    }
    
    console.log('[EventClient] Disconnected');
  }
  
  /**
   * Check if connected
   */
  isConnected() {
    return this.connected;
  }
}

// Export for browser
if (typeof window !== 'undefined') {
  window.EventClient = EventClient;
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EventClient;
}

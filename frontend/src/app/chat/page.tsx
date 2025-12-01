'use client';

import React, { useState, useEffect } from 'react';
import { ChatContainer, Message, Citation } from '@/components/chat/ChatContainer';
import apiClient from '@/lib/api-client';
import wsService from '@/lib/websocket';

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'system',
      content: 'Welcome to LifeOS Chat! Ask me anything about your data.',
      timestamp: new Date(),
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    // Connect WebSocket (will be implemented when backend supports it)
    // wsService.connect('user-123');
    
    // wsService.onChatMessage((message) => {
    //   setMessages(prev => [...prev, message]);
    //   setLoading(false);
    // });

    // return () => {
    //   wsService.disconnect();
    // };
  }, []);

  const handleSend = async (message: string, files?: File[]) => {
    setError(undefined);
    
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setLoading(true);

    try {
      // Send to RAG API
      const response = await apiClient.ragQuery(message, 'user-123');
      
      // Add assistant message with citations
      const assistantMessage: Message = {
        id: Date.now().toString() + '-ai',
        role: 'assistant',
        content: response.answer || 'I found some relevant information for you.',
        citations: response.sources?.map((s: any) => ({
          id: s.id,
          title: s.title,
          source: s.type,
          snippet: s.content?.substring(0, 150) || '',
          url: s.url,
          confidence: s.score,
        })),
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      setError(err.message || 'Failed to get response. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCitationClick = (citation: Citation) => {
    if (citation.url) {
      window.open(citation.url, '_blank');
    }
  };

  return (
    <div className="h-screen flex flex-col">
      <ChatContainer
        messages={messages}
        onSend={handleSend}
        loading={loading}
        error={error}
        onCitationClick={handleCitationClick}
      />
    </div>
  );
}

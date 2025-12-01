'use client';

import React, { useRef, useEffect, useState } from 'react';
import { ChatMessage, Message, Citation } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { Spinner } from '../ui/Spinner';
import { AlertCircle } from 'lucide-react';

interface ChatContainerProps {
  messages: Message[];
  onSend: (message: string, files?: File[]) => void;
  loading?: boolean;
  error?: string;
  onCitationClick?: (citation: Citation) => void;
}

export const ChatContainer: React.FC<ChatContainerProps> = ({
  messages,
  onSend,
  loading = false,
  error,
  onCitationClick,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const scrollToBottom = () => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setAutoScroll(isNearBottom);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div
        className="flex-1 overflow-y-auto px-4 py-6"
        onScroll={handleScroll}
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <p className="text-lg mb-2">No messages yet</p>
              <p className="text-sm">Start a conversation to get personalized insights from your data</p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                onCitationClick={onCitationClick}
              />
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <Spinner size="sm" />
                <span className="text-sm">Thinking...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-4 mb-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-800 dark:text-red-200">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Input Area */}
      <ChatInput onSend={onSend} loading={loading} />
    </div>
  );
};

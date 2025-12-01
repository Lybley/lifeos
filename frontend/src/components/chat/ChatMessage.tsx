'use client';

import React, { useState } from 'react';
import { User, Bot, Copy, Check } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { CitationBadge } from './CitationBadge';

export interface Citation {
  id: string;
  title: string;
  source: string;
  snippet: string;
  url?: string;
  confidence?: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations?: Citation[];
  timestamp: Date;
  metadata?: any;
}

interface ChatMessageProps {
  message: Message;
  onCitationClick?: (citation: Citation) => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, onCitationClick }) => {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isSystem) {
    return (
      <div className="flex justify-center my-4">
        <Badge variant="info" size="sm">
          {message.content}
        </Badge>
      </div>
    );
  }

  return (
    <div className={`flex gap-4 mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
          <Bot className="w-5 h-5 text-primary-600 dark:text-primary-400" />
        </div>
      )}

      <div className={`flex flex-col max-w-[70%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
          }`}
        >
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>

        {message.citations && message.citations.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {message.citations.map((citation) => (
              <CitationBadge
                key={citation.id}
                citation={citation}
                onClick={() => onCitationClick?.(citation)}
              />
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
          <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
          {!isUser && (
            <button
              onClick={copyToClipboard}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
              title="Copy message"
            >
              {copied ? (
                <Check className="w-3 h-3 text-green-600" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
          )}
        </div>
      </div>

      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
          <User className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </div>
      )}
    </div>
  );
};

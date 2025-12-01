'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { ChatInput } from '../chat/ChatInput';
import { ChatMessage, Message } from '../chat/ChatMessage';
import { Sparkles } from 'lucide-react';

interface TutorialStepProps {
  onNext: () => void;
  onBack?: () => void;
}

export const TutorialStep: React.FC<TutorialStepProps> = ({ onNext, onBack }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'system',
      content: 'Try asking a question about your data!',
      timestamp: new Date(),
    },
  ]);
  const [hasAskedQuestion, setHasAskedQuestion] = useState(false);

  const suggestedQuestions = [
    'What meetings do I have this week?',
    'Summarize my recent emails from Sarah',
    'Show me all documents about the Q4 project',
    'Who have I been talking to most?',
  ];

  const handleSend = async (message: string) => {
    setHasAskedQuestion(true);

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    // Simulate AI response after a delay
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Great question! Based on your data, I found several relevant items. In a real setup, I'd show you the actual results with citations to your emails, documents, and calendar events.",
        citations: [
          {
            id: 'c1',
            title: 'Sample Email',
            source: 'gmail',
            snippet: 'This is a sample citation from your Gmail...',
            confidence: 0.95,
          },
        ],
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMessage]);
    }, 1500);
  };

  const handleSuggestion = (question: string) => {
    handleSend(question);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-accent-600" />
          <CardTitle>Try Your First Query</CardTitle>
        </div>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Ask anything about your data. The AI will search your memory graph and provide answers with sources.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Suggested Questions */}
        {!hasAskedQuestion && (
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Try one of these questions:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {suggestedQuestions.map((question, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestion(question)}
                  className="p-3 text-left bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-sm"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chat Area */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="h-96 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900">
            {messages.map(message => (
              <ChatMessage key={message.id} message={message} />
            ))}
          </div>
          <ChatInput onSend={handleSend} allowAttachments={false} />
        </div>

        {/* Navigation */}
        <div className="flex justify-between pt-4">
          <Button variant="ghost" onClick={onBack}>
            ← Back
          </Button>
          <Button onClick={onNext}>
            {hasAskedQuestion ? 'Complete Setup →' : 'Skip Tutorial →'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

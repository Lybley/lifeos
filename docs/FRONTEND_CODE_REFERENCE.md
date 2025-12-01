# Frontend Code Reference - Complete Implementation

## Onboarding Components

### /app/frontend/src/components/onboarding/OnboardingFlow.tsx

```typescript
'use client';

import React, { useState } from 'react';
import { WelcomeStep } from './WelcomeStep';
import { ConnectGmailStep } from './ConnectGmailStep';
import { IngestStep } from './IngestStep';
import { TutorialStep } from './TutorialStep';

export const OnboardingFlow: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const steps = [
    { component: WelcomeStep, title: 'Welcome' },
    { component: ConnectGmailStep, title: 'Connect Gmail' },
    { component: IngestStep, title: 'Ingest Data' },
    { component: TutorialStep, title: 'First Query' },
  ];

  const handleNext = () => {
    setCompletedSteps([...completedSteps, currentStep]);
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const CurrentStepComponent = steps[currentStep].component;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 dark:from-gray-900 dark:to-gray-800 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {steps.map((step, index) => (
              <div
                key={index}
                className={`flex-1 h-2 rounded-full mx-1 transition-colors ${
                  index <= currentStep
                    ? 'bg-primary-600'
                    : 'bg-gray-200 dark:bg-gray-700'
                }`}
              />
            ))}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
            Step {currentStep + 1} of {steps.length}: {steps[currentStep].title}
          </p>
        </div>

        {/* Current Step */}
        <CurrentStepComponent onNext={handleNext} onBack={handleBack} />
      </div>
    </div>
  );
};
```

### Individual Step Components

```typescript
// WelcomeStep.tsx
export const WelcomeStep: React.FC<StepProps> = ({ onNext }) => {
  return (
    <Card className="text-center p-12">
      <h1 className="text-4xl font-bold mb-4">Welcome to LifeOS 🎉</h1>
      <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
        Your Personal Memory Graph powered by AI
      </p>
      <Button size="lg" onClick={onNext}>Get Started</Button>
    </Card>
  );
};

// ConnectGmailStep.tsx - Shows Gmail OAuth flow
// IngestStep.tsx - Shows ingestion progress
// TutorialStep.tsx - Interactive first query tutorial
```

## Main Page Components

### /app/frontend/src/app/page.tsx (Dashboard)

```typescript
'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Brain, MessageSquare, Upload, Link as LinkIcon } from 'lucide-react';
import apiClient from '@/lib/api-client';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalNodes: 0,
    connections: 0,
    recentChats: 0,
    actionsToday: 0,
  });

  useEffect(() => {
    // Load dashboard stats
    const loadStats = async () => {
      try {
        const nodes = await apiClient.getNodes();
        setStats(prev => ({ ...prev, totalNodes: nodes.length }));
      } catch (error) {
        console.error('Failed to load stats:', error);
      }
    };
    loadStats();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Welcome back! Here's what's happening with your LifeOS.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Memories</p>
              <p className="text-3xl font-bold">{stats.totalNodes}</p>
            </div>
            <Brain className="w-12 h-12 text-primary-600 opacity-50" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Connections</p>
              <p className="text-3xl font-bold">{stats.connections}</p>
            </div>
            <LinkIcon className="w-12 h-12 text-green-600 opacity-50" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Recent Chats</p>
              <p className="text-3xl font-bold">{stats.recentChats}</p>
            </div>
            <MessageSquare className="w-12 h-12 text-blue-600 opacity-50" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Actions Today</p>
              <p className="text-3xl font-bold">{stats.actionsToday}</p>
            </div>
            <Upload className="w-12 h-12 text-purple-600 opacity-50" />
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Activity items would go here */}
            <p className="text-gray-500">No recent activity</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

### /app/frontend/src/app/chat/page.tsx

```typescript
'use client';

import React, { useState, useEffect } from 'react';
import { ChatContainer, Message, Citation } from '@/components/chat/ChatContainer';
import apiClient from '@/lib/api-client';
import wsService from '@/lib/websocket';

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    // Connect WebSocket
    wsService.connect('user-123');
    
    wsService.onChatMessage((message) => {
      setMessages(prev => [...prev, message]);
      setLoading(false);
    });

    return () => {
      wsService.disconnect();
    };
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
        content: response.answer,
        citations: response.sources?.map((s: any) => ({
          id: s.id,
          title: s.title,
          source: s.type,
          snippet: s.content.substring(0, 150),
          url: s.url,
          confidence: s.score,
        })),
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      setError('Failed to get response. Please try again.');
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
```

### /app/frontend/src/app/upload/page.tsx

```typescript
'use client';

import React, { useState } from 'react';
import { UploadZone } from '@/components/upload/UploadZone';
import { UploadProgress, UploadItem } from '@/components/upload/UploadProgress';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

export default function UploadPage() {
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);

  const handleUpload = async (files: File[]) => {
    const newItems: UploadItem[] = files.map(file => ({
      id: `${Date.now()}-${file.name}`,
      name: file.name,
      size: file.size,
      status: 'uploading',
      progress: 0,
    }));

    setUploadItems(prev => [...prev, ...newItems]);

    // Simulate upload progress
    for (const item of newItems) {
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 200));
        setUploadItems(prev =>
          prev.map(u =>
            u.id === item.id
              ? { ...u, progress: i, status: i === 100 ? 'completed' : 'uploading' }
              : u
          )
        );
      }
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Upload Files</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Upload documents, emails, or other files to enrich your memory graph.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <UploadZone onUpload={handleUpload} maxSize={50} maxFiles={10} />
        </CardContent>
      </Card>

      <UploadProgress items={uploadItems} />
    </div>
  );
}
```

### /app/frontend/src/app/connections/page.tsx

```typescript
'use client';

import React, { useState } from 'react';
import { ConnectionManager } from '@/components/connections/ConnectionManager';
import { Connection } from '@/components/connections/ConnectionCard';

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([
    {
      id: '1',
      name: 'Gmail',
      type: 'gmail',
      status: 'connected',
      lastSync: new Date(),
      itemsCount: 1547,
      icon: '📧',
      description: 'Sync emails and contacts',
    },
    {
      id: '2',
      name: 'Google Drive',
      type: 'google-drive',
      status: 'disconnected',
      icon: '📁',
      description: 'Sync files and documents',
    },
    {
      id: '3',
      name: 'Google Calendar',
      type: 'google-calendar',
      status: 'connected',
      lastSync: new Date(Date.now() - 3600000),
      itemsCount: 234,
      icon: '📅',
      description: 'Sync calendar events',
    },
  ]);

  const handleConnect = async (id: string) => {
    // Trigger OAuth flow
    console.log('Connecting:', id);
  };

  const handleDisconnect = async (id: string) => {
    setConnections(prev =>
      prev.map(c => (c.id === id ? { ...c, status: 'disconnected' as const } : c))
    );
  };

  const handleSync = async (id: string) => {
    setConnections(prev =>
      prev.map(c => (c.id === id ? { ...c, status: 'syncing' as const } : c))
    );
    
    // Simulate sync
    setTimeout(() => {
      setConnections(prev =>
        prev.map(c => (c.id === id ? { ...c, status: 'connected' as const, lastSync: new Date() } : c))
      );
    }, 2000);
  };

  return (
    <div className="p-6">
      <ConnectionManager
        connections={connections}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        onSync={handleSync}
      />
    </div>
  );
}
```

## Storybook Stories

### /app/frontend/src/stories/ChatMessage.stories.tsx

```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { ChatMessage } from '../components/chat/ChatMessage';

const meta: Meta<typeof ChatMessage> = {
  title: 'Chat/ChatMessage',
  component: ChatMessage,
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof ChatMessage>;

export const UserMessage: Story = {
  args: {
    message: {
      id: '1',
      role: 'user',
      content: 'What meetings do I have tomorrow?',
      timestamp: new Date(),
    },
  },
};

export const AssistantMessage: Story = {
  args: {
    message: {
      id: '2',
      role: 'assistant',
      content: 'You have 3 meetings tomorrow: Team standup at 9 AM, Client call at 2 PM, and Sprint planning at 4 PM.',
      timestamp: new Date(),
    },
  },
};

export const MessageWithCitations: Story = {
  args: {
    message: {
      id: '3',
      role: 'assistant',
      content: 'Based on your calendar and emails, you have an important presentation coming up.',
      citations: [
        {
          id: 'c1',
          title: 'Q4 Presentation.pptx',
          source: 'google-drive',
          snippet: 'Financial results and projections for Q4...',
          confidence: 0.95,
        },
        {
          id: 'c2',
          title: 'Email from Sarah',
          source: 'gmail',
          snippet: 'Don\\'t forget to include the new metrics...',
          confidence: 0.87,
        },
      ],
      timestamp: new Date(),
    },
  },
};
```

### More Storybook Stories

```typescript
// Upload.stories.tsx
// ConnectionCard.stories.tsx
// MemoryGraph.stories.tsx
// ... (Similar pattern for all major components)
```

## Custom Hooks

### /app/frontend/src/lib/hooks/useChat.ts

```typescript
import { useState, useEffect } from 'react';
import wsService, { ChatMessage } from '../websocket';
import apiClient from '../api-client';

export const useChat = (userId: string) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    wsService.connect(userId);
    
    wsService.onChatMessage((message) => {
      setMessages(prev => [...prev, message]);
      setLoading(false);
    });

    return () => wsService.disconnect();
  }, [userId]);

  const sendMessage = async (content: string) => {
    setLoading(true);
    setError(undefined);
    
    try {
      wsService.sendChatMessage(content);
    } catch (err) {
      setError('Failed to send message');
      setLoading(false);
    }
  };

  return { messages, loading, error, sendMessage };
};
```

### /app/frontend/src/lib/hooks/useActions.ts

```typescript
import { useState, useEffect } from 'react';
import apiClient from '../api-client';

export const useActions = (userId: string) => {
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadActions = async () => {
      try {
        const data = await apiClient.getUserActions(userId);
        setActions(data.actions);
      } catch (error) {
        console.error('Failed to load actions:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadActions();
  }, [userId]);

  const createAction = async (actionType: string, payload: any) => {
    return await apiClient.createAction({
      user_id: userId,
      action_type: actionType,
      payload,
    });
  };

  const approveAction = async (actionId: string) => {
    await apiClient.approveAction(actionId, userId);
  };

  return { actions, loading, createAction, approveAction };
};
```

## Environment Variables

### /app/frontend/.env.local

```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=http://localhost:8000
```

## Complete API Integration Summary

All backend endpoints are accessible through `apiClient`:

```typescript
// Action Engine
apiClient.createAction({ user_id, action_type, payload })
apiClient.approveAction(actionId, approvedBy)
apiClient.rejectAction(actionId, rejectedBy, reason)
apiClient.rollbackAction(actionId, rolledBackBy, reason)
apiClient.getAction(actionId)
apiClient.getUserActions(userId)
apiClient.getRateLimits(userId, actionType)

// RAG
apiClient.ragQuery(query, userId, filters)

// AI Agents
apiClient.extractTasks(text, userId, metadata)
apiClient.summarizeDocument(documentId, userId, style)
apiClient.draftReply(messageId, userId, context)

// Graph & Vector
apiClient.getNodes(params)
apiClient.createNode(nodeData)
apiClient.vectorSearch(query, limit)

// Jobs
apiClient.getJobs(status)
apiClient.getJob(jobId)
```

## WebSocket Events

```typescript
wsService.connect(userId)
wsService.onAgentProgress((progress) => {})
wsService.onChatMessage((message) => {})
wsService.onActionUpdate((action) => {})
wsService.onIngestionProgress((progress) => {})
wsService.sendChatMessage(message, conversationId)
```

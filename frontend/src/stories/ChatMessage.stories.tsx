import type { Meta, StoryObj } from '@storybook/react';
import { ChatMessage } from '../components/chat/ChatMessage';

const meta: Meta<typeof ChatMessage> = {
  title: 'Chat/ChatMessage',
  component: ChatMessage,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
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
      content:
        'You have 3 meetings tomorrow: Team standup at 9 AM, Client call at 2 PM, and Sprint planning at 4 PM.',
      timestamp: new Date(),
    },
  },
};

export const MessageWithCitations: Story = {
  args: {
    message: {
      id: '3',
      role: 'assistant',
      content:
        'Based on your calendar and emails, you have an important presentation coming up on Friday.',
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
          snippet: "Don't forget to include the new metrics...",
          confidence: 0.87,
        },
        {
          id: 'c3',
          title: 'Meeting Notes',
          source: 'notion',
          snippet: 'Team feedback on presentation structure...',
          confidence: 0.72,
        },
      ],
      timestamp: new Date(),
    },
  },
};

export const SystemMessage: Story = {
  args: {
    message: {
      id: '4',
      role: 'system',
      content: 'Conversation started',
      timestamp: new Date(),
    },
  },
};

export const LongMessage: Story = {
  args: {
    message: {
      id: '5',
      role: 'assistant',
      content:
        'Here\'s a detailed summary of your week:\n\n1. You had 15 meetings across 5 different projects\n2. The Q4 Planning project is your most active with 8 related conversations\n3. Your top 3 contacts were Sarah (12 emails), John (8 emails), and Michael (6 emails)\n4. You created 3 new documents and updated 7 existing ones\n5. There are 2 pending action items that require your approval\n\nWould you like me to dive deeper into any of these areas?',
      timestamp: new Date(),
    },
  },
};

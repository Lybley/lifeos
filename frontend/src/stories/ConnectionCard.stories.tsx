import type { Meta, StoryObj } from '@storybook/react';
import { ConnectionCard } from '../components/connections/ConnectionCard';

const meta: Meta<typeof ConnectionCard> = {
  title: 'Connections/ConnectionCard',
  component: ConnectionCard,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ConnectionCard>;

export const GmailConnected: Story = {
  args: {
    connection: {
      id: '1',
      name: 'Gmail',
      type: 'gmail',
      status: 'connected',
      lastSync: new Date(),
      itemsCount: 1547,
      icon: '📧',
      description: 'Sync emails and contacts from your Gmail account',
    },
  },
};

export const GoogleDriveDisconnected: Story = {
  args: {
    connection: {
      id: '2',
      name: 'Google Drive',
      type: 'google-drive',
      status: 'disconnected',
      icon: '📁',
      description: 'Sync files and documents from Google Drive',
    },
  },
};

export const GoogleCalendarSyncing: Story = {
  args: {
    connection: {
      id: '3',
      name: 'Google Calendar',
      type: 'google-calendar',
      status: 'syncing',
      lastSync: new Date(Date.now() - 3600000),
      itemsCount: 234,
      icon: '📅',
      description: 'Sync calendar events and meetings',
    },
  },
};

export const SlackError: Story = {
  args: {
    connection: {
      id: '4',
      name: 'Slack',
      type: 'slack',
      status: 'error',
      lastSync: new Date(Date.now() - 86400000),
      itemsCount: 892,
      icon: '💬',
      description: 'Sync messages and channels from Slack',
    },
  },
};

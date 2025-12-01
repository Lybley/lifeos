import type { Meta, StoryObj } from '@storybook/react';
import { UploadZone } from '../components/upload/UploadZone';

const meta: Meta<typeof UploadZone> = {
  title: 'Upload/UploadZone',
  component: UploadZone,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof UploadZone>;

export const Default: Story = {
  args: {
    onUpload: (files) => console.log('Uploaded files:', files),
    maxSize: 10,
    maxFiles: 5,
  },
};

export const LargeFiles: Story = {
  args: {
    onUpload: (files) => console.log('Uploaded files:', files),
    maxSize: 100,
    maxFiles: 10,
  },
};

export const RestrictedTypes: Story = {
  args: {
    onUpload: (files) => console.log('Uploaded files:', files),
    accept: '.pdf,.doc,.docx',
    maxSize: 10,
    maxFiles: 5,
  },
};

export const Loading: Story = {
  args: {
    onUpload: (files) => console.log('Uploaded files:', files),
    loading: true,
  },
};

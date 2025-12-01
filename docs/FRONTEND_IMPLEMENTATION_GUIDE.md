# LifeOS Frontend Implementation Guide

## Overview
Complete Next.js 14 frontend with real-time WebSocket updates, chat interface with citations, memory graph visualization, and onboarding flow.

## Architecture

### Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **State**: React Context + SWR
- **Real-time**: Socket.IO Client
- **Charts**: Recharts
- **Graph**: react-force-graph-2d + D3
- **UI Components**: Radix UI primitives
- **Icons**: Lucide React
- **Testing**: Storybook

### Project Structure
```
/app/frontend/
├── src/
│   ├── app/                    # Next.js pages
│   │   ├── (dashboard)/        # Dashboard route group
│   │   │   ├── page.tsx        # Main dashboard
│   │   │   └── layout.tsx      # Dashboard layout
│   │   ├── chat/               # Chat interface
│   │   │   └── page.tsx
│   │   ├── upload/             # File upload
│   │   │   └── page.tsx
│   │   ├── connections/        # Service connections
│   │   │   └── page.tsx
│   │   ├── settings/           # User settings
│   │   │   └── page.tsx
│   │   ├── onboarding/         # Onboarding flow
│   │   │   └── page.tsx
│   │   ├── layout.tsx          # Root layout
│   │   └── globals.css         # Global styles
│   ├── components/             # React components
│   │   ├── chat/
│   │   │   ├── ChatMessage.tsx
│   │   │   ├── CitationBadge.tsx
│   │   │   ├── ChatInput.tsx
│   │   │   └── ChatContainer.tsx
│   │   ├── upload/
│   │   │   ├── UploadZone.tsx
│   │   │   ├── FileList.tsx
│   │   │   └── UploadProgress.tsx
│   │   ├── connections/
│   │   │   ├── ConnectionCard.tsx
│   │   │   ├── ConnectionManager.tsx
│   │   │   └── ServiceSelector.tsx
│   │   ├── memory/
│   │   │   ├── MemoryGraph.tsx
│   │   │   ├── NodeDetails.tsx
│   │   │   └── GraphControls.tsx
│   │   ├── onboarding/
│   │   │   ├── WelcomeStep.tsx
│   │   │   ├── ConnectGmailStep.tsx
│   │   │   ├── IngestStep.tsx
│   │   │   └── TutorialStep.tsx
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   └── Navigation.tsx
│   │   └── ui/                 # Reusable UI components
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       ├── Badge.tsx
│   │       └── ...
│   ├── lib/                    # Utilities
│   │   ├── api-client.ts       # API client
│   │   ├── websocket.ts        # WebSocket service
│   │   └── hooks/              # Custom hooks
│   │       ├── useWebSocket.ts
│   │       ├── useChat.ts
│   │       └── useActions.ts
│   └── stories/                # Storybook stories
│       ├── ChatMessage.stories.tsx
│       ├── Upload.stories.tsx
│       └── ConnectionManager.stories.tsx
├── public/                     # Static assets
├── tailwind.config.js
├── postcss.config.js
└── .storybook/                 # Storybook config

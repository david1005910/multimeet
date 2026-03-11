# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**MultiMeet** is a multilingual meeting translation and minutes automation system for global sales professionals. It enables real-time interpretation and automatic Korean meeting minutes generation for meetings conducted in English, Chinese (Simplified), and Vietnamese.

### Core Modes
- **Mode A (Meeting Minutes)**: Audio recording → Whisper STT → Claude translation/summarization → Korean meeting minutes
- **Mode B (Live Interpretation)**: Real-time microphone input → Whisper STT (chunked) → Claude translation → Instant display

## Tech Stack

### Frontend
- React 18.x + TypeScript + Vite
- TailwindCSS + shadcn/ui
- Zustand (state) + React Query (server state)
- Socket.io-client for WebSocket

### Backend
- Node.js 20.x + Express + TypeScript
- Socket.io for real-time communication
- Prisma ORM + PostgreSQL
- Bull queue (Redis-based) for audio processing
- Multer for file uploads

### External APIs
- OpenAI Whisper API (`whisper-1`) for multilingual STT
- Anthropic Claude API (`claude-sonnet-4-20250514`) for translation and minutes generation

## Development Commands

```bash
# Start development environment
docker-compose up -d                    # Start PostgreSQL and Redis
npm run dev                             # Run both frontend and backend concurrently

# Database
cd backend && npx prisma migrate dev    # Run migrations
cd backend && npx prisma studio         # Open Prisma Studio

# Individual services
npm run dev -w backend                  # Backend only (port 3001)
npm run dev -w frontend                 # Frontend only (port 3000)
```

## Architecture

### Backend Structure
```
backend/src/
├── routes/          # Express route definitions
├── controllers/     # Request handlers
├── services/
│   ├── whisper.service.ts   # OpenAI Whisper integration
│   ├── claude.service.ts    # Claude API for translation/minutes
│   └── meeting.service.ts   # Business logic
├── socket/
│   ├── socketHandler.ts     # WebSocket event management
│   └── interpretSession.ts  # Real-time interpretation session
├── queues/                  # Bull job queue for async processing
└── middleware/              # Auth, error handling, uploads
```

### Frontend Structure
```
frontend/src/
├── pages/
│   ├── MinutesMode.tsx      # Mode A: Recording → STT → Minutes
│   └── InterpretMode.tsx    # Mode B: Real-time interpretation
├── hooks/
│   ├── useAudioRecorder.ts  # MediaRecorder API wrapper
│   └── useRealtimeInterpret.ts  # WebSocket + audio streaming
├── stores/                  # Zustand stores
└── services/                # API clients
```

## Key Implementation Details

### Real-time Interpretation Pipeline
1. Browser captures audio in 3-second chunks via MediaRecorder
2. Chunks sent as Base64 over WebSocket
3. Server: Whisper STT → Claude translation → WebSocket response
4. Client displays original and Korean translation in dual-panel UI

### Audio Processing
- Whisper API has 25MB file size limit; larger files must be split (use ffmpeg)
- Audio format: WebM/Opus from browser, server converts if needed
- VAD (Voice Activity Detection) for natural chunk splitting in real-time mode

### Meeting Minutes Generation
- Uses Claude streaming responses for real-time display
- Output format: Korean markdown with structured sections (목적, 논의사항, 결정사항, Action Items)
- Export formats: PDF, DOCX, Markdown

## Language Support

| Language | Code | Use Case |
|----------|------|----------|
| Korean   | ko   | Output language (all minutes and translations) |
| English  | en   | US client meetings |
| Chinese  | zh   | China client meetings |
| Vietnamese | vi | Vietnam client meetings |

## Environment Variables

```bash
# Backend (.env)
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=...
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
FRONTEND_URL=http://localhost:3000

# Frontend (.env)
VITE_API_URL=http://localhost:3001
```

## Core Principles (from Constitution)

1. **Real-time First**: Translation delay must be < 3 seconds
2. **Accuracy**: Business terminology, product names, and numbers must be precise
3. **Simplicity**: Core functions accessible with minimal clicks
4. **Korean-Centric Output**: All final outputs in Korean business document format
5. **Offline Resilience**: Recording continues during network outages

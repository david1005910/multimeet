# MultiMeet — Implement (구현 가이드)

> 핵심 모듈의 구체적인 구현 코드와 패턴 가이드
> 이 문서를 따라 순서대로 구현하면 완성된 시스템이 만들어진다

---

## 0. 시작 전 체크리스트

```bash
# 필수 환경 확인
node --version    # v20.x 이상
npm --version     # v10.x 이상
docker --version  # 설치 확인
psql --version    # 또는 docker로 대체

# API 키 준비 확인
# - OpenAI API Key (Whisper 사용)
# - Anthropic API Key (Claude 사용)
```

---

## 1. 프로젝트 초기화

### 1.1 디렉토리 구조 생성

```bash
mkdir multimeet && cd multimeet

# 루트 package.json (워크스페이스)
cat > package.json << 'EOF'
{
  "name": "multimeet",
  "private": true,
  "workspaces": ["frontend", "backend"],
  "scripts": {
    "dev": "concurrently \"npm run dev -w backend\" \"npm run dev -w frontend\"",
    "db:up": "docker-compose up -d postgres redis"
  }
}
EOF

npm i -D concurrently
```

### 1.2 Docker Compose 설정

```yaml
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    container_name: multimeet-db
    environment:
      POSTGRES_DB: multimeet
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password123
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    container_name: multimeet-redis
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

```bash
docker-compose up -d
```

---

## 2. 백엔드 구현

### 2.1 백엔드 초기화

```bash
mkdir backend && cd backend
npm init -y

# 핵심 패키지
npm i express cors dotenv jsonwebtoken bcryptjs multer socket.io bull openai @anthropic-ai/sdk @prisma/client

# 개발 패키지
npm i -D typescript @types/node @types/express @types/cors @types/jsonwebtoken @types/bcryptjs @types/multer ts-node nodemon prisma
```

```json
// backend/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 2.2 Prisma 스키마

```prisma
// backend/prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  password  String
  name      String?
  meetings  Meeting[]
  settings  UserSettings?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Meeting {
  id           String    @id @default(uuid())
  userId       String
  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  title        String
  company      String?
  language     String    // 'en', 'zh', 'vi'
  mode         String    // 'minutes', 'interpret'
  status       String    @default("preparing") // preparing, in_progress, completed
  participants String[]
  audioPath    String?
  transcript   Transcript?
  minutes      Minutes?
  interpretLogs InterpretLog[]
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  deletedAt    DateTime?
}

model Transcript {
  id        String   @id @default(uuid())
  meetingId String   @unique
  meeting   Meeting  @relation(fields: [meetingId], references: [id], onDelete: Cascade)
  segments  Json
  rawText   String
  createdAt DateTime @default(now())
}

model Minutes {
  id        String   @id @default(uuid())
  meetingId String   @unique
  meeting   Meeting  @relation(fields: [meetingId], references: [id], onDelete: Cascade)
  content   String
  editedAt  DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model InterpretLog {
  id         String   @id @default(uuid())
  meetingId  String
  meeting    Meeting  @relation(fields: [meetingId], references: [id], onDelete: Cascade)
  timestamp  Float
  original   String
  translated String
  createdAt  DateTime @default(now())
}

model UserSettings {
  userId           String   @id
  user             User     @relation(fields: [userId], references: [id])
  defaultLanguage  String   @default("en")
  autoDeleteAudio  Boolean  @default(false)
  minutesTemplate  String   @default("standard")
  updatedAt        DateTime @updatedAt
}
```

```bash
cd backend
npx prisma migrate dev --name init
```

### 2.3 Express 앱 설정

```typescript
// backend/src/app.ts
import express from 'express';
import cors from 'cors';
import path from 'path';
import authRoutes from './routes/auth.routes';
import meetingRoutes from './routes/meetings.routes';
import audioRoutes from './routes/audio.routes';
import settingsRoutes from './routes/settings.routes';
import { errorMiddleware } from './middleware/error.middleware';

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/audio', audioRoutes);
app.use('/api/settings', settingsRoutes);

app.use(errorMiddleware);

export default app;
```

```typescript
// backend/src/server.ts
import http from 'http';
import { Server } from 'socket.io';
import app from './app';
import { setupSocketHandlers } from './socket/socketHandler';

const PORT = process.env.PORT || 3001;
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
});

setupSocketHandlers(io);

server.listen(PORT, () => {
  console.log(`🚀 MultiMeet 서버 실행 중: http://localhost:${PORT}`);
});

export { io };
```

### 2.4 Whisper 서비스 구현

```typescript
// backend/src/services/whisper.service.ts
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface TranscriptSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

export interface Transcript {
  segments: TranscriptSegment[];
  rawText: string;
  language: string;
}

export class WhisperService {
  // 파일 크기 확인 후 처리
  async transcribe(audioPath: string, language: string): Promise<Transcript> {
    const stats = fs.statSync(audioPath);
    const fileSizeMB = stats.size / (1024 * 1024);

    if (fileSizeMB > 24) {
      return this.transcribeLargeFile(audioPath, language);
    }

    return this.transcribeFile(audioPath, language);
  }

  private async transcribeFile(audioPath: string, language: string): Promise<Transcript> {
    const fileStream = fs.createReadStream(audioPath);

    const response = await openai.audio.transcriptions.create({
      file: fileStream,
      model: 'whisper-1',
      language: language, // 'en', 'zh', 'vi'
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
    });

    const segments: TranscriptSegment[] = (response.segments || []).map((seg, idx) => ({
      id: idx,
      start: seg.start,
      end: seg.end,
      text: seg.text.trim(),
    }));

    return {
      segments,
      rawText: response.text,
      language: response.language || language,
    };
  }

  // 큰 파일은 10분 단위로 분할 처리 (ffmpeg 필요)
  private async transcribeLargeFile(audioPath: string, language: string): Promise<Transcript> {
    // 간단한 구현: 전체 파일을 분할 없이 처리 시도
    // 프로덕션에서는 ffmpeg으로 분할 처리 권장
    console.warn(`대용량 파일 감지 (${audioPath}). 처리 시간이 길어질 수 있습니다.`);
    return this.transcribeFile(audioPath, language);
  }
}

export const whisperService = new WhisperService();
```

### 2.5 Claude 서비스 구현

```typescript
// backend/src/services/claude.service.ts
import Anthropic from '@anthropic-ai/sdk';
import { Meeting, Transcript } from '../types';
import { buildMinutesPrompt, buildTranslationPrompt } from '../utils/prompts';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export class ClaudeService {
  // 회의록 생성 (스트리밍)
  async *generateMinutes(transcript: Transcript, meeting: Meeting): AsyncGenerator<string> {
    const prompt = buildMinutesPrompt(transcript, meeting);

    const stream = client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: `당신은 전문 비서입니다. 회의 트랜스크립트를 바탕으로 
한국어로 구조화된 비즈니스 회의록을 작성합니다.
반드시 마크다운 형식으로 작성하고, 모든 내용은 한국어로 작성하세요.`,
      messages: [{ role: 'user', content: prompt }],
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        yield chunk.delta.text;
      }
    }
  }

  // 실시간 번역 (단일 응답)
  async translate(text: string, sourceLanguage: string): Promise<string> {
    const langMap: Record<string, string> = {
      en: '영어',
      zh: '중국어',
      vi: '베트남어',
    };
    const langName = langMap[sourceLanguage] || sourceLanguage;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: `당신은 전문 통역사입니다. ${langName} 텍스트를 자연스러운 한국어 비즈니스 표현으로 번역합니다.
번역문만 출력하세요. 설명이나 주석은 포함하지 마세요.`,
      messages: [{ role: 'user', content: text }],
    });

    const content = response.content[0];
    return content.type === 'text' ? content.text : '';
  }
}

export const claudeService = new ClaudeService();
```

### 2.6 프롬프트 템플릿

```typescript
// backend/src/utils/prompts.ts
import { Meeting, Transcript } from '../types';

export function buildMinutesPrompt(transcript: Transcript, meeting: Meeting): string {
  const langMap: Record<string, string> = {
    en: '영어',
    zh: '중국어',
    vi: '베트남어',
  };

  const participantsStr = meeting.participants?.join(', ') || '미입력';
  const transcriptText = transcript.segments
    .map(s => `[${formatTime(s.start)}] ${s.text}`)
    .join('\n');

  return `다음 회의 정보와 트랜스크립트를 바탕으로 한국어 회의록을 작성해주세요.

## 회의 정보
- 회의명: ${meeting.title}
- 상대 회사: ${meeting.company || '미입력'}
- 일시: ${new Date(meeting.createdAt).toLocaleString('ko-KR')}
- 원본 언어: ${langMap[meeting.language] || meeting.language}
- 참석자: ${participantsStr}

## 회의 트랜스크립트
${transcriptText}

---

위 내용을 바탕으로 다음 형식의 한국어 회의록을 작성해주세요:

## 회의록

**회의명**: [회의명]  
**일시**: [날짜 및 시간]  
**참석자**: [참석자]  
**원본 언어**: [언어]

---

### 1. 회의 목적
[회의 목적을 1-3문장으로 요약]

### 2. 주요 논의 사항
[안건별로 구조화하여 정리]

### 3. 결정 사항
- [중요한 결정 사항을 불릿으로 정리]

### 4. Action Items
| 담당자 | 내용 | 기한 |
|--------|------|------|
| [이름] | [할 일] | [날짜] |

### 5. 다음 회의
- 예정 일정: [날짜 또는 미정]
- 주요 안건: [내용]`;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
```

### 2.7 WebSocket 핸들러 (실시간 통역)

```typescript
// backend/src/socket/socketHandler.ts
import { Server, Socket } from 'socket.io';
import { verifyToken } from '../utils/jwt';
import { claudeService } from '../services/claude.service';
import { whisperService } from '../services/whisper.service';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export function setupSocketHandlers(io: Server): void {
  // 인증 미들웨어
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    const user = verifyToken(token);
    if (!user) return next(new Error('인증 실패'));
    (socket as any).userId = user.id;
    next();
  });

  io.on('connection', (socket: Socket) => {
    console.log(`[Socket] 연결: ${socket.id}`);

    // 세션 참여
    socket.on('join-session', (meetingId: string) => {
      socket.join(meetingId);
      console.log(`[Socket] ${socket.id} → 세션 ${meetingId} 참여`);
    });

    // 오디오 청크 수신 → 처리 → 번역 결과 반환
    socket.on('audio-chunk', async (data: {
      meetingId: string;
      language: string;
      audioBase64: string;
      timestamp: number;
    }) => {
      try {
        // Base64 → 임시 파일
        const tmpPath = path.join('/tmp', `chunk-${uuidv4()}.webm`);
        const audioBuffer = Buffer.from(data.audioBase64, 'base64');
        fs.writeFileSync(tmpPath, audioBuffer);

        // Whisper STT
        const transcript = await whisperService.transcribe(tmpPath, data.language);
        fs.unlinkSync(tmpPath); // 임시 파일 삭제

        if (!transcript.rawText.trim()) return;

        // Claude 번역
        const translated = await claudeService.translate(transcript.rawText, data.language);

        // 클라이언트에 결과 전송
        socket.emit('translation-result', {
          timestamp: data.timestamp,
          original: transcript.rawText,
          translated,
          meetingId: data.meetingId,
        });

      } catch (error) {
        console.error('[Socket] 처리 오류:', error);
        socket.emit('error', { message: '번역 처리 중 오류가 발생했습니다.' });
      }
    });

    socket.on('leave-session', (meetingId: string) => {
      socket.leave(meetingId);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] 해제: ${socket.id}`);
    });
  });
}
```

---

## 3. 프론트엔드 구현

### 3.1 프론트엔드 초기화

```bash
cd ..
npm create vite@latest frontend -- --template react-ts
cd frontend

# 패키지 설치
npm i tailwindcss @tailwindcss/typography
npm i @tanstack/react-query zustand react-router-dom
npm i socket.io-client axios
npm i react-markdown lucide-react
npm i @radix-ui/react-dialog @radix-ui/react-select @radix-ui/react-toast
```

### 3.2 Zustand 인증 스토어

```typescript
// frontend/src/stores/authStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      setAuth: (user, token) => set({ user, token }),
      logout: () => set({ user: null, token: null }),
    }),
    { name: 'multimeet-auth' }
  )
);
```

### 3.3 오디오 녹음 훅

```typescript
// frontend/src/hooks/useAudioRecorder.ts
import { useState, useRef, useCallback } from 'react';

interface AudioRecorderState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  audioLevel: number;
}

interface UseAudioRecorder extends AudioRecorderState {
  start: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => Promise<Blob | null>;
}

export function useAudioRecorder(): UseAudioRecorder {
  const [state, setState] = useState<AudioRecorderState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    audioLevel: 0,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // 오디오 레벨 분석
    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;

    const updateLevel = () => {
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      setState(s => ({ ...s, audioLevel: Math.round(avg) }));
      animFrameRef.current = requestAnimationFrame(updateLevel);
    };
    updateLevel();

    // MediaRecorder 시작
    const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
    mediaRecorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.start(1000); // 1초마다 chunk

    // 타이머
    timerRef.current = setInterval(() => {
      setState(s => ({ ...s, duration: s.duration + 1 }));
    }, 1000);

    setState(s => ({ ...s, isRecording: true, isPaused: false }));
  }, []);

  const pause = useCallback(() => {
    mediaRecorderRef.current?.pause();
    if (timerRef.current) clearInterval(timerRef.current);
    setState(s => ({ ...s, isPaused: true }));
  }, []);

  const resume = useCallback(() => {
    mediaRecorderRef.current?.resume();
    timerRef.current = setInterval(() => {
      setState(s => ({ ...s, duration: s.duration + 1 }));
    }, 1000);
    setState(s => ({ ...s, isPaused: false }));
  }, []);

  const stop = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder) return resolve(null);

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        resolve(blob);
      };

      recorder.stop();
      recorder.stream.getTracks().forEach(t => t.stop());

      if (timerRef.current) clearInterval(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

      setState({ isRecording: false, isPaused: false, duration: 0, audioLevel: 0 });
    });
  }, []);

  return { ...state, start, pause, resume, stop };
}
```

### 3.4 실시간 통역 훅

```typescript
// frontend/src/hooks/useRealtimeInterpret.ts
import { useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';

export interface TranslationItem {
  id: string;
  timestamp: number;
  original: string;
  translated: string;
  isLoading?: boolean;
}

export function useRealtimeInterpret(meetingId: string, language: string) {
  const [isActive, setIsActive] = useState(false);
  const [items, setItems] = useState<TranslationItem[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const { token } = useAuthStore();

  const start = useCallback(async () => {
    // WebSocket 연결
    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3001', {
      auth: { token },
    });
    socketRef.current = socket;

    socket.emit('join-session', meetingId);

    socket.on('translation-result', (data: Omit<TranslationItem, 'id'>) => {
      setItems(prev => [
        ...prev,
        { ...data, id: Date.now().toString() }
      ]);
    });

    // 마이크 스트림
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    mediaRecorderRef.current = recorder;

    // 3초마다 청크 전송
    recorder.ondataavailable = async (e) => {
      if (e.data.size < 1000) return; // 너무 작은 청크 무시

      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        socket.emit('audio-chunk', {
          meetingId,
          language,
          audioBase64: base64,
          timestamp: Date.now(),
        });
      };
      reader.readAsDataURL(e.data);
    };

    recorder.start(3000); // 3초마다 청크
    setIsActive(true);
  }, [meetingId, language, token]);

  const stop = useCallback(() => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current?.stream.getTracks().forEach(t => t.stop());
    socketRef.current?.emit('leave-session', meetingId);
    socketRef.current?.disconnect();
    setIsActive(false);
  }, [meetingId]);

  return { isActive, items, start, stop };
}
```

### 3.5 실시간 통역 페이지

```tsx
// frontend/src/pages/InterpretMode.tsx
import { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Mic, MicOff, Maximize2 } from 'lucide-react';
import { useRealtimeInterpret } from '../hooks/useRealtimeInterpret';
import { useMeeting } from '../hooks/useMeetings';

export default function InterpretMode() {
  const { meetingId } = useParams<{ meetingId: string }>();
  const { data: meeting } = useMeeting(meetingId!);
  const { isActive, items, start, stop } = useRealtimeInterpret(
    meetingId!,
    meeting?.language || 'en'
  );
  const bottomRef = useRef<HTMLDivElement>(null);

  // 자동 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [items]);

  const langLabel: Record<string, string> = {
    en: '🇺🇸 English',
    zh: '🇨🇳 中文',
    vi: '🇻🇳 Tiếng Việt',
  };

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white">
      {/* 헤더 */}
      <header className="flex items-center justify-between px-6 py-4 bg-gray-900 border-b border-gray-800">
        <div>
          <h1 className="text-lg font-bold">{meeting?.title}</h1>
          <span className="text-sm text-gray-400">
            {meeting?.language && langLabel[meeting.language]} → 🇰🇷 한국어
          </span>
        </div>
        <div className="flex gap-3 items-center">
          {isActive && (
            <span className="flex items-center gap-2 text-red-400 text-sm">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              통역 중
            </span>
          )}
          <button onClick={() => document.documentElement.requestFullscreen()}>
            <Maximize2 className="w-5 h-5 text-gray-400 hover:text-white" />
          </button>
        </div>
      </header>

      {/* 번역 패널 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 원문 */}
        <div className="flex-1 overflow-y-auto p-4 border-r border-gray-800">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">원문</h2>
          {items.map(item => (
            <div key={item.id} className="mb-4 p-3 rounded-lg bg-gray-900">
              <div className="text-xs text-gray-500 mb-1">
                {new Date(item.timestamp).toLocaleTimeString('ko-KR')}
              </div>
              <p className="text-white">{item.original}</p>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* 번역 */}
        <div className="flex-1 overflow-y-auto p-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">🇰🇷 한국어 번역</h2>
          {items.map(item => (
            <div key={item.id} className="mb-4 p-3 rounded-lg bg-blue-950 border border-blue-800">
              <div className="text-xs text-blue-400 mb-1">
                {new Date(item.timestamp).toLocaleTimeString('ko-KR')}
              </div>
              <p className="text-blue-50 text-lg leading-relaxed">{item.translated}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 컨트롤 바 */}
      <div className="flex justify-center items-center gap-4 py-6 bg-gray-900 border-t border-gray-800">
        {!isActive ? (
          <button
            onClick={start}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 px-8 py-3 rounded-full font-semibold transition-colors"
          >
            <Mic className="w-5 h-5" />
            통역 시작
          </button>
        ) : (
          <button
            onClick={stop}
            className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-8 py-3 rounded-full font-semibold transition-colors"
          >
            <MicOff className="w-5 h-5" />
            통역 종료
          </button>
        )}
      </div>
    </div>
  );
}
```

---

## 4. 환경변수 설정

```bash
# backend/.env
PORT=3001
DATABASE_URL="postgresql://postgres:password123@localhost:5432/multimeet"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_EXPIRES_IN="1h"
REFRESH_TOKEN_EXPIRES_IN="7d"
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."
FRONTEND_URL="http://localhost:3000"
UPLOAD_DIR="./uploads"

# frontend/.env
VITE_API_URL="http://localhost:3001"
```

---

## 5. 실행 및 테스트

```bash
# 1. DB 실행
docker-compose up -d

# 2. DB 마이그레이션
cd backend && npx prisma migrate dev

# 3. 백엔드 개발 서버
npm run dev

# 4. 프론트엔드 개발 서버 (새 터미널)
cd frontend && npm run dev

# 5. 접속
# 프론트엔드: http://localhost:3000
# 백엔드: http://localhost:3001
# Prisma Studio: cd backend && npx prisma studio
```

---

## 6. 핵심 구현 순서 (추천 작업 순서)

```
Week 1:
  Day 1-2: 초기 설정 (T-01-01 ~ T-01-05)
  Day 3-4: 인증 구현 (T-02-01, T-02-02)
  Day 5:   회의 CRUD (T-03-01, T-03-02)

Week 2:
  Day 1-2: 오디오 녹음 (T-04-01, T-04-02, T-04-03)
  Day 3:   Whisper STT (T-04-04, T-04-05)
  Day 4-5: Claude 회의록 생성 (T-04-07, T-04-08)

Week 3:
  Day 1-2: WebSocket 서버 (T-05-01)
  Day 3-4: 실시간 통역 (T-05-02, T-05-03, T-05-04)
  Day 5:   회의록 내보내기 (T-04-09)

Week 4:
  Day 1-2: 설정, 회의 목록 완성
  Day 3-4: UI 반응형, 에러처리
  Day 5:   테스트, 배포 준비
```

---

## 7. 자주 발생하는 이슈 및 해결책

| 이슈 | 원인 | 해결 |
|------|------|------|
| 마이크 접근 거부 | HTTPS 아닌 환경 | localhost는 허용, 배포 시 HTTPS 필수 |
| Whisper API 25MB 초과 | 긴 회의 녹음 | ffmpeg으로 10분 단위 분할 후 병합 |
| 번역 지연 3초 이상 | 청크가 너무 큰 경우 | 2~3초 단위로 줄이기 |
| WebSocket 재연결 실패 | 토큰 만료 | Refresh Token으로 갱신 후 재연결 |
| 중국어 인식 오류 | Whisper 언어 힌트 누락 | `language: 'zh'` 명시 |

---

*이 Implement 문서를 기반으로 각 모듈을 순서대로 구현하면 완성된 MultiMeet 시스템이 만들어진다.*

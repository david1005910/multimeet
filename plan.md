# MultiMeet — Plan (기술 아키텍처 및 개발 계획)

> 시스템 아키텍처 설계, 기술 스택 선정 근거, 개발 로드맵

---

## 1. 기술 스택 (Technology Stack)

### 1.1 프론트엔드 (Frontend)

| 기술 | 버전 | 선정 이유 |
|------|------|-----------|
| React | 18.x | 컴포넌트 기반, 실시간 상태 관리 용이 |
| TypeScript | 5.x | 타입 안전성, 유지보수성 향상 |
| Vite | 5.x | 빠른 개발 서버, HMR |
| TailwindCSS | 3.x | 빠른 UI 개발, 반응형 |
| shadcn/ui | latest | 고품질 접근성 컴포넌트 |
| Zustand | 4.x | 경량 전역 상태 관리 |
| React Query | 5.x | 서버 상태 관리, 캐싱 |
| Socket.io-client | 4.x | WebSocket 실시간 통신 |
| React Router | 6.x | SPA 라우팅 |
| React-markdown | latest | 회의록 마크다운 렌더링 |

### 1.2 백엔드 (Backend)

| 기술 | 버전 | 선정 이유 |
|------|------|-----------|
| Node.js | 20.x LTS | JavaScript 풀스택, 비동기 I/O 강점 |
| Express | 4.x | 경량 서버, 미들웨어 생태계 |
| TypeScript | 5.x | 타입 안전성 |
| Socket.io | 4.x | WebSocket 서버, 방 관리 |
| Multer | latest | 멀티파트 파일 업로드 |
| Bull | 4.x | 음성처리 작업 큐 (Redis 기반) |
| JWT | 9.x | 인증 토큰 |
| bcrypt | latest | 비밀번호 해싱 |
| Prisma | 5.x | ORM, DB 스키마 관리 |

### 1.3 데이터베이스 & 스토리지

| 기술 | 용도 |
|------|------|
| PostgreSQL 15 | 회의, 사용자, 회의록 데이터 |
| Redis 7 | 세션 캐시, Bull 작업 큐 |
| 로컬 파일시스템 | 음성 파일 임시 저장 (프로덕션: S3) |

### 1.4 외부 API

| API | 용도 | 모델 |
|-----|------|------|
| OpenAI Whisper API | 다국어 STT | whisper-1 |
| Anthropic Claude API | 번역, 회의록 생성 | claude-sonnet-4-20250514 |

### 1.5 개발 도구

| 도구 | 용도 |
|------|------|
| Docker + Docker Compose | 로컬 개발 환경 |
| ESLint + Prettier | 코드 품질 |
| Jest + Vitest | 테스트 |
| GitHub Actions | CI/CD |

---

## 2. 시스템 아키텍처 (System Architecture)

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT (Browser)                          │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  React SPA  │  │  MediaRecorder│  │  WebSocket Client│   │
│  │  (Vite)     │  │  (Audio API) │  │  (Socket.io)     │   │
│  └──────┬──────┘  └──────┬───────┘  └────────┬─────────┘   │
└─────────┼────────────────┼───────────────────┼─────────────┘
          │ HTTPS           │ HTTP/Multipart     │ WSS
          ▼                 ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND SERVER (Node.js + Express)        │
│                                                             │
│  ┌──────────────┐  ┌─────────────┐  ┌──────────────────┐  │
│  │  REST API    │  │  File Upload│  │  WebSocket Server │  │
│  │  Router      │  │  (Multer)   │  │  (Socket.io)      │  │
│  └──────┬───────┘  └──────┬──────┘  └────────┬─────────┘  │
│         │                 │                   │             │
│  ┌──────▼─────────────────▼───────────────────▼──────────┐ │
│  │                  Service Layer                         │ │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  │ │
│  │  │ AuthService │  │ AudioService │  │ MeetingService│  │ │
│  │  └─────────────┘  └──────┬───────┘  └──────┬───────┘  │ │
│  │                          │                  │          │ │
│  │  ┌───────────────────────▼──────────────────▼───────┐  │ │
│  │  │              AIService                           │  │ │
│  │  │  ┌──────────────────┐  ┌──────────────────────┐  │  │ │
│  │  │  │  WhisperService  │  │   ClaudeService      │  │  │ │
│  │  │  │  (STT)           │  │   (Translation/Min.) │  │  │ │
│  │  │  └────────┬─────────┘  └──────────┬───────────┘  │  │ │
│  │  └───────────┼──────────────────────┼──────────────┘  │ │
│  └──────────────┼──────────────────────┼─────────────────┘ │
│                 │                      │                    │
│  ┌──────────────▼──┐  ┌───────────────▼────────────────┐  │
│  │   Bull Queue    │  │         Prisma ORM             │  │
│  │   (Job Queue)   │  │         (PostgreSQL)           │  │
│  └──────────────┬──┘  └────────────────────────────────┘  │
└─────────────────┼───────────────────────────────────────────┘
                  │
          ┌───────▼───────┐
          │  External APIs │
          │  ┌───────────┐ │
          │  │  Whisper  │ │
          │  │  API      │ │
          │  ├───────────┤ │
          │  │  Claude   │ │
          │  │  API      │ │
          │  └───────────┘ │
          └───────────────┘
```

---

## 3. 데이터베이스 스키마 (Database Schema)

```sql
-- 사용자
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       VARCHAR(255) UNIQUE NOT NULL,
  password    VARCHAR(255) NOT NULL,
  name        VARCHAR(100),
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

-- 회의
CREATE TABLE meetings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  title         VARCHAR(255) NOT NULL,
  company       VARCHAR(255),
  language      VARCHAR(10) NOT NULL, -- 'en', 'zh', 'vi'
  mode          VARCHAR(20) NOT NULL,  -- 'minutes', 'interpret'
  status        VARCHAR(20) DEFAULT 'preparing', -- preparing, in_progress, completed
  participants  TEXT[],
  audio_path    VARCHAR(500),
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW(),
  deleted_at    TIMESTAMP -- soft delete
);

-- 트랜스크립트
CREATE TABLE transcripts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id  UUID REFERENCES meetings(id) ON DELETE CASCADE,
  segments    JSONB NOT NULL, -- [{id, start, end, text, speaker}]
  raw_text    TEXT,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- 회의록
CREATE TABLE minutes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id  UUID REFERENCES meetings(id) ON DELETE CASCADE,
  content     TEXT NOT NULL, -- Markdown
  edited_at   TIMESTAMP,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

-- 실시간 통역 기록
CREATE TABLE interpret_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id  UUID REFERENCES meetings(id) ON DELETE CASCADE,
  timestamp   DECIMAL NOT NULL,
  original    TEXT NOT NULL,
  translated  TEXT NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- 사용자 설정
CREATE TABLE user_settings (
  user_id             UUID PRIMARY KEY REFERENCES users(id),
  default_language    VARCHAR(10) DEFAULT 'en',
  auto_delete_audio   BOOLEAN DEFAULT FALSE,
  minutes_template    VARCHAR(50) DEFAULT 'standard',
  updated_at          TIMESTAMP DEFAULT NOW()
);
```

---

## 4. 실시간 통역 파이프라인 상세 (Real-time Interpretation Pipeline)

```
브라우저                    서버                    외부 API
   │                         │                         │
   │── 마이크 오디오 시작 ──▶│                         │
   │                         │                         │
   │ 3초마다 청크 전송        │                         │
   │── AudioChunk(Base64) ──▶│                         │
   │                         │── POST /audio ─────────▶│ Whisper
   │                         │◀─ {text: "Hello..."} ───│
   │                         │                         │
   │                         │── stream messages ─────▶│ Claude
   │                         │◀── SSE 스트리밍 ─────── │
   │                         │                         │
   │◀─ WebSocket 번역결과 ───│                         │
   │  {original, translated} │                         │
   │                         │                         │
   │ UI 즉시 업데이트         │                         │
```

**청크 처리 전략:**
- **VAD (Voice Activity Detection)**: 묵음 구간을 감지하여 자연스러운 문장 단위로 분할
- **오버랩**: 문맥 연속성을 위해 이전 청크의 마지막 0.5초를 다음 청크에 포함
- **병렬 처리**: 현재 청크 Whisper 처리 중에 이전 번역 결과는 UI에 표시

---

## 5. 회의록 생성 파이프라인 (Minutes Generation Pipeline)

```
1. 음성 파일 수신
   └─▶ Multer로 /tmp/uploads에 저장

2. Whisper STT 처리
   └─▶ 파일 크기 체크 (25MB 제한)
       ├─ 25MB 이하: 직접 API 호출
       └─ 25MB 초과: ffmpeg으로 10분 단위 분할 → 순차 처리 → 병합

3. 트랜스크립트 저장 (DB)

4. Claude API로 회의록 생성
   └─▶ 시스템 프롬프트: 한국어 회의록 형식 지시
   └─▶ 사용자 프롬프트: 전체 트랜스크립트 + 회의 메타데이터
   └─▶ 스트리밍 응답 → WebSocket으로 프론트에 전달

5. 회의록 DB 저장

6. 음성 파일 삭제 (설정에 따라)
```

---

## 6. 프론트엔드 구조 (Frontend Architecture)

```
src/
├── app/
│   ├── App.tsx
│   ├── router.tsx
│   └── providers.tsx
├── pages/
│   ├── Login.tsx
│   ├── Register.tsx
│   ├── Dashboard.tsx
│   ├── NewMeeting.tsx
│   ├── MinutesMode.tsx        ← Mode A
│   ├── InterpretMode.tsx      ← Mode B
│   ├── MinutesViewer.tsx
│   ├── MeetingList.tsx
│   └── Settings.tsx
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── Layout.tsx
│   ├── audio/
│   │   ├── AudioRecorder.tsx  ← 녹음 컨트롤
│   │   ├── WaveformVisualizer.tsx
│   │   └── AudioUploader.tsx
│   ├── meeting/
│   │   ├── MeetingCard.tsx
│   │   ├── MeetingForm.tsx
│   │   └── LanguageSelector.tsx
│   ├── minutes/
│   │   ├── MinutesEditor.tsx
│   │   ├── MinutesRenderer.tsx
│   │   └── DownloadButton.tsx
│   └── interpret/
│       ├── TranslationPanel.tsx
│       └── TranslationItem.tsx
├── hooks/
│   ├── useAudioRecorder.ts
│   ├── useWebSocket.ts
│   ├── useMeetings.ts
│   └── useAuth.ts
├── stores/
│   ├── authStore.ts
│   ├── meetingStore.ts
│   └── interpretStore.ts
├── services/
│   ├── api.ts                 ← Axios 인스턴스
│   ├── authApi.ts
│   ├── meetingApi.ts
│   └── socketService.ts
└── types/
    ├── meeting.ts
    ├── user.ts
    └── api.ts
```

---

## 7. 백엔드 구조 (Backend Architecture)

```
src/
├── app.ts                     ← Express 앱 설정
├── server.ts                  ← HTTP + WebSocket 서버 시작
├── routes/
│   ├── auth.routes.ts
│   ├── meetings.routes.ts
│   ├── audio.routes.ts
│   └── settings.routes.ts
├── controllers/
│   ├── auth.controller.ts
│   ├── meetings.controller.ts
│   ├── audio.controller.ts
│   └── minutes.controller.ts
├── services/
│   ├── auth.service.ts
│   ├── meeting.service.ts
│   ├── whisper.service.ts     ← OpenAI Whisper 연동
│   ├── claude.service.ts      ← Claude API 연동
│   ├── audio.service.ts       ← 파일 처리, 분할
│   └── minutes.service.ts
├── socket/
│   ├── socketHandler.ts       ← WebSocket 이벤트 관리
│   └── interpretSession.ts    ← 실시간 통역 세션
├── queues/
│   ├── audioQueue.ts          ← Bull 작업 큐
│   └── workers/
│       └── transcribeWorker.ts
├── middleware/
│   ├── auth.middleware.ts
│   ├── error.middleware.ts
│   └── upload.middleware.ts
├── prisma/
│   └── schema.prisma
└── utils/
    ├── jwt.ts
    ├── prompts.ts             ← Claude 프롬프트 템플릿
    └── audioSplitter.ts
```

---

## 8. Claude 프롬프트 설계 (Prompt Engineering)

### 8.1 회의록 생성 프롬프트

```
[System]
당신은 전문 비서입니다. 주어진 회의 트랜스크립트를 바탕으로
한국어로 구조화된 비즈니스 회의록을 작성합니다.

규칙:
1. 모든 내용은 한국어로 작성
2. 비즈니스 전문 용어 유지
3. 숫자, 날짜, 제품명은 정확하게 기재
4. 지정된 마크다운 형식 준수
5. 중요한 결정사항과 Action Item을 반드시 추출

[User]
다음 정보로 회의록을 작성해주세요:

회의명: {title}
일시: {datetime}
원본 언어: {language}
참석자: {participants}

회의 트랜스크립트:
{transcript}
```

### 8.2 실시간 번역 프롬프트

```
[System]
당신은 전문 통역사입니다.
입력된 {language} 텍스트를 자연스러운 한국어로 번역합니다.

규칙:
1. 비즈니스 맥락을 고려한 자연스러운 번역
2. 기술 용어는 한국 비즈니스에서 통용되는 표현 사용
3. 번역문만 출력 (설명 없이)
4. 원문의 뉘앙스와 톤 유지

[User]
{original_text}
```

---

## 9. 개발 환경 설정 (Development Setup)

### Docker Compose 구성
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: multimeet
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports: ["5432:5432"]
  
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
  
  backend:
    build: ./backend
    ports: ["3001:3001"]
    depends_on: [postgres, redis]
    environment:
      DATABASE_URL: postgresql://postgres:password@postgres:5432/multimeet
      REDIS_URL: redis://redis:6379
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
  
  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    depends_on: [backend]
```

---

## 10. 개발 로드맵 (Development Roadmap)

### Phase 1: 기반 구축 (1~2주)
- [ ] 프로젝트 초기 셋업 (모노레포 구조)
- [ ] DB 스키마, Prisma 설정
- [ ] 사용자 인증 (회원가입/로그인)
- [ ] 기본 UI 레이아웃 (사이드바, 라우팅)
- [ ] 회의 CRUD API

### Phase 2: 핵심 기능 A (2~3주)
- [ ] 브라우저 음성 녹음 컴포넌트
- [ ] 파일 업로드 API
- [ ] Whisper STT 통합
- [ ] Claude 회의록 생성 (스트리밍)
- [ ] 회의록 뷰어/에디터

### Phase 3: 핵심 기능 B (1~2주)
- [ ] WebSocket 서버 설정
- [ ] 실시간 오디오 청크 전송
- [ ] VAD 구현
- [ ] 실시간 번역 UI

### Phase 4: 완성도 (1주)
- [ ] PDF/DOCX 내보내기
- [ ] 회의 목록/검색
- [ ] 설정 페이지
- [ ] 에러 처리, 로딩 상태
- [ ] 반응형 디자인

### Phase 5: 배포 및 안정화
- [ ] Docker 프로덕션 설정
- [ ] 환경변수 관리
- [ ] 로그 모니터링
- [ ] 성능 최적화

---

*이 Plan 문서는 구현 전 아키텍처 검토의 기준이 된다.*

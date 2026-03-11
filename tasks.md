# MultiMeet — Tasks (개발 태스크 목록)

> 각 기능을 구현하기 위한 구체적이고 실행 가능한 태스크 목록
> 각 태스크는 1~4시간 내 완료 가능한 단위로 분해

---

## 태스크 상태 범례
- `[ ]` 대기
- `[x]` 완료
- `[~]` 진행중
- `[!]` 블로킹됨

---

## EPIC-01: 프로젝트 초기 설정

### T-01-01: 모노레포 프로젝트 구조 생성
- [ ] 루트 디렉토리 생성: `multimeet/`
- [ ] `frontend/`, `backend/` 폴더 생성
- [ ] 루트 `package.json` (워크스페이스 설정)
- [ ] `.gitignore`, `.env.example` 작성
- [ ] `README.md` 기본 내용 작성

### T-01-02: 백엔드 초기 설정
- [ ] `cd backend && npm init -y`
- [ ] TypeScript, Express, 필수 패키지 설치
  ```bash
  npm i express cors dotenv jsonwebtoken bcryptjs multer socket.io bull
  npm i -D typescript @types/node @types/express ts-node nodemon
  ```
- [ ] `tsconfig.json` 설정
- [ ] `src/app.ts`, `src/server.ts` 기본 구조 작성
- [ ] `nodemon.json` 개발 서버 설정

### T-01-03: 프론트엔드 초기 설정
- [ ] `npm create vite@latest frontend -- --template react-ts`
- [ ] TailwindCSS, shadcn/ui 설치 및 설정
  ```bash
  npm i tailwindcss @tailwindcss/typography
  npm i @tanstack/react-query zustand react-router-dom
  npm i socket.io-client axios
  npm i react-markdown lucide-react
  ```
- [ ] `src/app/router.tsx` 기본 라우팅 설정
- [ ] 기본 레이아웃 컴포넌트 작성

### T-01-04: 데이터베이스 설정
- [ ] Prisma 설치: `npm i prisma @prisma/client`
- [ ] `prisma/schema.prisma` 스키마 작성 (users, meetings, transcripts, minutes, interpret_logs, user_settings)
- [ ] `npx prisma migrate dev --name init`
- [ ] Seed 데이터 스크립트 작성 (테스트용 계정)

### T-01-05: Docker Compose 개발 환경 설정
- [ ] `docker-compose.yml` 작성 (PostgreSQL, Redis)
- [ ] `docker-compose up -d` 로 DB 실행 확인
- [ ] 환경변수 `.env` 파일 작성
  ```
  DATABASE_URL=postgresql://...
  REDIS_URL=redis://...
  JWT_SECRET=...
  OPENAI_API_KEY=...
  ANTHROPIC_API_KEY=...
  ```

---

## EPIC-02: 사용자 인증 (Authentication)

### T-02-01: 백엔드 인증 API
- [ ] `src/routes/auth.routes.ts` 작성
- [ ] `src/controllers/auth.controller.ts` 작성
- [ ] `src/services/auth.service.ts` 구현
  - `register(email, password, name)` → JWT 반환
  - `login(email, password)` → JWT 반환
  - `refreshToken(token)` → 새 Access Token
- [ ] `src/middleware/auth.middleware.ts` JWT 검증 미들웨어
- [ ] API 테스트 (Postman/Thunder Client)

### T-02-02: 프론트엔드 인증 UI
- [ ] `src/pages/Login.tsx` 로그인 폼
  - 이메일, 비밀번호 입력
  - 에러 메시지 표시
  - 로딩 상태
- [ ] `src/pages/Register.tsx` 회원가입 폼
- [ ] `src/stores/authStore.ts` Zustand 인증 상태 관리
- [ ] `src/hooks/useAuth.ts` 인증 훅
- [ ] `src/services/authApi.ts` API 호출 함수
- [ ] Protected Route 설정 (미로그인 시 /login 리다이렉트)
- [ ] 토큰 자동 갱신 로직 (Axios Interceptor)

---

## EPIC-03: 회의 관리 (Meeting Management)

### T-03-01: 백엔드 회의 CRUD API
- [ ] `src/routes/meetings.routes.ts` 작성
- [ ] `src/controllers/meetings.controller.ts` 작성
- [ ] `src/services/meeting.service.ts` 구현
  - `createMeeting(userId, data)` → Meeting
  - `getMeetings(userId, filters)` → Meeting[]
  - `getMeetingById(id, userId)` → Meeting
  - `updateMeeting(id, data)` → Meeting
  - `deleteMeeting(id)` → void (소프트 삭제)

### T-03-02: 새 회의 생성 UI
- [ ] `src/pages/NewMeeting.tsx` 작성
- [ ] `src/components/meeting/MeetingForm.tsx` 작성
  - 회의명 입력
  - 상대방 회사명 입력
  - 언어 선택 (영어/중국어/베트남어) 라디오 버튼
  - 모드 선택 (회의록/실시간 통역) 카드 선택
  - 참석자 추가 (동적 입력 필드)
- [ ] `src/components/meeting/LanguageSelector.tsx` (국기 아이콘 포함)
- [ ] 폼 제출 → 해당 모드 페이지로 이동

### T-03-03: 대시보드 UI
- [ ] `src/pages/Dashboard.tsx` 작성
  - 최근 회의 5개 카드
  - 통계 (총 회의수, 언어별 분포)
  - 새 회의 시작 CTA 버튼
- [ ] `src/components/meeting/MeetingCard.tsx`
  - 회의명, 언어, 날짜, 상태 표시
  - 회의록 보기 / 삭제 버튼

### T-03-04: 회의 목록 UI
- [ ] `src/pages/MeetingList.tsx`
  - 테이블 뷰
  - 검색 입력창 (회의명, 키워드)
  - 필터: 언어별, 날짜 범위별
  - 페이지네이션
- [ ] `src/hooks/useMeetings.ts` React Query 훅

---

## EPIC-04: Mode A — 회의록 모드

### T-04-01: 음성 녹음 컴포넌트
- [ ] `src/hooks/useAudioRecorder.ts` 작성
  ```typescript
  interface UseAudioRecorder {
    isRecording: boolean;
    isPaused: boolean;
    duration: number;       // 초
    audioLevel: number;     // 0-100
    start: () => void;
    pause: () => void;
    resume: () => void;
    stop: () => Promise<Blob>;
  }
  ```
- [ ] `MediaRecorder API` 사용 (WebM/Opus 포맷)
- [ ] 인터넷 끊겨도 녹음 유지 확인

### T-04-02: 녹음 UI 컴포넌트
- [ ] `src/components/audio/AudioRecorder.tsx`
  - 시작/일시정지/재개/종료 버튼
  - 녹음 시간 표시 (MM:SS)
  - 상태 표시 (녹음중 빨간 점 애니메이션)
- [ ] `src/components/audio/WaveformVisualizer.tsx`
  - Canvas API로 실시간 파형 시각화
  - AudioContext → AnalyserNode 사용
- [ ] `src/components/audio/AudioUploader.tsx`
  - 드래그앤드롭 업로드 영역
  - 지원 형식 안내
  - 파일 크기 검증

### T-04-03: 백엔드 파일 업로드 API
- [ ] Multer 설정 (25MB 제한, 파일 형식 검증)
- [ ] `POST /api/meetings/:id/upload` 엔드포인트
- [ ] 파일 저장 경로: `./uploads/{userId}/{meetingId}/`
- [ ] 파일 메타데이터 DB 저장

### T-04-04: Whisper STT 서비스
- [ ] `src/services/whisper.service.ts` 작성
  ```typescript
  class WhisperService {
    async transcribe(audioPath: string, language: string): Promise<Transcript>
    async transcribeLargeFile(audioPath: string, language: string): Promise<Transcript>
    private splitAudio(audioPath: string): Promise<string[]>  // ffmpeg
  }
  ```
- [ ] OpenAI SDK 설치: `npm i openai`
- [ ] 언어 코드 매핑: `en`, `zh`, `vi`
- [ ] 타임스탬프 포함 트랜스크립트 요청 (`response_format: "verbose_json"`)
- [ ] 25MB 초과 파일 자동 분할 (ffmpeg)
- [ ] 오류 처리 (API 한도, 타임아웃)

### T-04-05: STT 작업 큐 구현
- [ ] Bull 큐 설정: `src/queues/audioQueue.ts`
- [ ] `src/queues/workers/transcribeWorker.ts`
  - 파일 수신 → Whisper 처리 → DB 저장 → WebSocket 진행률 전송
- [ ] 진행률 이벤트: `transcribe:progress`, `transcribe:complete`, `transcribe:error`

### T-04-06: 회의록 모드 메인 페이지
- [ ] `src/pages/MinutesMode.tsx` 작성
  - **Step 1**: 녹음/업로드 선택 → 오디오 수집
  - **Step 2**: STT 처리 중 진행률 표시 (`처리중... 45%`)
  - **Step 3**: 트랜스크립트 미리보기 + 수정
  - **Step 4**: 회의록 생성 버튼 → 스트리밍 표시
  - **Step 5**: 완성된 회의록 뷰어
- [ ] WebSocket으로 진행률 수신

### T-04-07: Claude 회의록 생성 서비스
- [ ] `src/services/claude.service.ts` 작성
  ```typescript
  class ClaudeService {
    async generateMinutes(transcript: Transcript, meetingMeta: Meeting): AsyncGenerator<string>
    async translateChunk(text: string, language: string): Promise<string>
  }
  ```
- [ ] Anthropic SDK 설치: `npm i @anthropic-ai/sdk`
- [ ] 스트리밍 응답 구현 (Server-Sent Events → WebSocket)
- [ ] `src/utils/prompts.ts` 프롬프트 템플릿 관리

### T-04-08: 회의록 뷰어/에디터
- [ ] `src/pages/MinutesViewer.tsx`
- [ ] `src/components/minutes/MinutesEditor.tsx`
  - react-markdown 렌더링
  - 편집 모드 전환 (textarea)
  - 자동 저장 (3초 디바운스)
- [ ] `src/components/minutes/DownloadButton.tsx`
  - PDF 다운로드 (백엔드에서 생성)
  - DOCX 다운로드
  - Markdown 다운로드
  - 클립보드 복사

### T-04-09: 문서 내보내기 백엔드
- [ ] PDF 생성: `npm i puppeteer` 또는 `npm i pdfkit`
- [ ] DOCX 생성: `npm i docx`
- [ ] `GET /api/meetings/:id/minutes/download?format=pdf|docx|md` 엔드포인트

---

## EPIC-05: Mode B — 실시간 통역 모드

### T-05-01: WebSocket 서버 설정
- [ ] `src/socket/socketHandler.ts` 작성
  ```typescript
  // 이벤트 목록
  // client → server: 'join-session', 'audio-chunk', 'leave-session'
  // server → client: 'translation-result', 'error'
  ```
- [ ] Socket.io 방(room) 기반 세션 관리
- [ ] JWT 인증 미들웨어 (Socket.io)
- [ ] 연결/해제 로그

### T-05-02: 실시간 오디오 전송 훅
- [ ] `src/hooks/useRealtimeAudio.ts` 작성
  ```typescript
  interface UseRealtimeAudio {
    isActive: boolean;
    start: () => void;
    stop: () => void;
    chunks: TranslationChunk[];
  }
  ```
- [ ] `AudioWorkletProcessor` 또는 `ScriptProcessorNode`로 오디오 수집
- [ ] 3초 단위 청크 분할
- [ ] VAD (Voice Activity Detection) 구현
  - 볼륨 임계값 기반 묵음 감지
  - 묵음 후 자연스러운 청크 전송
- [ ] Base64 인코딩 후 WebSocket 전송

### T-05-03: 서버사이드 실시간 처리
- [ ] `src/socket/interpretSession.ts` 작성
  - 오디오 청크 수신 → Whisper → Claude → 클라이언트 전송
  - 동시성 제어 (청크 처리 중 다음 청크 버퍼링)
- [ ] 오디오 청크 임시 파일 처리
- [ ] 오류 시 재시도 로직 (최대 3회)

### T-05-04: 실시간 통역 UI 페이지
- [ ] `src/pages/InterpretMode.tsx` 작성
  - 헤더: 회의명, 언어, 타이머
  - 메인: 듀얼 패널 레이아웃
  - 하단: 컨트롤 바
- [ ] `src/components/interpret/TranslationPanel.tsx`
  - 왼쪽: 원문 패널 (언어 국기 + 텍스트)
  - 오른쪽: 한국어 번역 패널
  - 자동 스크롤 (최신 내용)
- [ ] `src/components/interpret/TranslationItem.tsx`
  - 타임스탬프
  - 원문 텍스트
  - 번역 텍스트
  - 로딩 애니메이션 (번역 중)
- [ ] 컨트롤 버튼: 시작/일시정지/종료/전체화면/글자크기

### T-05-05: 통역 기록 저장 및 전환
- [ ] 통역 세션 종료 시 DB 저장 (`interpret_logs` 테이블)
- [ ] "회의록으로 변환" 버튼 (Mode B → Mode A 전환)
  - 번역 기록을 트랜스크립트로 변환
  - Claude API로 회의록 생성

---

## EPIC-06: 설정 페이지 (Settings)

### T-06-01: 설정 백엔드 API
- [ ] `GET /api/settings` 사용자 설정 조회
- [ ] `PUT /api/settings` 설정 저장

### T-06-02: 설정 UI 페이지
- [ ] `src/pages/Settings.tsx` 작성
  - API 키 입력 (OpenAI, Anthropic) - 마스킹 표시
  - 기본 회의 언어 선택
  - 음성 파일 자동 삭제 토글
  - 오디오 입력 장치 선택 (MediaDevices API)
  - 저장 버튼

---

## EPIC-07: UI/UX 완성도 (Polish)

### T-07-01: 공통 컴포넌트 완성
- [ ] `src/components/layout/Sidebar.tsx` (반응형, 모바일 햄버거 메뉴)
- [ ] `src/components/layout/Header.tsx` (사용자 아바타, 로그아웃)
- [ ] LoadingSpinner, ErrorMessage, EmptyState 컴포넌트
- [ ] Toast 알림 (성공/에러/정보)

### T-07-02: 반응형 디자인
- [ ] 모바일 (< 768px) 레이아웃 확인
  - 사이드바 → 하단 탭 내비게이션
  - 듀얼 패널 → 탭 전환 방식
- [ ] 태블릿 (768px ~ 1024px) 레이아웃 확인

### T-07-03: 키보드 단축키
- [ ] `Space` - 녹음 시작/일시정지
- [ ] `Esc` - 모달 닫기
- [ ] `Ctrl+S` - 회의록 저장

### T-07-04: 에러 처리
- [ ] API 에러 처리 (Axios Interceptor)
- [ ] WebSocket 재연결 로직
- [ ] 파일 업로드 에러 (크기 초과, 형식 오류)
- [ ] Whisper API 오류 (할당량 초과, 타임아웃)
- [ ] 빈 화면/에러 화면 fallback

---

## EPIC-08: 배포 및 최종화

### T-08-01: 프로덕션 빌드 설정
- [ ] 프론트엔드: Vite build 최적화
- [ ] 백엔드: TypeScript 컴파일, PM2 설정
- [ ] `Dockerfile` (프론트엔드, 백엔드)
- [ ] `docker-compose.prod.yml` 작성
- [ ] Nginx 리버스 프록시 설정

### T-08-02: 환경변수 및 보안
- [ ] 프로덕션 환경변수 체크리스트
- [ ] CORS 설정 (허용 도메인 명시)
- [ ] Rate Limiting 설정 (API 남용 방지)
- [ ] 파일 업로드 보안 (파일 타입 검증, 바이러스 스캔 고려)

### T-08-03: 테스트
- [ ] 단위 테스트: WhisperService, ClaudeService
- [ ] 통합 테스트: 회의 생성 → STT → 회의록 생성 전체 플로우
- [ ] E2E 테스트: 로그인 → 새 회의 → 녹음 → 회의록 확인

---

## 태스크 의존성 다이어그램

```
T-01-01 → T-01-02 → T-01-04 → T-02-01 → T-03-01 → T-04-03
                 ↘              ↘
          T-01-03 → T-02-02 → T-03-02 → T-04-06
                                       ↘
T-04-04 → T-04-05 → T-04-07 → T-04-08 → T-04-09
                                         ↓
T-05-01 → T-05-02 → T-05-03 → T-05-04 → T-05-05
```

---

## 예상 작업 시간 요약

| Epic | 태스크 수 | 예상 시간 |
|------|-----------|-----------|
| EPIC-01: 초기 설정 | 5 | 8시간 |
| EPIC-02: 인증 | 2 | 8시간 |
| EPIC-03: 회의 관리 | 4 | 12시간 |
| EPIC-04: 회의록 모드 | 9 | 32시간 |
| EPIC-05: 실시간 통역 | 5 | 20시간 |
| EPIC-06: 설정 | 2 | 4시간 |
| EPIC-07: UI/UX | 4 | 8시간 |
| EPIC-08: 배포 | 3 | 8시간 |
| **합계** | **34** | **~100시간** |

---

*각 태스크는 독립적으로 브랜치를 생성하고 PR로 병합한다.*
*완료 기준: 기능 동작 확인 + 기본 에러 처리 + 타입 오류 없음*

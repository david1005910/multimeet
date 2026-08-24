import { Server, Socket } from 'socket.io';
import { verifyToken } from '../utils/jwt';
import { llmService } from '../services/llm.service';
import { whisperService } from '../services/whisper.service';
import prisma from '../utils/prisma';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// ──────────────────────────────────────────
// Whisper 환각(hallucination) 필터
// ──────────────────────────────────────────

// 1) 부분 문자열 포함 시 환각으로 판정 (normalize 후 공백 제거 비교)
const HALLUCINATION_SUBSTRINGS = [
  // 시청/감사 계열
  '시청해주셔서감사합니다',
  '시청해주셔서감사',
  '봐주셔서감사합니다',
  '봐주셔서감사',
  // 구독 계열
  '구독과좋아요',
  '구독해주세요',
  '좋아요와구독',
  '좋아요구독',
  '알림설정',
  // YouTube 마무리 계열
  '다음영상에서만나요',
  '다음영상에서뵙겠습니다',
  '여기까지입니다',
  '영상은여기까지',
  '이번영상은여기서',
  '다음번에또만나요',
  '다음에또만나요',
  '다음시간에만나요',
  // 영어
  'thank you for watching',
  'thanks for watching',
  'see you in the next video',
  'see you next time',
  'until next time',
  'please subscribe',
  'like and subscribe',
  'don\'t forget to subscribe',
  // 중국어 (Whisper 환각 패턴)
  '谢谢观看',
  '感谢观看',
  '感谢您的观看',
  '请订阅',
  '别忘了订阅',
  '点赞订阅',
  '下期再见',
  '我们下期见',
  '记得关注',
  '字幕by',
  '字幕组',
];

// 2) 두 키워드가 동시에 등장하면 환각으로 판정
const HALLUCINATION_PAIRS: [string, string][] = [
  ['시청', '감사합니다'],
  ['시청', '감사해요'],
  ['영상', '감사합니다'],
  ['영상', '봐주'],
  ['영상', '여기까지'],
  ['다음', '영상'],
  ['다음', '만나요'],
  ['다음', '뵙겠습니다'],
  ['여기까지', '만나요'],
  ['구독', '좋아요'],
  ['구독', '감사'],
  // 중국어 쌍
  ['谢谢', '观看'],
  ['感谢', '观看'],
  ['下期', '再见'],
  ['记得', '订阅'],
  ['点赞', '关注'],
];

function normalize(text: string): string {
  return text.replace(/\s+/g, '').toLowerCase();
}

function isHallucination(text: string): boolean {
  const raw = text.trim();
  if (raw.length < 2) return true;

  const norm = normalize(raw);
  const lower = raw.toLowerCase();

  // 부분 문자열 검사
  if (HALLUCINATION_SUBSTRINGS.some((h) => norm.includes(normalize(h)))) return true;

  // 키워드 쌍 검사
  if (HALLUCINATION_PAIRS.some(([a, b]) => lower.includes(a) && lower.includes(b))) return true;

  return false;
}

// ──────────────────────────────────────────
// 소켓별 최근 전사 캐시 (중복 방지)
// ──────────────────────────────────────────
const RECENT_CACHE_SIZE = 3;
const recentTranscripts = new Map<string, string[]>(); // socketId → last N texts

function isDuplicate(socketId: string, text: string): boolean {
  const norm = normalize(text);
  const history = recentTranscripts.get(socketId) || [];
  if (history.some((h) => normalize(h) === norm)) return true;

  // 캐시 갱신
  history.push(text);
  if (history.length > RECENT_CACHE_SIZE) history.shift();
  recentTranscripts.set(socketId, history);
  return false;
}

// ──────────────────────────────────────────

export function setupSocketHandlers(io: Server): void {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    const user = verifyToken(token);
    if (!user) return next(new Error('인증 실패'));
    (socket as any).userId = user.id;
    next();
  });

  io.on('connection', (socket: Socket) => {
    console.log(`[Socket] 연결: ${socket.id}`);

    socket.on('join-session', async (meetingId: string) => {
      // 세션 소유자만 참여 가능 (다른 사용자의 STT 결과 도청 방지)
      const owned = await prisma.meeting.findFirst({
        where: { id: meetingId, userId: (socket as any).userId, deletedAt: null },
      });
      if (!owned) {
        socket.emit('translation-error', { message: '세션에 참여할 권한이 없습니다.' });
        return;
      }
      socket.join(meetingId);
      console.log(`[Socket] ${socket.id} → 세션 ${meetingId} 참여`);
    });

    socket.on('audio-chunk', async (data: {
      meetingId: string;
      language: string;
      audioBase64: string;
      timestamp: number;
      targetLanguage?: string;
    }) => {
      try {
        if (!data || typeof data.meetingId !== 'string' || typeof data.audioBase64 !== 'string' || !data.audioBase64) {
          return;
        }
        // /tmp 하드코딩은 Windows exe에서 깨지므로 OS 임시 폴더를 사용한다
        const tmpDir = os.tmpdir();
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

        const tmpPath = path.join(tmpDir, `chunk-${uuidv4()}.webm`);
        const audioBuffer = Buffer.from(data.audioBase64, 'base64');
        fs.writeFileSync(tmpPath, audioBuffer);

        let transcript;
        try {
          transcript = await whisperService.transcribe(tmpPath, data.language);
        } finally {
          // Whisper 실패 시에도 청크 파일이 남지 않도록 한다
          try { fs.unlinkSync(tmpPath); } catch { /* already removed */ }
        }

        if (!transcript.rawText.trim()) return;

        // no_speech_prob > 0.7 → Whisper 자체가 무음으로 판단 (3초 청크는 일부 침묵 포함 가능)
        if (transcript.avgNoSpeechProb > 0.7) {
          console.log(`[Socket] 무음 필터 (no_speech_prob=${transcript.avgNoSpeechProb.toFixed(2)}): "${transcript.rawText.trim()}"`);
          return;
        }

        if (isHallucination(transcript.rawText)) {
          console.log(`[Socket] 환각 필터: "${transcript.rawText.trim()}"`);
          return;
        }
        if (isDuplicate(socket.id, transcript.rawText)) {
          console.log(`[Socket] 중복 필터: "${transcript.rawText.trim()}"`);
          return;
        }

        if (data.language === 'ko') {
          const lang = data.targetLanguage || 'zh';
          const translated = await llmService.translateFromKorean(transcript.rawText, lang);
          socket.emit('translation-result', {
            timestamp: data.timestamp,
            original: transcript.rawText,
            translated,
            targetLanguage: lang,
            meetingId: data.meetingId,
          });
        } else {
          const translated = await llmService.translate(transcript.rawText, data.language);
          socket.emit('translation-result', {
            timestamp: data.timestamp,
            original: transcript.rawText,
            translated,
            meetingId: data.meetingId,
          });
        }
      } catch (error: any) {
        console.error('[Socket] 처리 오류:', error);
        socket.emit('translation-error', { message: '번역 처리 중 오류가 발생했습니다.' });
      }
    });

    socket.on('leave-session', (meetingId: string) => {
      socket.leave(meetingId);
      recentTranscripts.delete(socket.id);
    });

    socket.on('disconnect', () => {
      recentTranscripts.delete(socket.id);
      console.log(`[Socket] 해제: ${socket.id}`);
    });
  });
}

import WebSocket from 'ws';

/**
 * Deepgram 실시간 스트리밍 STT 세션.
 * 브라우저에서 온 16kHz mono PCM16 오디오를 Deepgram WebSocket으로 흘려보내고,
 * 중간 결과(interim)와 문장 단위 최종 결과(final)를 콜백으로 돌려준다.
 *
 * 청크 방식(Whisper)과 달리 발화가 끝나자마자(무음 300ms) 텍스트가 나오므로
 * 통역 지연이 수 초 → 1~2초 수준으로 줄어든다.
 */

const API_URL = 'wss://api.deepgram.com/v1/listen';

// 발화 종료 신호(speech_final)가 장시간 오지 않으면(계속 말을 잇는 경우 등) 강제 플러시
const STALE_FLUSH_MS = 8000;
// 누적 텍스트가 이 길이를 넘으면 발화 종료를 기다리지 않고 플러시 (길게 이어 말하는 경우 지연 방지)
const MAX_PENDING_CHARS = 200;
// interim 전송 최소 간격 (클라이언트 렌더링 부담 줄이기)
const INTERIM_THROTTLE_MS = 150;

export interface DeepgramLiveOptions {
  language: string;
  /** 말하는 도중의 임시 텍스트 (화면에 실시간 자막용) */
  onInterim: (text: string) => void;
  /** 문장 단위 확정 텍스트 (번역 파이프라인 입력) */
  onFinal: (text: string) => void;
  onError?: (err: Error) => void;
  onClose?: () => void;
}

export function isDeepgramConfigured(): boolean {
  return !!process.env.DEEPGRAM_API_KEY;
}

export class DeepgramLive {
  private ws: WebSocket | null = null;
  private pending = '';
  private pendingAt = 0;
  private lastPiece = '';
  private lastInterimSent = 0;
  private staleTimer: ReturnType<typeof setInterval>;
  private closedByUs = false;

  constructor(private opts: DeepgramLiveOptions) {
    const key = process.env.DEEPGRAM_API_KEY;
    if (!key) throw new Error('DEEPGRAM_API_KEY가 설정되지 않았습니다.');

    const lang = (opts.language || 'en').split('-')[0].toLowerCase();
    const url =
      `${API_URL}?model=nova-2&language=${encodeURIComponent(lang)}` +
      `&smart_format=true&interim_results=true&endpointing=300` +
      `&encoding=linear16&sample_rate=16000&channels=1`;

    this.ws = new WebSocket(url, { headers: { Authorization: `Token ${key}` } });

    this.ws.on('open', () => {
      console.log(`[Deepgram] 스트림 시작 (${lang})`);
    });

    this.ws.on('message', (raw: WebSocket.RawData) => {
      try {
        this.handleMessage(JSON.parse(raw.toString()));
      } catch { /* 파싱 실패한 프레임은 무시 */ }
    });

    this.ws.on('error', (err: Error) => {
      console.error('[Deepgram] 오류:', err.message);
      this.opts.onError?.(err);
    });

    this.ws.on('close', () => {
      clearInterval(this.staleTimer);
      if (!this.closedByUs) this.opts.onClose?.();
    });

    this.staleTimer = setInterval(() => {
      if (this.pending && Date.now() - this.pendingAt > STALE_FLUSH_MS) {
        this.flushPending();
      }
    }, 2000);
  }

  /** 브라우저에서 받은 PCM16 16kHz mono 청크 전달 */
  send(pcm: Buffer): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(pcm);
    }
  }

  /** 세션 종료: 미처리 텍스트 플러시 후 연결 닫기 */
  finish(): void {
    this.flushPending();
    this.close();
  }

  close(): void {
    this.closedByUs = true;
    clearInterval(this.staleTimer);
    try { this.ws?.close(); } catch { /* noop */ }
    this.ws = null;
  }

  private handleMessage(data: any): void {
    if (data?.type !== 'Results') return;
    const alt = data.channel?.alternatives?.[0];
    const transcript: string = (alt?.transcript || '').trim();
    if (!transcript) return;

    if (data.is_final) {
      // 문장 조각 확정 → 버퍼에 누적
      this.pending = this.pending ? `${this.pending} ${transcript}` : transcript;
      this.lastPiece = transcript;
      this.pendingAt = Date.now();
      if (this.pending.length >= MAX_PENDING_CHARS) {
        // 문장 경계에서 자연 분할된 것으로 보고 즉시 번역 진행
        this.flushPending();
        return;
      }
    } else if (Date.now() - this.lastInterimSent > INTERIM_THROTTLE_MS) {
      this.lastInterimSent = Date.now();
      this.opts.onInterim(this.pending ? `${this.pending} ${transcript}` : transcript);
    }

    if (data.speech_final) {
      // 발화 종료. 드물게 마지막 조각이 is_final 없이 speech_final만 오는 경우를 흡수한다
      if (!this.pending) {
        this.pending = transcript;
      } else if (transcript && transcript !== this.lastPiece) {
        this.pending = `${this.pending} ${transcript}`;
      }
      this.flushPending();
    }
  }

  private flushPending(): void {
    const text = this.pending.trim();
    this.pending = '';
    this.lastPiece = '';
    if (text) {
      this.opts.onInterim('');
      this.opts.onFinal(text);
    }
  }
}

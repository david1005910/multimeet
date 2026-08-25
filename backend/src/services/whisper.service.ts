import { toFile } from 'openai';
import { getOpenAI } from '../utils/openai';
import fs from 'fs';
import path from 'path';

const MIME_MAP: Record<string, string> = {
  '.webm': 'audio/webm',
  '.mp3':  'audio/mpeg',
  '.mp4':  'audio/mp4',
  '.m4a':  'audio/mp4',
  '.wav':  'audio/wav',
  '.ogg':  'audio/ogg',
  '.oga':  'audio/ogg',
  '.flac': 'audio/flac',
};

// gpt-4o-mini-transcribe의 출력 언어를 강하게 유도하는 프롬프트
const FAST_PROMPTS: Record<string, string> = {
  en: 'Business meeting conversation in English.',
  zh: '商务会议对话，使用中文普通话。',
  vi: 'Cuộc họp kinh doanh bằng tiếng Việt.',
};

export interface TranscriptSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

export interface TranscriptResult {
  segments: TranscriptSegment[];
  rawText: string;
  language: string;
  avgNoSpeechProb: number;  // 0~1, 높을수록 무음
}

export class WhisperService {
  async transcribe(audioPath: string, language: string): Promise<TranscriptResult> {
    const stats = fs.statSync(audioPath);
    const fileSizeMB = stats.size / (1024 * 1024);

    // OpenAI Whisper는 25MB 초과 입력을 거부한다. 여기서 걸러 명확한 안내를 준다.
    if (fileSizeMB > 25) {
      throw new Error(
        `오디오 파일이 너무 큽니다 (${fileSizeMB.toFixed(1)}MB). Whisper 최대 허용 용량은 25MB입니다. 오디오를 분할하거나 압축해주세요.`
      );
    }

    return this.transcribeFile(audioPath, language);
  }

  /**
   * 실시간 통역 전용 고속 경로.
   * gpt-4o-mini-transcribe는 whisper-1보다 평균 0.5~1초 빠르지만, 언어 힌트만으로는
   * 출력 언어가 엉뚱하게 정해질 수 있어(영어를 한글 표기로 받아쓰는 등) 언어별
   * 프롬프트로 강하게 유도하고, 그래도 스크립트가 틀리면 whisper-1로 폴백한다.
   * 세그먼트/타임스탬프가 필요 없는 실시간 모드에서만 사용할 것.
   */
  async transcribeFast(audioPath: string, language: string): Promise<TranscriptResult> {
    const ext = path.extname(audioPath).toLowerCase();
    const mimeType = MIME_MAP[ext] || 'audio/webm';
    const fileName = path.basename(audioPath);
    const file = await toFile(fs.createReadStream(audioPath), fileName, { type: mimeType });

    const lang = (language || '').split('-')[0].toLowerCase();
    const response = await getOpenAI().audio.transcriptions.create({
      file,
      model: 'gpt-4o-mini-transcribe',
      language: lang || undefined,
      prompt: FAST_PROMPTS[lang] || FAST_PROMPTS.en,
    });

    let text = (response.text || '').trim();

    // 스크립트 가드: 영어 요청인데 한글/한자가 절반을 넘으면 잘못 받아쓴 것 → whisper-1 폴백
    if (lang === 'en' && text && this.wrongScriptRatio(text) > 0.5) {
      return this.transcribeFile(audioPath, language);
    }

    return { segments: [], rawText: text, language: language, avgNoSpeechProb: 0 };
  }

  /** 한글+한자 등 비라틴 문자 비율 (영어 오검출 감지용) */
  private wrongScriptRatio(text: string): number {
    const letters = text.replace(/[^\p{L}]/gu, '');
    if (!letters.length) return 0;
    const nonLatin = letters.replace(/[\p{Script=Latin}]/gu, '');
    return nonLatin.length / letters.length;
  }

  private async transcribeFile(audioPath: string, language: string): Promise<TranscriptResult> {
    const ext = path.extname(audioPath).toLowerCase();
    const mimeType = MIME_MAP[ext] || 'audio/webm';
    const fileName = path.basename(audioPath);

    // toFile()로 MIME 타입을 명시적으로 지정해야 Whisper가 형식을 인식함
    const file = await toFile(fs.createReadStream(audioPath), fileName, { type: mimeType });

    const response = await getOpenAI().audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language,
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
    });

    const rawSegments = response.segments || [];

    // no_speech_prob 평균 계산 (무음 확률)
    const avgNoSpeechProb = rawSegments.length > 0
      ? rawSegments.reduce((sum, seg) => sum + (seg.no_speech_prob ?? 0), 0) / rawSegments.length
      : 0;

    const segments: TranscriptSegment[] = rawSegments.map((seg, idx) => ({
      id: idx,
      start: seg.start,
      end: seg.end,
      text: seg.text.trim(),
    }));

    return {
      segments,
      rawText: response.text,
      language: response.language || language,
      avgNoSpeechProb,
    };
  }
}

export const whisperService = new WhisperService();

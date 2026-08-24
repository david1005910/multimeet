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

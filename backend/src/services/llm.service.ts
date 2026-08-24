import { buildMinutesPrompt, MeetingMeta, TranscriptData } from '../utils/prompts';

// Google Gemini API (OpenAI 호환 엔드포인트가 아닌 네이티브 REST 사용)
// 키/모델은 모듈 로드 시점이 아닌 호출 시점에 읽는다 (bootstrap/env 로딩 순서에 덜 민감)
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

function getApiKey(): string {
  return process.env.GEMINI_API_KEY || '';
}
function getModel(): string {
  return process.env.GEMINI_MODEL || 'gemini-2.5-flash';
}

// 클라우드라 응답이 빠르지만, 무응답 시 소켓 핸들러가 영구 대기하지 않도록 타임아웃을 건다
const TRANSLATE_TIMEOUT_MS = 30_000;
const MINUTES_TIMEOUT_MS = 600_000;

// gemini-2.5 계열은 기본적으로 "생각" 단계가 켜져 있어 지연이 커진다.
// 모델이 이 필드를 지원하지 않으면 API가 400을 내므로 버전을 확인하고만 보낸다.
function supportsThinkingControl(model: string): boolean {
  return /2\.5/.test(model);
}

interface GenerationOptions {
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
  /** true면 사고(thinking) 비활성화 — 실시간 번역처럼 지연에 민감한 호출용 */
  fast?: boolean;
}

class GeminiClient {
  private requireKey(): string {
    const key = getApiKey();
    if (!key) {
      throw new Error('GEMINI_API_KEY가 설정되지 않았습니다. backend/.env에 키를 추가해주세요.');
    }
    return key;
  }

  private buildBody(system: string | undefined, prompt: string, opts: GenerationOptions) {
    const body: Record<string, unknown> = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: opts.temperature ?? 0.7,
        topP: opts.topP ?? 0.95,
        ...(opts.maxOutputTokens && { maxOutputTokens: opts.maxOutputTokens }),
        ...(opts.fast && supportsThinkingControl(getModel()) && {
          thinkingConfig: { thinkingBudget: 0 },
        }),
      },
    };
    if (system) {
      body.systemInstruction = { parts: [{ text: system }] };
    }
    return body;
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-goog-api-key': this.requireKey(),
    };
  }

  async generate(prompt: string, system?: string, opts: GenerationOptions = {}): Promise<string> {
    const res = await fetch(
      `${API_BASE}/models/${getModel()}:generateContent`,
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(this.buildBody(system, prompt, opts)),
        signal: AbortSignal.timeout(opts.fast ? TRANSLATE_TIMEOUT_MS : MINUTES_TIMEOUT_MS),
      }
    );

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      throw new Error(`Gemini API error ${res.status}: ${detail}`);
    }

    const data = await res.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    return parts.map((p) => p.text ?? '').join('');
  }

  async *generateStream(
    prompt: string,
    system?: string,
    opts: GenerationOptions = {}
  ): AsyncGenerator<string> {
    const res = await fetch(
      `${API_BASE}/models/${getModel()}:streamGenerateContent?alt=sse`,
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(this.buildBody(system, prompt, opts)),
        signal: AbortSignal.timeout(MINUTES_TIMEOUT_MS),
      }
    );

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      throw new Error(`Gemini API error ${res.status}: ${detail}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No reader available');

    // SSE는 라인/멀티바이트가 청크 경계에 걸칠 수 있으므로 버퍼로 이어붙여 파싱한다
    const decoder = new TextDecoder();
    let lineBuffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      lineBuffer += decoder.decode(value, { stream: true });
      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const json = JSON.parse(line.slice(6)) as {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
          };
          const parts = json.candidates?.[0]?.content?.parts ?? [];
          for (const p of parts) {
            if (p.text) yield p.text;
          }
        } catch {
          // 부분 청크 등 파싱 불가한 라인은 건너뛴다
        }
      }
    }

    if (lineBuffer.startsWith('data: ')) {
      try {
        const json = JSON.parse(lineBuffer.slice(6));
        const parts = json.candidates?.[0]?.content?.parts ?? [];
        for (const p of parts) {
          if (p.text) yield p.text;
        }
      } catch {
        // ignore
      }
    }
  }
}

export class LlmService {
  private client = new GeminiClient();

  async *generateMinutes(transcript: TranscriptData, meeting: MeetingMeta): AsyncGenerator<string> {
    const prompt = buildMinutesPrompt(transcript, meeting);
    const system = `당신은 전문 비서입니다. 회의 트랜스크립트를 바탕으로 한국어로 구조화된 비즈니스 회의록을 작성합니다. 반드시 마크다운 형식으로 작성하고, 모든 내용은 한국어로 작성하세요.`;

    try {
      yield* this.client.generateStream(prompt, system, {
        maxOutputTokens: 8192,
      });
    } catch (error) {
      console.error('Gemini minutes generation error:', error);
      yield '회의록 생성 중 오류가 발생했습니다.';
    }
  }

  async translate(text: string, sourceLanguage: string): Promise<string> {
    const langMap: Record<string, string> = {
      en: '영어',
      zh: '중국어',
      vi: '베트남어',
    };
    const langName = langMap[sourceLanguage] || sourceLanguage;
    const system = `당신은 전문 통역사입니다. ${langName} 텍스트를 자연스러운 한국어 비즈니스 표현으로 번역합니다. 번역문만 출력하세요. 설명이나 주석은 포함하지 마세요.`;

    try {
      return await this.client.generate(text, system, { fast: true });
    } catch (error) {
      console.error('Gemini translation error:', error);
      return `[번역 오류] ${text}`;
    }
  }

  async translateFromKorean(text: string, targetLanguage: string): Promise<string> {
    const targetNames: Record<string, string> = {
      en: 'English',
      zh: 'Simplified Chinese',
      vi: 'Vietnamese',
    };
    const langName = targetNames[targetLanguage] || targetLanguage;
    const system = `You are a professional interpreter. Translate the Korean text to ${langName} in a natural business tone. Output only the translation, no explanations.`;

    try {
      return await this.client.generate(text, system, { fast: true });
    } catch (error) {
      console.error('Gemini translation error:', error);
      return `[Translation Error] ${text}`;
    }
  }
}

export const llmService = new LlmService();

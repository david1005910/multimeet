import { buildMinutesPrompt, MeetingMeta, TranscriptData } from '../utils/prompts';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
// 번역/회의록 생성용 모델 (CLAUDE.md 기준 gemma3:4b)
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma3:4b';

// Ollama 무응답 시 소켓 핸들러가 영구 대기하지 않도록 타임아웃을 건다
const TRANSLATE_TIMEOUT_MS = 120_000;
const MINUTES_TIMEOUT_MS = 600_000;

const langMap: Record<string, string> = {
  en: '영어',
  zh: '중국어',
  vi: '베트남어',
};

export class ClaudeService {
  private async callOllama(prompt: string, system?: string): Promise<Response> {
    const fullPrompt = system ? `${system}\n\n${prompt}` : prompt;

    return fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: fullPrompt,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.95,
        }
      }),
      signal: AbortSignal.timeout(TRANSLATE_TIMEOUT_MS),
    });
  }

  private async callOllamaStream(prompt: string, system?: string): Promise<Response> {
    const fullPrompt = system ? `${system}\n\n${prompt}` : prompt;

    return fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: fullPrompt,
        stream: true,
        options: {
          temperature: 0.7,
          top_p: 0.95,
        }
      }),
      signal: AbortSignal.timeout(MINUTES_TIMEOUT_MS),
    });
  }

  async *generateMinutes(transcript: TranscriptData, meeting: MeetingMeta): AsyncGenerator<string> {
    const prompt = buildMinutesPrompt(transcript, meeting);
    const system = `당신은 전문 비서입니다. 회의 트랜스크립트를 바탕으로 한국어로 구조화된 비즈니스 회의록을 작성합니다. 반드시 마크다운 형식으로 작성하고, 모든 내용은 한국어로 작성하세요.`;

    try {
      const response = await this.callOllamaStream(prompt, system);

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      // 멀티바이트(한글) 문자와 NDJSON 라인이 네트워크 청크 경계에 걸쳐질 수 있으므로
      // {stream:true} 디코딩 + 라인 버퍼로 누락 없이 파싱한다.
      const decoder = new TextDecoder();
      let lineBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        lineBuffer += decoder.decode(value, { stream: true });
        const lines = lineBuffer.split('\n');
        lineBuffer = lines.pop() ?? ''; // 마지막 조각은 다음 청크와 이어붙인다

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const json = JSON.parse(line);
            if (json.response) {
              yield json.response;
            }
          } catch (e) {
            console.error('Error parsing Ollama response:', e, 'line:', line.slice(0, 100));
          }
        }
      }

      // 스트림 종료 후 남은 라인 처리
      if (lineBuffer.trim()) {
        try {
          const json = JSON.parse(lineBuffer);
          if (json.response) {
            yield json.response;
          }
        } catch (e) {
          console.error('Error parsing final Ollama response:', e);
        }
      }
    } catch (error) {
      console.error('Ollama generation error:', error);
      yield '회의록 생성 중 오류가 발생했습니다.';
    }
  }

  async translate(text: string, sourceLanguage: string): Promise<string> {
    const langName = langMap[sourceLanguage] || sourceLanguage;
    const system = `당신은 전문 통역사입니다. ${langName} 텍스트를 자연스러운 한국어 비즈니스 표현으로 번역합니다. 번역문만 출력하세요. 설명이나 주석은 포함하지 마세요.`;

    try {
      const response = await this.callOllama(text, system);
      
      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json() as { response?: string };
      return data.response || '';
    } catch (error) {
      console.error('Ollama translation error:', error);
      return `[번역 오류] ${text}`;
    }
  }

  // Korean → EN/ZH/VI (used in to-foreign interpret mode)
  async translateFromKorean(text: string, targetLanguage: string): Promise<string> {
    const targetNames: Record<string, string> = {
      en: 'English',
      zh: 'Simplified Chinese',
      vi: 'Vietnamese',
    };
    const langName = targetNames[targetLanguage] || targetLanguage;
    const system = `You are a professional interpreter. Translate the Korean text to ${langName} in a natural business tone. Output only the translation, no explanations.`;

    try {
      const response = await this.callOllama(text, system);
      
      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json() as { response?: string };
      return data.response || '';
    } catch (error) {
      console.error('Ollama translation error:', error);
      return `[Translation Error] ${text}`;
    }
  }
}

export const claudeService = new ClaudeService();

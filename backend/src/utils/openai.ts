import OpenAI from 'openai';

let client: OpenAI | null = null;

// API 키가 없어도 서버는 떠야 한다. (STT/TTS를 쓰는 순간에만 실패)
// 모듈 로드 시점에 new OpenAI()를 하면 키가 없을 때 프로세스가 죽는다.
export function getOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY가 설정되지 않았습니다. 설정 파일(.env)에 키를 넣고 다시 실행하세요.'
    );
  }
  if (!client) {
    client = new OpenAI({ apiKey });
  }
  return client;
}

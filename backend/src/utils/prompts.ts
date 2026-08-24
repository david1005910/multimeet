export interface MeetingMeta {
  title: string;
  company: string | null;
  language: string;
  participants: string[];
  createdAt: Date;
}

export interface TranscriptData {
  segments: Array<{ id: number; start: number; end: number; text: string }>;
  rawText: string;
}

const langMap: Record<string, string> = {
  en: '영어',
  zh: '중국어',
  vi: '베트남어',
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function buildMinutesPrompt(transcript: TranscriptData, meeting: MeetingMeta): string {
  const participantsStr = meeting.participants?.join(', ') || '미입력';
  const transcriptText = transcript.segments
    .map((s) => `[${formatTime(s.start)}] ${s.text}`)
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

**회의명**: ${meeting.title}
**일시**: ${new Date(meeting.createdAt).toLocaleString('ko-KR')}
**참석자**: ${participantsStr}
**원본 언어**: ${langMap[meeting.language] || meeting.language}

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

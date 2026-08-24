export interface User {
  id: string
  email: string
  name: string | null
}

export interface Meeting {
  id: string
  userId: string
  title: string
  company: string | null
  language: string
  mode: string
  status: string
  participants: string[]
  audioPath: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  transcript?: Transcript | null
  minutes?: Minutes | null
}

export interface Transcript {
  id: string
  meetingId: string
  segments: TranscriptSegment[]
  rawText: string
  createdAt: string
}

export interface TranscriptSegment {
  id: number
  start: number
  end: number
  text: string
}

export interface Minutes {
  id: string
  meetingId: string
  content: string
  editedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface TranslationItem {
  id: string
  timestamp: number
  original: string
  translated: string
  targetLanguage?: string  // set when source is Korean (to-foreign mode)
}

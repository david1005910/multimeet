export interface JwtPayload {
  id: string;
  email: string;
}

export interface MeetingWithRelations {
  id: string;
  userId: string;
  title: string;
  company: string | null;
  language: string;
  mode: string;
  status: string;
  participants: string[];
  audioPath: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  transcript?: {
    id: string;
    segments: unknown;
    rawText: string;
    createdAt: Date;
  } | null;
  minutes?: {
    id: string;
    content: string;
    editedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
}

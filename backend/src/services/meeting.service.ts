import prisma from '../utils/prisma';

// SQLite에는 스칼라 배열이 없어 participants를 JSON 문자열로 저장한다.
// API 응답은 기존과 동일하게 string[]를 유지하기 위해 여기서 변환한다.
function parseParticipants(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

// Transcript.segments도 같은 이유로 JSON 문자열이라 여기서 되돌린다.
function parseSegments(value: string): any[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function serializeMeeting<
  T extends { participants: string; transcript?: { segments: string } | null }
>(meeting: T) {
  return {
    ...meeting,
    participants: parseParticipants(meeting.participants),
    transcript: meeting.transcript
      ? { ...meeting.transcript, segments: parseSegments(meeting.transcript.segments) }
      : meeting.transcript,
  };
}

export class MeetingService {
  async createMeeting(userId: string, data: {
    title: string;
    company?: string;
    language: string;
    mode: string;
    participants?: string[];
  }) {
    const meeting = await prisma.meeting.create({
      data: {
        userId,
        title: data.title,
        company: data.company,
        language: data.language,
        mode: data.mode,
        participants: JSON.stringify(data.participants || []),
        status: 'preparing',
      },
      include: { transcript: true, minutes: true },
    });
    return serializeMeeting(meeting);
  }

  async getMeetings(userId: string, filters?: { language?: string; search?: string }) {
    // SQLite 커넥터는 mode: 'insensitive'를 지원하지 않는다.
    // SQLite의 LIKE는 ASCII 범위에서 이미 대소문자를 구분하지 않으므로 contains만 사용한다.
    const meetings = await prisma.meeting.findMany({
      where: {
        userId,
        deletedAt: null,
        ...(filters?.language && { language: filters.language }),
        ...(filters?.search && {
          OR: [
            { title: { contains: filters.search } },
            { company: { contains: filters.search } },
          ],
        }),
      },
      include: { transcript: true, minutes: true },
      orderBy: { createdAt: 'desc' },
    });
    return meetings.map(serializeMeeting);
  }

  async getMeetingById(id: string, userId: string) {
    const meeting = await prisma.meeting.findFirst({
      where: { id, userId, deletedAt: null },
      include: { transcript: true, minutes: true, interpretLogs: true },
    });
    if (!meeting) throw new Error('회의를 찾을 수 없습니다.');
    return serializeMeeting(meeting);
  }

  async updateMeeting(id: string, userId: string, data: Partial<{
    title: string;
    company: string;
    status: string;
    participants: string[];
    audioPath: string;
  }>) {
    const owned = await prisma.meeting.findFirst({ where: { id, userId, deletedAt: null } });
    if (!owned) throw new Error('회의를 찾을 수 없습니다.');
    const { participants, ...rest } = data;
    const meeting = await prisma.meeting.update({
      where: { id },
      data: {
        ...rest,
        ...(participants && { participants: JSON.stringify(participants) }),
      },
      include: { transcript: true, minutes: true },
    });
    return serializeMeeting(meeting);
  }

  async deleteMeeting(id: string, userId: string) {
    const meeting = await prisma.meeting.findFirst({ where: { id, userId } });
    if (!meeting) throw new Error('회의를 찾을 수 없습니다.');
    await prisma.meeting.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}

export const meetingService = new MeetingService();

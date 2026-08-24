import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { meetingService, MeetingNotFoundError } from '../services/meeting.service';

function isNotFound(err: unknown): boolean {
  return err instanceof MeetingNotFoundError;
}

export const meetingsController = {
  async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      const meeting = await meetingService.createMeeting(req.userId!, req.body);
      res.status(201).json(meeting);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },

  async list(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { language, search } = req.query as Record<string, string>;
      const meetings = await meetingService.getMeetings(req.userId!, { language, search });
      res.json(meetings);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async getById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const meeting = await meetingService.getMeetingById(req.params.id, req.userId!);
      res.json(meeting);
    } catch (err: any) {
      // 미존재/무권한만 404. 그 외(DB 장애 등)는 500로 구분한다.
      if (isNotFound(err)) {
        res.status(404).json({ error: err.message });
        return;
      }
      console.error('[Meetings.getById]', err);
      res.status(500).json({ error: err.message });
    }
  },

  async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      const meeting = await meetingService.updateMeeting(req.params.id, req.userId!, req.body);
      res.json(meeting);
    } catch (err: any) {
      if (isNotFound(err)) {
        res.status(404).json({ error: err.message });
        return;
      }
      console.error('[Meetings.update]', err);
      res.status(500).json({ error: err.message });
    }
  },

  async delete(req: AuthRequest, res: Response): Promise<void> {
    try {
      await meetingService.deleteMeeting(req.params.id, req.userId!);
      res.status(204).send();
    } catch (err: any) {
      if (isNotFound(err)) {
        res.status(404).json({ error: err.message });
        return;
      }
      console.error('[Meetings.delete]', err);
      res.status(500).json({ error: err.message });
    }
  },
};

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { settingsService } from '../services/settings.service';

export const settingsController = {
  async get(req: AuthRequest, res: Response): Promise<void> {
    try {
      const settings = await settingsService.getSettings(req.userId!);
      res.json(settings);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      const settings = await settingsService.updateSettings(req.userId!, req.body);
      res.json(settings);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },
};

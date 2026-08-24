import { Request, Response } from 'express';
import { authService } from '../services/auth.service';

export const authController = {
  async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, name } = req.body;
      if (!email || !password) {
        res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요.' });
        return;
      }
      const result = await authService.register(email, password, name);
      res.status(201).json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },

  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요.' });
        return;
      }
      const result = await authService.login(email, password);
      res.json(result);
    } catch (err: any) {
      res.status(401).json({ error: err.message });
    }
  },

  async refresh(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        res.status(400).json({ error: '리프레시 토큰이 필요합니다.' });
        return;
      }
      const result = await authService.refresh(refreshToken);
      res.json(result);
    } catch (err: any) {
      res.status(401).json({ error: err.message });
    }
  },

  async me(req: Request, res: Response): Promise<void> {
    res.json({ userId: (req as any).userId, email: (req as any).userEmail });
  },
};

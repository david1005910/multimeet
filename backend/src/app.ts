// bootstrap이 스냅샷에서 프론트엔드/엔진을 꺼낸 뒤에 정적 서빙을 설정해야 한다.
import './utils/bootstrap';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { isPackaged, uploadDir, frontendDir } from './utils/paths';
import authRoutes from './routes/auth.routes';
import meetingRoutes from './routes/meetings.routes';
import audioRoutes from './routes/audio.routes';
import settingsRoutes from './routes/settings.routes';
import { errorMiddleware } from './middleware/error.middleware';
import { authMiddleware, AuthRequest } from './middleware/auth.middleware';

const app = express();

// Simple request logger
app.use((req, _res, next) => {
  console.log(`[HTTP] ${req.method} ${req.path}`);
  next();
});

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

fs.mkdirSync(uploadDir, { recursive: true });

// 업로드 파일은 소유자만 접근 가능하도록 인증 게이트를 둔다.
// 경로 구조는 uploads/<userId>/<meetingId>/<file> 이므로 userId 세그먼트와 실제 파일 위치를 모두 검증한다.
app.use('/uploads', authMiddleware, (req, res, next) => {
  const userId = (req as AuthRequest).userId!;
  const rel = req.path.replace(/^\/+/, '');
  if (!rel.startsWith(`${userId}/`)) {
    res.status(403).json({ error: '접근 권한이 없습니다.' });
    return;
  }
  const abs = path.normalize(path.join(uploadDir, rel));
  if (!abs.startsWith(path.normalize(path.join(uploadDir, userId)) + path.sep) || !fs.existsSync(abs)) {
    res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
    return;
  }
  res.sendFile(abs, next);
});

app.use('/api/auth', authRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/meetings', audioRoutes);
app.use('/api/settings', settingsRoutes);

// exe 실행 또는 production 모드에서는 프론트엔드를 같은 서버에서 서빙한다.
if (isPackaged || process.env.NODE_ENV === 'production') {
  if (fs.existsSync(frontendDir)) {
    app.use(express.static(frontendDir));

    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
        return next();
      }
      res.sendFile(path.join(frontendDir, 'index.html'));
    });
  } else {
    console.error(`[WARN] 프론트엔드 정적 파일을 찾을 수 없습니다: ${frontendDir}`);
  }
}

app.use(errorMiddleware);

export default app;

import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { uploadDir as UPLOAD_DIR } from '../utils/paths';

// 경로 탐색 방지용: meetingId는 UUID/일반 ID 형식만 허용한다
function isValidMeetingId(id: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(id);
}

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const userId = (req as any).userId;
    const meetingId = req.params.meetingId || 'tmp';
    // fileFilter에서 이미 검증하지만, 디스크 쓰기 직전 한 번 더 방어한다
    if (!isValidMeetingId(meetingId)) {
      cb(new Error('잘못된 회의 식별자입니다.'), UPLOAD_DIR);
      return;
    }
    const dir = path.join(UPLOAD_DIR, userId, meetingId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    // 확장자도 화이트리스트로 제한 (originalname 그대로 반영 금지)
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = /^\.(mp3|mp4|m4a|wav|webm)$/.test(ext) ? ext : '.bin';
    cb(null, `audio-${Date.now()}${safeExt}`);
  },
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // destination에 닿기 전에 경로 탐색 시도를 거른다
  const meetingId = _req.params?.meetingId || 'tmp';
  if (!isValidMeetingId(meetingId)) {
    cb(new Error('잘못된 회의 식별자입니다.'));
    return;
  }
  const mime = file.mimetype.split(';')[0].trim(); // strip codec params like "audio/webm;codecs=opus"
  const allowed = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'audio/x-m4a', 'audio/webm', 'video/mp4', 'video/webm'];
  if (allowed.includes(mime)) {
    cb(null, true);
  } else {
    cb(new Error('지원하지 않는 파일 형식입니다. (MP3, MP4, WAV, M4A, WebM)'));
  }
};

export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
});

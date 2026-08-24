import { Router } from 'express';
import { audioController } from '../controllers/audio.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { uploadMiddleware } from '../middleware/upload.middleware';

const router = Router();
router.use(authMiddleware);

router.post('/:meetingId/upload', uploadMiddleware.single('audio'), audioController.upload);
router.post('/:meetingId/transcribe', audioController.transcribe);
router.post('/:meetingId/minutes/generate', audioController.generateMinutes);
router.get('/:meetingId/minutes', audioController.getMinutes);
router.put('/:meetingId/minutes', audioController.updateMinutes);
router.get('/:meetingId/minutes/download', audioController.downloadMinutes);
router.post('/:meetingId/interpret-logs', audioController.saveInterpretLogs);
router.post('/tts', audioController.tts);

export default router;

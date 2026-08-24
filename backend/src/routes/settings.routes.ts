import { Router } from 'express';
import { settingsController } from '../controllers/settings.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
router.use(authMiddleware);

router.get('/', settingsController.get);
router.put('/', settingsController.update);

export default router;

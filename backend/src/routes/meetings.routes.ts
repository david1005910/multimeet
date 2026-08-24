import { Router } from 'express';
import { meetingsController } from '../controllers/meetings.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
router.use(authMiddleware);

router.post('/', meetingsController.create);
router.get('/', meetingsController.list);
router.get('/:id', meetingsController.getById);
router.put('/:id', meetingsController.update);
router.delete('/:id', meetingsController.delete);

export default router;

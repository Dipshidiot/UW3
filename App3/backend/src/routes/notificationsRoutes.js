import { Router } from 'express';

import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../controllers/notificationsController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.get('/', protect, getNotifications);
router.patch('/read-all', protect, markAllNotificationsRead);
router.patch('/:id/read', protect, markNotificationRead);

export default router;

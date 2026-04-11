import { Router } from 'express';

import {
  approvePayout,
  getAdminOverview,
  getAllEntries,
  getAllUsers,
  getAnalytics,
  getBadgeUnlocks,
  sendAdminMessage,
  updateAppModeConfig,
  updateRewardSettingsConfig,
  upsertReward,
} from '../controllers/adminController.js';
import { protect, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.use(protect, requireAdmin);

router.get('/overview', getAdminOverview);
router.get('/users', getAllUsers);
router.get('/entries', getAllEntries);
router.get('/analytics', getAnalytics);
router.get('/badges', getBadgeUnlocks);
router.post('/notifications', sendAdminMessage);
router.post('/rewards', upsertReward);
router.put('/app-mode', updateAppModeConfig);
router.put('/rewards/settings', updateRewardSettingsConfig);
router.put('/rewards/:rewardId', upsertReward);
router.post('/payouts/:userId/approve', approvePayout);

export default router;

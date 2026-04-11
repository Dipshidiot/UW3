import { Router } from 'express';

import { getRewardsSummary, redeemReward } from '../controllers/rewardsController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.get('/', protect, getRewardsSummary);
router.post('/:rewardId/redeem', protect, redeemReward);

export default router;

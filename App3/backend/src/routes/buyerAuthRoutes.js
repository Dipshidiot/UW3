import { Router } from 'express';

import { loginBuyer, provisionBuyer, runBuyerAggregation } from '../controllers/buyerAuth.controller.js';
import { protect, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.post('/login', loginBuyer);
router.post('/provision', protect, requireAdmin, provisionBuyer);
router.post('/aggregate', protect, requireAdmin, runBuyerAggregation);

export default router;

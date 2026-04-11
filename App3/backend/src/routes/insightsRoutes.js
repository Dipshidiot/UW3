import { Router } from 'express';

import {
  readAnomalyInsights,
  readCategorySpendInsights,
  readMonthlyUsageInsights,
  readProviderPriceChangesInsights,
  readProviderTrendsInsights,
  readRegionalUsageInsights,
  readSwitchingInsights,
} from '../controllers/insights.controller.js';
import auditLogMiddleware from '../middleware/auditLogMiddleware.js';
import buyerAuthMiddleware from '../middleware/buyerAuthMiddleware.js';
import createRateLimitMiddleware from '../middleware/rateLimitMiddleware.js';

const router = Router();

router.use(buyerAuthMiddleware, createRateLimitMiddleware({ windowMs: 60_000, max: 120 }), auditLogMiddleware);

router.get('/usage/monthly', readMonthlyUsageInsights);
router.get('/usage/region', readRegionalUsageInsights);
router.get('/providers/trends', readProviderTrendsInsights);
router.get('/providers/price-changes', readProviderPriceChangesInsights);
router.get('/categories/spend', readCategorySpendInsights);
router.get('/anomalies', readAnomalyInsights);
router.get('/switching', readSwitchingInsights);

export default router;

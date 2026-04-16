import { Router } from 'express';

import {
  collectLocation,
  getLocationStatus,
  recordLocationConsent,
  revokeLocationConsent,
} from '../controllers/locationController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.use(protect);

router.get('/status', getLocationStatus);
router.post('/consent', recordLocationConsent);
router.post('/collect', collectLocation);
router.post('/revoke', revokeLocationConsent);

export default router;

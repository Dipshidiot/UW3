import { Router } from 'express';

import { getProfileSummary } from '../controllers/profileController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.get('/', protect, getProfileSummary);

export default router;

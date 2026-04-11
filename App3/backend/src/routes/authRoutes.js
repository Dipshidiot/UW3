import { Router } from 'express';

import { changePassword, getCurrentUser, login, register } from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
import { authRateLimitMiddleware } from '../middleware/rateLimitMiddleware.js';

const router = Router();

router.post('/register', authRateLimitMiddleware, register);
router.post('/login', authRateLimitMiddleware, login);
router.get('/me', protect, getCurrentUser);
router.put('/password', protect, changePassword);

export default router;

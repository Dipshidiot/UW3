import { Router } from 'express';

import {
  deleteWeatherLog,
  getWeatherLogs,
  getWeatherStreak,
  logWeather,
  updateWeatherLog,
} from '../controllers/weatherController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.use(protect);

router.get('/streak', getWeatherStreak);
router.get('/', getWeatherLogs);
router.post('/', logWeather);
router.put('/:id', updateWeatherLog);
router.delete('/:id', deleteWeatherLog);

export default router;

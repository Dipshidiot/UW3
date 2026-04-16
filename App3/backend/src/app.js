import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { getAppMode } from './config/appMode.js';
import adminRoutes from './routes/adminRoutes.js';
import authRoutes from './routes/authRoutes.js';
import buyerAuthRoutes from './routes/buyerAuthRoutes.js';
import entriesRoutes from './routes/entriesRoutes.js';
import insightsRoutes from './routes/insightsRoutes.js';
import locationRoutes from './routes/locationRoutes.js';
import notificationsRoutes from './routes/notificationsRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import rewardsRoutes from './routes/rewardsRoutes.js';
import weatherRoutes from './routes/weatherRoutes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const app = express();

const allowedOrigins = String(process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const isLoopbackOrigin = (origin) => {
  try {
    const parsed = new URL(origin);
    return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(parsed.hostname);
  } catch (_error) {
    return false;
  }
};

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin) || isLoopbackOrigin(origin)) {
        return callback(null, true);
      }

      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  }),
);
app.use(helmet());
app.use(express.json());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.get('/api/health', (_req, res) => {
  const appMode = getAppMode();

  res.json({
    status: 'ok',
    service: 'utility-watch-api',
    ...appMode,
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/buyer/auth', buyerAuthRoutes);
app.use('/api/insights', insightsRoutes);
app.use('/api/entries', entriesRoutes);
app.use('/api/v1/location', locationRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/rewards', rewardsRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/admin', adminRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;

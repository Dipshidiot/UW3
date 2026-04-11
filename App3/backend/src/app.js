import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { isDemoModeOnly } from './config/appMode.js';
import adminRoutes from './routes/adminRoutes.js';
import authRoutes from './routes/authRoutes.js';
import buyerAuthRoutes from './routes/buyerAuthRoutes.js';
import entriesRoutes from './routes/entriesRoutes.js';
import insightsRoutes from './routes/insightsRoutes.js';
import notificationsRoutes from './routes/notificationsRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import rewardsRoutes from './routes/rewardsRoutes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  }),
);
app.use(helmet());
app.use(express.json());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.get('/api/health', (_req, res) => {
  const demoModeOnly = isDemoModeOnly();

  res.json({
    status: 'ok',
    service: 'utility-watch-api',
    demoModeOnly,
    mode: demoModeOnly ? 'demo-preview' : 'live',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/buyer/auth', buyerAuthRoutes);
app.use('/api/insights', insightsRoutes);
app.use('/api/entries', entriesRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/rewards', rewardsRoutes);
app.use('/api/admin', adminRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;

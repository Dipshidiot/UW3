import dotenv from 'dotenv';
import app from './app.js';
import connectDatabase from './config/db.js';
import { connectInsightsDatabase } from './config/insightsDb.js';
import { startAggregationJobs } from './services/aggregation.service.js';

dotenv.config();

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await connectDatabase();
    await connectInsightsDatabase();
    startAggregationJobs();
    app.listen(PORT, () => {
      console.log(`Utility Watch API listening on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();

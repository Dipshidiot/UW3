import mongoose from 'mongoose';

let insightsConnection;

export const getInsightsConnection = () => {
  if (!insightsConnection) {
    insightsConnection = mongoose.createConnection();
  }

  return insightsConnection;
};

export const connectInsightsDatabase = async () => {
  const mongoUri = process.env.AGGREGATION_MONGO_URI || process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error('Aggregation database connection is not configured. Set MONGO_URI or AGGREGATION_MONGO_URI.');
  }

  const connection = getInsightsConnection();

  if (connection.readyState === 1) {
    return connection;
  }

  if (connection.readyState === 2) {
    await connection.asPromise();
    return connection;
  }

  const dbName = process.env.AGGREGATION_DB_NAME || 'utility-watch-insights';
  await connection.openUri(mongoUri, { dbName });
  console.log(`Insights MongoDB connected (${dbName})`);
  return connection;
};

export const closeInsightsDatabase = async () => {
  if (insightsConnection && insightsConnection.readyState !== 0) {
    await insightsConnection.close();
  }
};

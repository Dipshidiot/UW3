import mongoose from 'mongoose';

import { getInsightsConnection } from '../config/insightsDb.js';

const categoryMetricSchema = new mongoose.Schema(
  {
    electricity: { type: Number, default: 0 },
    water: { type: Number, default: 0 },
    gas: { type: Number, default: 0 },
    trash: { type: Number, default: 0 },
  },
  { _id: false },
);

const aggregatedUsageSchema = new mongoose.Schema(
  {
    year: { type: Number, required: true, index: true },
    month: { type: Number, required: true, min: 1, max: 12, index: true },
    region: { type: String, required: true, trim: true, index: true },
    householdCount: { type: Number, required: true, min: 0 },
    entryCount: { type: Number, required: true, min: 0 },
    totalUsage: { type: Number, required: true, min: 0 },
    averageUsage: { type: Number, required: true, min: 0 },
    categoryTotals: { type: categoryMetricSchema, default: () => ({}) },
    categoryAverages: { type: categoryMetricSchema, default: () => ({}) },
    refreshedAt: { type: Date, default: Date.now },
  },
  {
    versionKey: false,
  },
);

aggregatedUsageSchema.index({ year: 1, month: 1, region: 1 }, { unique: true });

const connection = getInsightsConnection();
const AggregatedUsage =
  connection.models.AggregatedUsage ||
  connection.model('AggregatedUsage', aggregatedUsageSchema, 'aggregated_usage');

export default AggregatedUsage;

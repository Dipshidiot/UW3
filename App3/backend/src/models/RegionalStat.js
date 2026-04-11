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

const regionalStatSchema = new mongoose.Schema(
  {
    year: { type: Number, required: true, index: true },
    month: { type: Number, required: true, min: 1, max: 12, index: true },
    region: { type: String, required: true, trim: true, index: true },
    householdCount: { type: Number, required: true, min: 0 },
    totalUsage: { type: Number, required: true, min: 0 },
    averageUsage: { type: Number, required: true, min: 0 },
    averageHouseholdSpend: { type: Number, required: true, min: 0 },
    categoryTotals: { type: categoryMetricSchema, default: () => ({}) },
    categoryAverages: { type: categoryMetricSchema, default: () => ({}) },
    spendTotals: { type: categoryMetricSchema, default: () => ({}) },
    anomalyFlag: { type: Boolean, default: false },
    anomalyDeltaPercent: { type: Number, default: 0 },
    refreshedAt: { type: Date, default: Date.now },
  },
  {
    versionKey: false,
  },
);

regionalStatSchema.index({ year: 1, month: 1, region: 1 }, { unique: true });

const connection = getInsightsConnection();
const RegionalStat =
  connection.models.RegionalStat || connection.model('RegionalStat', regionalStatSchema, 'regional_stats');

export default RegionalStat;

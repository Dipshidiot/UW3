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

const monthlySummarySchema = new mongoose.Schema(
  {
    year: { type: Number, required: true, index: true },
    month: { type: Number, required: true, min: 1, max: 12, index: true },
    householdCount: { type: Number, required: true, min: 0 },
    entryCount: { type: Number, required: true, min: 0 },
    totalUsage: { type: Number, required: true, min: 0 },
    averageUsage: { type: Number, required: true, min: 0 },
    averageHouseholdSpend: { type: Number, required: true, min: 0 },
    categoryTotals: { type: categoryMetricSchema, default: () => ({}) },
    categoryAverages: { type: categoryMetricSchema, default: () => ({}) },
    regionsCovered: { type: Number, default: 0 },
    anomalyCount: { type: Number, default: 0 },
    switchCount: { type: Number, default: 0 },
    switchRate: { type: Number, default: 0 },
    refreshedAt: { type: Date, default: Date.now },
  },
  {
    versionKey: false,
  },
);

monthlySummarySchema.index({ year: 1, month: 1 }, { unique: true });

const connection = getInsightsConnection();
const MonthlySummary =
  connection.models.MonthlySummary || connection.model('MonthlySummary', monthlySummarySchema, 'monthly_summary');

export default MonthlySummary;

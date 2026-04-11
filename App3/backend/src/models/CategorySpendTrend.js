import mongoose from 'mongoose';

import { getInsightsConnection } from '../config/insightsDb.js';

const categorySpendTrendSchema = new mongoose.Schema(
  {
    year: { type: Number, required: true, index: true },
    month: { type: Number, required: true, min: 1, max: 12, index: true },
    region: { type: String, required: true, trim: true, index: true },
    category: {
      type: String,
      required: true,
      enum: ['electricity', 'water', 'gas', 'trash'],
      index: true,
    },
    householdCount: { type: Number, required: true, min: 0 },
    totalSpend: { type: Number, required: true, min: 0 },
    averageSpend: { type: Number, required: true, min: 0 },
    percentageOfMonthlySpend: { type: Number, required: true, min: 0 },
    trendPercent: { type: Number, default: 0 },
    refreshedAt: { type: Date, default: Date.now },
  },
  {
    versionKey: false,
  },
);

categorySpendTrendSchema.index({ year: 1, month: 1, region: 1, category: 1 }, { unique: true });

const connection = getInsightsConnection();
const CategorySpendTrend =
  connection.models.CategorySpendTrend ||
  connection.model('CategorySpendTrend', categorySpendTrendSchema, 'category_spend_trends');

export default CategorySpendTrend;

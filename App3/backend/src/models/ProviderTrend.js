import mongoose from 'mongoose';

import { getInsightsConnection } from '../config/insightsDb.js';

const providerTrendSchema = new mongoose.Schema(
  {
    year: { type: Number, required: true, index: true },
    month: { type: Number, required: true, min: 1, max: 12, index: true },
    region: { type: String, required: true, trim: true, index: true },
    provider: { type: String, required: true, trim: true, index: true },
    category: {
      type: String,
      required: true,
      enum: ['electricity', 'water', 'gas', 'trash'],
      index: true,
    },
    householdCount: { type: Number, required: true, min: 0 },
    recordCount: { type: Number, required: true, min: 0 },
    totalSpend: { type: Number, required: true, min: 0 },
    averageMonthlyCost: { type: Number, required: true, min: 0 },
    averagePricePerUnit: { type: Number, required: true, min: 0 },
    priceChangePercent: { type: Number, default: 0 },
    switchCount: { type: Number, default: 0 },
    switchRate: { type: Number, default: 0 },
    refreshedAt: { type: Date, default: Date.now },
  },
  {
    versionKey: false,
  },
);

providerTrendSchema.index({ year: 1, month: 1, region: 1, provider: 1, category: 1 }, { unique: true });

const connection = getInsightsConnection();
const ProviderTrend =
  connection.models.ProviderTrend || connection.model('ProviderTrend', providerTrendSchema, 'provider_trends');

export default ProviderTrend;

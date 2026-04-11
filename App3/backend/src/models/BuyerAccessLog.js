import mongoose from 'mongoose';

import { getInsightsConnection } from '../config/insightsDb.js';

const buyerAccessLogSchema = new mongoose.Schema(
  {
    buyerUserId: {
      type: String,
      default: '',
    },
    buyerEmail: {
      type: String,
      default: '',
    },
    endpoint: {
      type: String,
      required: true,
      trim: true,
    },
    method: {
      type: String,
      default: 'GET',
      uppercase: true,
      trim: true,
    },
    filters: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    apiKeyPrefix: {
      type: String,
      default: '',
      trim: true,
    },
    apiKeyFingerprint: {
      type: String,
      default: '',
      trim: true,
    },
    ipAddress: {
      type: String,
      default: '',
      trim: true,
    },
    statusCode: {
      type: Number,
      default: 200,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    versionKey: false,
  },
);

const connection = getInsightsConnection();
const BuyerAccessLog =
  connection.models.BuyerAccessLog ||
  connection.model('BuyerAccessLog', buyerAccessLogSchema, 'buyer_access_logs');

export default BuyerAccessLog;

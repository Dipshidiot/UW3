import mongoose from 'mongoose';

const billingHistorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    month: { type: Number, required: true, min: 1, max: 12, index: true },
    year: { type: Number, required: true, min: 2000, index: true },
    region: { type: String, trim: true, default: 'unassigned', index: true },
    provider: { type: String, trim: true, default: 'market-average', index: true },
    category: {
      type: String,
      required: true,
      enum: ['electricity', 'water', 'gas', 'trash'],
      index: true,
    },
    amount: { type: Number, required: true, min: 0 },
    usageAmount: { type: Number, default: 0, min: 0 },
    pricePerUnit: { type: Number, default: 0, min: 0 },
    billedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  },
);

billingHistorySchema.index({ user: 1, year: 1, month: 1, provider: 1, category: 1 }, { unique: true });

const BillingHistory = mongoose.model('BillingHistory', billingHistorySchema);

export default BillingHistory;

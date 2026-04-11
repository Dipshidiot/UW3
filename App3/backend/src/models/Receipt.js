import mongoose from 'mongoose';

const receiptSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    month: { type: Number, required: true, min: 1, max: 12, index: true },
    year: { type: Number, required: true, min: 2000, index: true },
    provider: { type: String, trim: true, default: 'market-average' },
    category: {
      type: String,
      required: true,
      enum: ['electricity', 'water', 'gas', 'trash'],
    },
    amount: { type: Number, required: true, min: 0 },
    fileName: { type: String, trim: true, default: '' },
    uploadedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  },
);

const Receipt = mongoose.model('Receipt', receiptSchema);

export default Receipt;

import mongoose from 'mongoose';

const providerChangeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    fromProvider: { type: String, required: true, trim: true },
    toProvider: { type: String, required: true, trim: true },
    region: { type: String, trim: true, default: 'unassigned', index: true },
    category: {
      type: String,
      required: true,
      enum: ['electricity', 'water', 'gas', 'trash'],
      index: true,
    },
    effectiveMonth: { type: Number, required: true, min: 1, max: 12, index: true },
    effectiveYear: { type: Number, required: true, min: 2000, index: true },
    reason: { type: String, trim: true, default: '' },
    changedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  },
);

const ProviderChange = mongoose.model('ProviderChange', providerChangeSchema);

export default ProviderChange;

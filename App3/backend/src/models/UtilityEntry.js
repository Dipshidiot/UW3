import mongoose from 'mongoose';

const utilityEntrySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    year: {
      type: Number,
      required: true,
      min: 2000,
    },
    paidUtilities: [
      {
        type: String,
        enum: ['electricity', 'water', 'gas', 'trash'],
      },
    ],
    categories: {
      electricity: { type: Number, required: true, min: 0 },
      water: { type: Number, required: true, min: 0 },
      gas: { type: Number, required: true, min: 0 },
      trash: { type: Number, required: true, min: 0 },
    },
    providers: {
      electricity: { type: String, trim: true, default: '' },
      water: { type: String, trim: true, default: '' },
      gas: { type: String, trim: true, default: '' },
      trash: { type: String, trim: true, default: '' },
    },
    usage: {
      electricity: { type: Number, min: 0, default: null },
      water: { type: Number, min: 0, default: null },
      gas: { type: Number, min: 0, default: null },
    },
    totalUsage: {
      type: Number,
      required: true,
      min: 0,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  },
);

utilityEntrySchema.index({ user: 1, month: 1, year: 1 }, { unique: true });

const UtilityEntry = mongoose.model('UtilityEntry', utilityEntrySchema);

export default UtilityEntry;

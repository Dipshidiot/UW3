import mongoose from 'mongoose';

const rewardSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    pointsRequired: {
      type: Number,
      required: true,
      min: 0,
    },
    active: {
      type: Boolean,
      default: true,
    },
    transparency: {
      basePoints: { type: Number, default: 25 },
      streakBonus: { type: Number, default: 10 },
      improvementBonus: { type: Number, default: 15 },
    },
  },
  {
    timestamps: true,
  },
);

const Reward = mongoose.model('Reward', rewardSchema);

export default Reward;

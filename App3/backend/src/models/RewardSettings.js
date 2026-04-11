import mongoose from 'mongoose';

const rewardSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: 'default',
      unique: true,
      trim: true,
    },
    basePoints: {
      electricity: { type: Number, default: 20, min: 0 },
      water: { type: Number, default: 20, min: 0 },
      gas: { type: Number, default: 15, min: 0 },
      trash: { type: Number, default: 10, min: 0 },
    },
    consistencyBonus: {
      type: Number,
      default: 10,
      min: 0,
    },
    improvementBonusPerCategory: {
      type: Number,
      default: 5,
      min: 0,
    },
    streakBonuses: {
      threeMonth: { type: Number, default: 15, min: 0 },
      sixMonth: { type: Number, default: 30, min: 0 },
      twelveMonth: { type: Number, default: 60, min: 0 },
    },
    badgeBonuses: {
      firstEntry: { type: Number, default: 10, min: 0 },
      streak3: { type: Number, default: 20, min: 0 },
      streak6: { type: Number, default: 40, min: 0 },
      streak12: { type: Number, default: 75, min: 0 },
      level5: { type: Number, default: 15, min: 0 },
      level10: { type: Number, default: 25, min: 0 },
      level20: { type: Number, default: 50, min: 0 },
      usageReducer: { type: Number, default: 20, min: 0 },
    },
    levelUpBonusPerLevel: {
      type: Number,
      default: 10,
      min: 0,
    },
    pointsPerDollar: {
      type: Number,
      default: 100,
      min: 1,
    },
  },
  {
    timestamps: true,
  },
);

const RewardSettings = mongoose.model('RewardSettings', rewardSettingsSchema);

export default RewardSettings;

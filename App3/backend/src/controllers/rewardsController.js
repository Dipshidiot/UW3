import Reward from '../models/Reward.js';
import User from '../models/User.js';
import { createNotification } from '../services/notificationService.js';
import {
  buildRewardTransparency,
  calculateCashValue,
  ensureDefaultRewards,
  getRewardSettings,
} from '../services/rewardService.js';
import { SUPPORTED_UTILITY_KEYS } from '../utils/validators.js';

export const getRewardsSummary = async (req, res, next) => {
  try {
    await ensureDefaultRewards();

    const [user, rewards, settings] = await Promise.all([
      User.findById(req.user.id).populate('badges', 'key name icon description'),
      Reward.find({ active: true }).sort({ pointsRequired: 1 }),
      getRewardSettings(),
    ]);

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const preferredUtilities = user.preferredUtilities?.length
      ? user.preferredUtilities
      : SUPPORTED_UTILITY_KEYS;

    return res.json({
      rewardPoints: user.rewardPoints,
      cashValue: calculateCashValue(user.rewardPoints, settings),
      conversionRate: settings.pointsPerDollar,
      preferredUtilities,
      rewards,
      rewardHistory: (user.rewardHistory || []).slice(0, 10),
      streakStatus: {
        current: user.streakCount,
        nextMilestone:
          user.streakCount < 3 ? 3 : user.streakCount < 6 ? 6 : user.streakCount < 12 ? 12 : null,
      },
      levelProgression: {
        level: user.level,
        xp: user.xp,
      },
      badgeSummary: user.badges,
      achievementSummary: user.badges,
      settings,
      transparency: buildRewardTransparency(settings, preferredUtilities),
    });
  } catch (error) {
    return next(error);
  }
};

export const redeemReward = async (req, res, next) => {
  try {
    const [user, reward, settings] = await Promise.all([
      User.findById(req.user.id),
      Reward.findById(req.params.rewardId),
      getRewardSettings(),
    ]);

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (!reward || !reward.active) {
      return res.status(404).json({ message: 'Reward not found.' });
    }

    if (user.rewardPoints < reward.pointsRequired) {
      return res.status(400).json({ message: 'Not enough reward points for this redemption.' });
    }

    user.rewardPoints -= reward.pointsRequired;
    user.rewardHistory = [
      {
        source: 'reward-redemption',
        pointsEarned: -reward.pointsRequired,
        cashValue: calculateCashValue(-reward.pointsRequired, settings),
        balanceAfter: user.rewardPoints,
        description: `Reward redemption requested for ${reward.name}.`,
        breakdown: [{ label: `${reward.name} redemption request`, amount: -reward.pointsRequired }],
      },
      ...(user.rewardHistory || []),
    ].slice(0, 50);
    await user.save();

    await createNotification({
      userId: user._id,
      title: 'Reward redemption requested',
      message: `Your ${reward.name} redemption has been submitted for admin review.`,
      type: 'reward',
    });

    return res.json({
      message: 'Reward redemption request submitted.',
      rewardPoints: user.rewardPoints,
      cashValue: calculateCashValue(user.rewardPoints, settings),
    });
  } catch (error) {
    return next(error);
  }
};

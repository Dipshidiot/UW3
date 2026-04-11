import { getAppMode, setDemoModeOnly } from '../config/appMode.js';
import Reward from '../models/Reward.js';
import User from '../models/User.js';
import UtilityEntry from '../models/UtilityEntry.js';
import { broadcastAdminNotification, createNotification } from '../services/notificationService.js';
import { ensureDefaultRewards, getRewardSettings, updateRewardSettings } from '../services/rewardService.js';
import { buildEntryLabel } from '../utils/dateRules.js';

const buildCategoryComparison = (totals) => [
  { category: 'Electricity', usage: totals.electricity },
  { category: 'Water', usage: totals.water },
  { category: 'Gas', usage: totals.gas },
  { category: 'Trash / Waste', usage: totals.trash },
];

const formatRecentEntry = (entry) => ({
  id: entry._id,
  userName: entry.user?.name || 'Unknown user',
  userEmail: entry.user?.email || 'No email',
  label: buildEntryLabel(entry.month, entry.year),
  month: entry.month,
  year: entry.year,
  totalUsage: entry.totalUsage,
  electricity: entry.categories.electricity,
  water: entry.categories.water,
  gas: entry.categories.gas,
  trash: entry.categories.trash,
  createdAt: entry.createdAt,
});

export const getAdminOverview = async (_req, res, next) => {
  try {
    await ensureDefaultRewards();

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    const [users, recentEntries, rewards, totalEntries, entriesThisMonth, rewardSettings] = await Promise.all([
      User.find()
        .select('-password')
        .populate('badges', 'key name icon description')
        .sort({ xp: -1, level: -1, createdAt: 1 }),
      UtilityEntry.find()
        .populate('user', 'name email')
        .sort({ year: -1, month: -1, createdAt: -1 })
        .limit(8),
      Reward.find({ active: true }).sort({ pointsRequired: 1 }),
      UtilityEntry.countDocuments(),
      UtilityEntry.countDocuments({ month: currentMonth, year: currentYear }),
      getRewardSettings(),
    ]);

    const usersWithBadges = users.filter((user) => (user.badges || []).length > 0);
    const recentUsageTotal = recentEntries.reduce((sum, entry) => sum + entry.totalUsage, 0);
    const totalBadgesAwarded = users.reduce((sum, user) => sum + (user.badges?.length || 0), 0);
    const averageXp = users.length
      ? Number((users.reduce((sum, user) => sum + (user.xp || 0), 0) / users.length).toFixed(1))
      : 0;
    const completionRate = users.length ? Math.round((entriesThisMonth / users.length) * 100) : 0;

    return res.json({
      metrics: {
        totalUsers: users.length,
        totalEntries,
        activeRewards: rewards.length,
        averageRecentUsage: recentEntries.length
          ? Number((recentUsageTotal / recentEntries.length).toFixed(2))
          : 0,
        totalBadgesAwarded,
        averageXp,
        completionRate,
      },
      recentEntries: recentEntries.map(formatRecentEntry),
      recentBadgeUnlocks: usersWithBadges.slice(0, 5).map((user) => ({
        id: user._id,
        name: user.name,
        email: user.email,
        level: user.level,
        xp: user.xp,
        badgeCount: user.badges.length,
        badges: user.badges,
      })),
      topUsers: users.slice(0, 5).map((user) => ({
        id: user._id,
        name: user.name,
        email: user.email,
        level: user.level,
        xp: user.xp,
        rewardPoints: user.rewardPoints,
        streakCount: user.streakCount,
        badgeCount: user.badges?.length || 0,
      })),
      rewardSettings,
      rewards,
      appMode: getAppMode(),
    });
  } catch (error) {
    return next(error);
  }
};

export const getAllUsers = async (_req, res, next) => {
  try {
    const users = await User.find()
      .select('-password')
      .populate('badges', 'key name icon description')
      .sort({ createdAt: -1 });

    return res.json({ users });
  } catch (error) {
    return next(error);
  }
};

export const getAllEntries = async (_req, res, next) => {
  try {
    const entries = await UtilityEntry.find()
      .populate('user', 'name email')
      .sort({ year: -1, month: -1, createdAt: -1 });

    return res.json({ entries });
  } catch (error) {
    return next(error);
  }
};

export const upsertReward = async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const description = String(req.body.description || '').trim();
    const pointsRequired = Number(req.body.pointsRequired);

    if (!name || !description || !Number.isFinite(pointsRequired) || pointsRequired < 0) {
      return res.status(400).json({
        message: 'Reward name, description, and non-negative pointsRequired are required.',
      });
    }

    let reward;

    if (req.params.rewardId) {
      reward = await Reward.findByIdAndUpdate(
        req.params.rewardId,
        {
          name,
          description,
          pointsRequired,
          active: req.body.active ?? true,
        },
        { new: true },
      );
    } else {
      reward = await Reward.create({
        name,
        description,
        pointsRequired,
        active: req.body.active ?? true,
      });
    }

    return res.status(req.params.rewardId ? 200 : 201).json({ reward });
  } catch (error) {
    return next(error);
  }
};

export const approvePayout = async (req, res, next) => {
  try {
    const rewardId = String(req.body.rewardId || '');
    const [user, reward] = await Promise.all([
      User.findById(req.params.userId),
      Reward.findById(rewardId),
    ]);

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (!reward) {
      return res.status(404).json({ message: 'Reward not found.' });
    }

    await createNotification({
      userId: user._id,
      title: 'Payout approved',
      message: `Your ${reward.name} payout has been approved by the Utility Watch team.`,
      type: 'reward',
    });

    return res.json({ message: 'Payout approved and notification sent.' });
  } catch (error) {
    return next(error);
  }
};

export const sendAdminMessage = async (req, res, next) => {
  try {
    const title = String(req.body.title || '').trim();
    const message = String(req.body.message || '').trim();
    const targetUserIds = Array.isArray(req.body.targetUserIds) ? req.body.targetUserIds : [];

    if (!title || !message) {
      return res.status(400).json({ message: 'Both title and message are required.' });
    }

    const notifications = await broadcastAdminNotification({ title, message, targetUserIds });

    return res.status(201).json({
      message: 'Notification sent successfully.',
      delivered: notifications.length,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateRewardSettingsConfig = async (req, res, next) => {
  try {
    const settings = await updateRewardSettings(req.body || {});

    return res.json({
      message: 'Reward settings updated successfully.',
      settings,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateAppModeConfig = async (req, res, next) => {
  try {
    if (typeof req.body?.demoModeOnly !== 'boolean') {
      return res.status(400).json({ message: 'A boolean demoModeOnly value is required.' });
    }

    const demoModeOnly = setDemoModeOnly(req.body.demoModeOnly);

    return res.json({
      message: demoModeOnly
        ? 'Demo preview mode activated. Live member access is now disabled until launch.'
        : 'Demo preview mode deactivated. Live member access is now enabled.',
      appMode: getAppMode(),
    });
  } catch (error) {
    return next(error);
  }
};

export const getBadgeUnlocks = async (_req, res, next) => {
  try {
    const users = await User.find()
      .select('name email badges level xp')
      .populate('badges', 'key name icon description');

    const badgeUnlocks = users.filter((user) => (user.badges || []).length > 0);
    return res.json({ badgeUnlocks });
  } catch (error) {
    return next(error);
  }
};

export const getAnalytics = async (_req, res, next) => {
  try {
    const entries = await UtilityEntry.find().sort({ year: 1, month: 1, createdAt: 1 });

    const totals = entries.reduce(
      (accumulator, entry) => {
        accumulator.electricity += entry.categories.electricity;
        accumulator.water += entry.categories.water;
        accumulator.gas += entry.categories.gas;
        accumulator.trash += entry.categories.trash;
        return accumulator;
      },
      { electricity: 0, water: 0, gas: 0, trash: 0 },
    );

    const monthlyMap = new Map();

    entries.forEach((entry) => {
      const key = `${entry.year}-${String(entry.month).padStart(2, '0')}`;
      if (!monthlyMap.has(key)) {
        monthlyMap.set(key, {
          label: buildEntryLabel(entry.month, entry.year),
          totalUsage: 0,
          electricity: 0,
          water: 0,
          gas: 0,
          trash: 0,
          entryCount: 0,
        });
      }

      const monthEntry = monthlyMap.get(key);
      monthEntry.totalUsage += entry.totalUsage;
      monthEntry.electricity += entry.categories.electricity;
      monthEntry.water += entry.categories.water;
      monthEntry.gas += entry.categories.gas;
      monthEntry.trash += entry.categories.trash;
      monthEntry.entryCount += 1;
    });

    const usageByMonth = Array.from(monthlyMap.values()).map((monthEntry) => ({
      ...monthEntry,
      averageUsage: monthEntry.entryCount
        ? Number((monthEntry.totalUsage / monthEntry.entryCount).toFixed(2))
        : 0,
    }));

    const latestMonth = usageByMonth[usageByMonth.length - 1] || null;
    const previousMonth = usageByMonth[usageByMonth.length - 2] || null;
    const trendPercent =
      latestMonth && previousMonth && previousMonth.totalUsage
        ? Math.round(((previousMonth.totalUsage - latestMonth.totalUsage) / previousMonth.totalUsage) * 100)
        : 0;
    const highestUsageMonth = usageByMonth.length
      ? usageByMonth.reduce((highest, monthEntry) =>
          monthEntry.totalUsage > highest.totalUsage ? monthEntry : highest,
        )
      : null;
    const lowestUsageMonth = usageByMonth.length
      ? usageByMonth.reduce((lowest, monthEntry) =>
          monthEntry.totalUsage < lowest.totalUsage ? monthEntry : lowest,
        )
      : null;

    return res.json({
      usageByMonth,
      categoryTotals: totals,
      categoryComparison: buildCategoryComparison(totals),
      trendSummary: {
        direction: trendPercent > 0 ? 'down' : trendPercent < 0 ? 'up' : 'flat',
        trendPercent: Math.abs(trendPercent),
        latestPeriod: latestMonth?.label || 'No data yet',
        highestUsageMonth: highestUsageMonth?.label || 'No data yet',
        lowestUsageMonth: lowestUsageMonth?.label || 'No data yet',
        totalTrackedEntries: entries.length,
      },
    });
  } catch (error) {
    return next(error);
  }
};

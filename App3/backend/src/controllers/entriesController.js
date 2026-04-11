import UtilityEntry from '../models/UtilityEntry.js';
import User from '../models/User.js';
import { syncUserBadges } from '../services/badgeService.js';
import { createNotification } from '../services/notificationService.js';
import { calculateRewardBreakdown, getRewardSettings } from '../services/rewardService.js';
import { buildXpBreakdown, calculateLevelFromXp } from '../services/xpService.js';
import {
  buildEntryLabel,
  calculateImprovementPercent,
  calculateStreakFromEntries,
  isAllowedSubmissionWindow,
} from '../utils/dateRules.js';
import { normalizeEntryPayload, SUPPORTED_UTILITY_KEYS } from '../utils/validators.js';

const calculateTotalUsage = (categories) =>
  Object.values(categories).reduce((sum, value) => sum + Number(value || 0), 0);

const isCurrentMonthEntry = (month, year, referenceDate = new Date()) =>
  month === referenceDate.getMonth() + 1 && year === referenceDate.getFullYear();

const hasDifferentPaidUtilities = (left = [], right = []) => {
  const normalizedLeft = [...left].map(String).sort();
  const normalizedRight = [...right].map(String).sort();

  return normalizedLeft.join('|') !== normalizedRight.join('|');
};

const formatEntry = (entry) => ({
  id: entry._id,
  month: entry.month,
  year: entry.year,
  label: buildEntryLabel(entry.month, entry.year),
  paidUtilities: entry.paidUtilities?.length ? entry.paidUtilities : SUPPORTED_UTILITY_KEYS,
  categories: entry.categories,
  providers: entry.providers || {
    electricity: '',
    water: '',
    gas: '',
    trash: '',
  },
  usage: entry.usage || { electricity: null, water: null, gas: null },
  totalUsage: entry.totalUsage,
  notes: entry.notes,
  createdAt: entry.createdAt,
  updatedAt: entry.updatedAt,
});
const findPreviousMonthEntry = (userId, month, year) => {
  const previousPeriod = new Date(year, month - 2, 1);

  return UtilityEntry.findOne({
    user: userId,
    month: previousPeriod.getMonth() + 1,
    year: previousPeriod.getFullYear(),
  });
};

const buildRewardHistoryRecord = ({ month, year, rewardBreakdown, balanceAfter }) => ({
  source: 'monthly-entry',
  month,
  year,
  pointsEarned: rewardBreakdown.totalPoints,
  cashValue: rewardBreakdown.cashValue,
  balanceAfter,
  paidUtilities: rewardBreakdown.paidUtilities,
  description: `Reward points earned for ${buildEntryLabel(month, year)}.`,
  breakdown: rewardBreakdown.items,
});

export const createEntry = async (req, res, next) => {
  try {
    const { month, year, categories, providers, usage, paidUtilities, notes, errors } = normalizeEntryPayload(req.body);
    const preferredProvidersUpdate = {
      electricity: providers.electricity || '',
      water: providers.water || '',
      gas: providers.gas || '',
      trash: providers.trash || '',
    };

    if (errors.length) {
      return res.status(400).json({ message: 'Invalid entry payload.', errors });
    }

    if (!isAllowedSubmissionWindow(month, year)) {
      return res.status(400).json({
        message: 'Entries may only be submitted for the current month or the previous month.',
      });
    }

    const totalUsage = calculateTotalUsage(categories);
    const duplicateEntry = await UtilityEntry.findOne({ user: req.user.id, month, year });
    if (duplicateEntry) {
      if (
        hasDifferentPaidUtilities(duplicateEntry.paidUtilities || [], paidUtilities) &&
        !isCurrentMonthEntry(duplicateEntry.month, duplicateEntry.year)
      ) {
        return res.status(400).json({
          message: 'Only current-month entries can change which bills you pay for.',
        });
      }

      duplicateEntry.paidUtilities = paidUtilities;
      duplicateEntry.categories = categories;
      duplicateEntry.providers = providers;
      duplicateEntry.usage = usage;
      duplicateEntry.totalUsage = totalUsage;
      duplicateEntry.notes = notes;
      await duplicateEntry.save();
      await User.findByIdAndUpdate(req.user.id, {
        preferredUtilities: paidUtilities,
        preferredProviders: preferredProvidersUpdate,
      });

      return res.status(200).json({
        message: 'Entry updated successfully for this period.',
        updated: true,
        entry: formatEntry(duplicateEntry),
      });
    }

    const comparisonEntry = await findPreviousMonthEntry(req.user.id, month, year);
    const improvementPercent = calculateImprovementPercent(totalUsage, comparisonEntry?.totalUsage || 0);

    const entry = await UtilityEntry.create({
      user: req.user.id,
      month,
      year,
      paidUtilities,
      categories,
      providers,
      usage,
      totalUsage,
      notes,
    });

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const allEntries = await UtilityEntry.find({ user: req.user.id });
    const streakCount = calculateStreakFromEntries(allEntries);
    const totalEntries = allEntries.length;
    const previousLevel = user.level;

    const xpBreakdown = buildXpBreakdown({ streakCount, improvementPercent, totalEntries });
    user.xp += xpBreakdown.totalXp;
    user.level = calculateLevelFromXp(user.xp);
    user.streakCount = streakCount;
    user.preferredUtilities = paidUtilities;
    user.preferredProviders = preferredProvidersUpdate;

    const unlockedBadges = await syncUserBadges(user, {
      totalEntries,
      streakCount,
      level: user.level,
      improvementPercent,
      paidUtilityCount: paidUtilities.length,
    });

    const rewardSettings = await getRewardSettings();
    const rewardBreakdown = calculateRewardBreakdown({
      categories,
      paidUtilities,
      previousEntry: comparisonEntry,
      streakCount,
      previousLevel,
      newLevel: user.level,
      unlockedBadges,
      settings: rewardSettings,
    });

    user.rewardPoints += rewardBreakdown.totalPoints;
    user.rewardHistory = [
      buildRewardHistoryRecord({
        month,
        year,
        rewardBreakdown,
        balanceAfter: user.rewardPoints,
      }),
      ...(user.rewardHistory || []),
    ].slice(0, 50);

    await user.save();

    await createNotification({
      userId: user._id,
      title: 'XP earned',
      message: `You earned ${xpBreakdown.totalXp} XP for your ${buildEntryLabel(month, year)} entry.`,
      type: 'xp',
      metadata: { totalXp: xpBreakdown.totalXp },
    });

    await createNotification({
      userId: user._id,
      title: 'Reward points earned',
      message: `You earned ${rewardBreakdown.totalPoints} reward points for ${buildEntryLabel(month, year)}.`,
      type: 'reward',
      metadata: {
        totalPoints: rewardBreakdown.totalPoints,
        items: rewardBreakdown.items,
        cashValue: rewardBreakdown.cashValue,
      },
    });

    if (user.level > previousLevel) {
      await createNotification({
        userId: user._id,
        title: 'Level up!',
        message: `You reached level ${user.level}.`,
        type: 'level',
        metadata: { level: user.level },
      });
    }

    if (unlockedBadges.length) {
      await createNotification({
        userId: user._id,
        title: 'Achievement unlocked',
        message: `New achievement${unlockedBadges.length > 1 ? 's' : ''}: ${unlockedBadges.map((badge) => badge.name).join(', ')}.`,
        type: 'badge',
        metadata: { badges: unlockedBadges.map((badge) => badge.key) },
      });
    }

    return res.status(201).json({
      entry: formatEntry(entry),
      progression: {
        xp: xpBreakdown,
        rewards: rewardBreakdown,
        level: user.level,
        rewardPoints: user.rewardPoints,
        streakCount: user.streakCount,
      },
      unlockedBadges,
    });
  } catch (error) {
    return next(error);
  }
};

export const getEntries = async (req, res, next) => {
  try {
    const entries = await UtilityEntry.find({ user: req.user.id }).sort({ year: -1, month: -1 });
    return res.json({ entries: entries.map(formatEntry) });
  } catch (error) {
    return next(error);
  }
};

export const updateEntry = async (req, res, next) => {
  try {
    const entry = await UtilityEntry.findOne({ _id: req.params.id, user: req.user.id });

    if (!entry) {
      return res.status(404).json({ message: 'Entry not found.' });
    }

    if (!isAllowedSubmissionWindow(entry.month, entry.year)) {
      return res.status(400).json({
        message: 'Only entries for the current or previous month can be edited.',
      });
    }

    const { categories, providers, usage, paidUtilities, notes, errors } = normalizeEntryPayload({
      month: entry.month,
      year: entry.year,
      categories: req.body.categories ?? entry.categories,
      providers: req.body.providers ?? entry.providers,
      usage: req.body.usage ?? entry.usage,
      paidUtilities: req.body.paidUtilities ?? entry.paidUtilities,
      notes: req.body.notes ?? entry.notes,
    });

    if (errors.some((message) => message.includes('utility categories'))) {
      return res.status(400).json({ message: 'Invalid category values.', errors });
    }

    if (
      hasDifferentPaidUtilities(entry.paidUtilities || [], paidUtilities) &&
      !isCurrentMonthEntry(entry.month, entry.year)
    ) {
      return res.status(400).json({
        message: 'Only current-month entries can change which bills you pay for.',
      });
    }

    entry.paidUtilities = paidUtilities;
    entry.categories = categories;
    entry.providers = providers;
    entry.usage = usage;
    entry.notes = notes;
    entry.totalUsage = calculateTotalUsage(categories);
    await entry.save();
    await User.findByIdAndUpdate(req.user.id, {
      preferredUtilities: paidUtilities,
      preferredProviders: providers,
    });

    return res.json({
      message: 'Entry updated successfully.',
      updated: true,
      entry: formatEntry(entry),
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteEntry = async (req, res, next) => {
  try {
    const entry = await UtilityEntry.findOne({ _id: req.params.id, user: req.user.id });

    if (!entry) {
      return res.status(404).json({ message: 'Entry not found.' });
    }

    if (!isAllowedSubmissionWindow(entry.month, entry.year)) {
      return res.status(400).json({
        message: 'Only entries for the current or previous month can be deleted.',
      });
    }

    await entry.deleteOne();
    return res.json({ message: 'Entry deleted successfully.' });
  } catch (error) {
    return next(error);
  }
};

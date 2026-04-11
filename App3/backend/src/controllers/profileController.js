import User from '../models/User.js';
import UtilityEntry from '../models/UtilityEntry.js';
import { buildEntryLabel } from '../utils/dateRules.js';
import { SUPPORTED_UTILITY_KEYS } from '../utils/validators.js';

export const getProfileSummary = async (req, res, next) => {
  try {
    const [user, entries] = await Promise.all([
      User.findById(req.user.id).populate('badges', 'key name icon description'),
      UtilityEntry.find({ user: req.user.id }).sort({ year: 1, month: 1 }),
    ]);

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const history = entries.map((entry) => ({
      id: entry._id,
      label: buildEntryLabel(entry.month, entry.year),
      month: entry.month,
      year: entry.year,
      paidUtilities: entry.paidUtilities?.length ? entry.paidUtilities : SUPPORTED_UTILITY_KEYS,
      providers: entry.providers || {
        electricity: '',
        water: '',
        gas: '',
        trash: '',
      },
      totalUsage: entry.totalUsage,
      notes: entry.notes,
      updatedAt: entry.updatedAt,
      ...entry.categories,
    }));

    return res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        xp: user.xp,
        level: user.level,
        rewardPoints: user.rewardPoints,
        streakCount: user.streakCount,
        preferredUtilities: user.preferredUtilities?.length ? user.preferredUtilities : SUPPORTED_UTILITY_KEYS,
        preferredProviders: user.preferredProviders || {
          electricity: '',
          water: '',
          gas: '',
          trash: '',
        },
        mustChangePassword: Boolean(user.mustChangePassword),
        adminAccessRevokedAt: user.adminAccessRevokedAt || null,
        rewardHistory: user.rewardHistory || [],
        badges: user.badges,
        achievements: user.badges,
      },
      summary: {
        totalEntries: entries.length,
        averageUsage:
          history.length > 0
            ? Number(
                (history.reduce((sum, item) => sum + item.totalUsage, 0) / history.length).toFixed(2),
              )
            : 0,
        bestMonth:
          history.length > 0
            ? history.reduce((best, item) => (item.totalUsage < best.totalUsage ? item : best), history[0])
            : null,
      },
      history,
    });
  } catch (error) {
    return next(error);
  }
};

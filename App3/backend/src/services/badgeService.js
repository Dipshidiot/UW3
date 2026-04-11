import Badge from '../models/Badge.js';

export const DEFAULT_BADGES = [
  {
    key: 'first-entry',
    name: 'First Step Achievement',
    description: 'Submitted your first utility entry.',
    requirement: 'Save 1 monthly utility entry.',
    icon: '◈',
    xpBonus: 15,
    rewardPointBonus: 10,
  },
  {
    key: 'entries-2',
    name: 'Momentum Builder Achievement',
    description: 'Logged two utility entries.',
    requirement: 'Save 2 monthly utility entries.',
    icon: '◇',
    xpBonus: 10,
    rewardPointBonus: 0,
  },
  {
    key: 'entries-3',
    name: 'Repeat Reporter Achievement',
    description: 'Logged three utility entries.',
    requirement: 'Save 3 monthly utility entries.',
    icon: '▣',
    xpBonus: 12,
    rewardPointBonus: 0,
  },
  {
    key: 'entries-6',
    name: 'Half-Year Reporter Achievement',
    description: 'Reached six total utility submissions.',
    requirement: 'Save 6 monthly utility entries.',
    icon: '⬒',
    xpBonus: 18,
    rewardPointBonus: 0,
  },
  {
    key: 'entries-12',
    name: 'Annual Reporter Achievement',
    description: 'Reached twelve total utility submissions.',
    requirement: 'Save 12 monthly utility entries.',
    icon: '⬔',
    xpBonus: 30,
    rewardPointBonus: 0,
  },
  {
    key: 'entries-18',
    name: 'Long-Haul Reporter Achievement',
    description: 'Kept logging utilities well beyond the first year.',
    requirement: 'Save 18 monthly utility entries.',
    icon: '⬕',
    xpBonus: 40,
    rewardPointBonus: 0,
  },
  {
    key: 'entries-24',
    name: 'Archive Keeper Achievement',
    description: 'Built a deep two-year utility history.',
    requirement: 'Save 24 monthly utility entries.',
    icon: '⬓',
    xpBonus: 50,
    rewardPointBonus: 0,
  },
  {
    key: 'streak-2',
    name: 'Two-Month Streak Achievement',
    description: 'Tracked utilities for two consecutive months.',
    requirement: 'Maintain a 2-month streak.',
    icon: '◬',
    xpBonus: 12,
    rewardPointBonus: 0,
  },
  {
    key: 'streak-3',
    name: '3-Month Streak Achievement',
    description: 'Tracked utilities for 3 consecutive months.',
    requirement: 'Maintain a 3-month streak.',
    icon: '◆',
    xpBonus: 25,
    rewardPointBonus: 20,
  },
  {
    key: 'streak-4',
    name: 'Four-Month Flow Achievement',
    description: 'Stayed consistent for four straight months.',
    requirement: 'Maintain a 4-month streak.',
    icon: '⬥',
    xpBonus: 18,
    rewardPointBonus: 0,
  },
  {
    key: 'streak-6',
    name: '6-Month Streak Achievement',
    description: 'Maintained tracking for 6 straight months.',
    requirement: 'Maintain a 6-month streak.',
    icon: '⬢',
    xpBonus: 40,
    rewardPointBonus: 40,
  },
  {
    key: 'streak-9',
    name: 'Nine-Month Steady Achievement',
    description: 'Stayed consistent for nine straight months.',
    requirement: 'Maintain a 9-month streak.',
    icon: '⬣',
    xpBonus: 45,
    rewardPointBonus: 0,
  },
  {
    key: 'streak-12',
    name: '12-Month Streak Achievement',
    description: 'Completed a full year of tracking.',
    requirement: 'Maintain a 12-month streak.',
    icon: '✪',
    xpBonus: 60,
    rewardPointBonus: 75,
  },
  {
    key: 'improvement-5',
    name: 'Efficiency Starter Achievement',
    description: 'Trimmed total usage by at least 5% compared to the prior entry.',
    requirement: 'Reduce total usage by 5% vs. your previous entry.',
    icon: '✧',
    xpBonus: 10,
    rewardPointBonus: 0,
  },
  {
    key: 'usage-reducer',
    name: 'Usage Reducer Achievement',
    description: 'Reduced usage by at least 10% compared to the prior entry.',
    requirement: 'Reduce total usage by 10% vs. your previous entry.',
    icon: '⬡',
    xpBonus: 35,
    rewardPointBonus: 20,
  },
  {
    key: 'improvement-15',
    name: 'Smart Saver Achievement',
    description: 'Reduced usage by at least 15% compared to the prior entry.',
    requirement: 'Reduce total usage by 15% vs. your previous entry.',
    icon: '✺',
    xpBonus: 40,
    rewardPointBonus: 0,
  },
  {
    key: 'improvement-20',
    name: 'Power Trimmer Achievement',
    description: 'Reduced usage by at least 20% compared to the prior entry.',
    requirement: 'Reduce total usage by 20% vs. your previous entry.',
    icon: '✷',
    xpBonus: 50,
    rewardPointBonus: 0,
  },
  {
    key: 'dual-bill',
    name: 'Dual Utility Achievement',
    description: 'Tracked at least two paid utilities in one entry.',
    requirement: 'Submit one entry with 2 or more selected utilities.',
    icon: '◫',
    xpBonus: 8,
    rewardPointBonus: 0,
  },
  {
    key: 'triple-bill',
    name: 'Triple Utility Achievement',
    description: 'Tracked at least three paid utilities in one entry.',
    requirement: 'Submit one entry with 3 or more selected utilities.',
    icon: '◧',
    xpBonus: 12,
    rewardPointBonus: 0,
  },
  {
    key: 'full-household',
    name: 'Full Household Achievement',
    description: 'Tracked electricity, water, gas, and trash in a single entry.',
    requirement: 'Submit one entry with all 4 utility types selected.',
    icon: '⬟',
    xpBonus: 20,
    rewardPointBonus: 0,
  },
  {
    key: 'level-5',
    name: 'Level 5 Achievement',
    description: 'Reached level 5.',
    requirement: 'Reach level 5.',
    icon: '✦',
    xpBonus: 20,
    rewardPointBonus: 15,
  },
  {
    key: 'level-10',
    name: 'Level 10 Achievement',
    description: 'Reached level 10.',
    requirement: 'Reach level 10.',
    icon: '✶',
    xpBonus: 40,
    rewardPointBonus: 25,
  },
  {
    key: 'level-15',
    name: 'Level 15 Achievement',
    description: 'Reached level 15.',
    requirement: 'Reach level 15.',
    icon: '✹',
    xpBonus: 55,
    rewardPointBonus: 0,
  },
  {
    key: 'level-20',
    name: 'Level 20 Achievement',
    description: 'Reached level 20.',
    requirement: 'Reach level 20.',
    icon: '✺',
    xpBonus: 75,
    rewardPointBonus: 50,
  },
  {
    key: 'level-25',
    name: 'Level 25 Achievement',
    description: 'Reached level 25.',
    requirement: 'Reach level 25.',
    icon: '✵',
    xpBonus: 100,
    rewardPointBonus: 0,
  },
];

export const ensureBadgeCatalog = async () => {
  const defaultKeys = DEFAULT_BADGES.map((badge) => badge.key);

  await Badge.updateMany({ key: { $nin: defaultKeys } }, { $set: { active: false } });
  await Promise.all(
    DEFAULT_BADGES.map((badge) =>
      Badge.updateOne({ key: badge.key }, { $set: { ...badge, active: true } }, { upsert: true }),
    ),
  );

  return Badge.find({ active: true, key: { $in: defaultKeys } }).sort({ createdAt: 1 });
};

export const determineBadgeKeys = ({
  totalEntries = 0,
  streakCount = 0,
  level = 1,
  improvementPercent = 0,
  paidUtilityCount = 0,
}) => {
  const keys = [];

  if (totalEntries >= 1) keys.push('first-entry');
  if (totalEntries >= 2) keys.push('entries-2');
  if (totalEntries >= 3) keys.push('entries-3');
  if (totalEntries >= 6) keys.push('entries-6');
  if (totalEntries >= 12) keys.push('entries-12');
  if (totalEntries >= 18) keys.push('entries-18');
  if (totalEntries >= 24) keys.push('entries-24');

  if (streakCount >= 2) keys.push('streak-2');
  if (streakCount >= 3) keys.push('streak-3');
  if (streakCount >= 4) keys.push('streak-4');
  if (streakCount >= 6) keys.push('streak-6');
  if (streakCount >= 9) keys.push('streak-9');
  if (streakCount >= 12) keys.push('streak-12');

  if (improvementPercent >= 5) keys.push('improvement-5');
  if (improvementPercent >= 10) keys.push('usage-reducer');
  if (improvementPercent >= 15) keys.push('improvement-15');
  if (improvementPercent >= 20) keys.push('improvement-20');

  if (paidUtilityCount >= 2) keys.push('dual-bill');
  if (paidUtilityCount >= 3) keys.push('triple-bill');
  if (paidUtilityCount >= 4) keys.push('full-household');

  if (level >= 5) keys.push('level-5');
  if (level >= 10) keys.push('level-10');
  if (level >= 15) keys.push('level-15');
  if (level >= 20) keys.push('level-20');
  if (level >= 25) keys.push('level-25');

  return keys;
};

export const syncUserBadges = async (user, metrics) => {
  const badgeCatalog = await ensureBadgeCatalog();
  const eligibleKeys = determineBadgeKeys(metrics);
  const existingBadgeIds = new Set((user.badges || []).map((badgeId) => String(badgeId)));

  const unlockedBadges = badgeCatalog.filter(
    (badge) => eligibleKeys.includes(badge.key) && !existingBadgeIds.has(String(badge._id)),
  );

  if (unlockedBadges.length) {
    user.badges = [...(user.badges || []), ...unlockedBadges.map((badge) => badge._id)];
  }

  return unlockedBadges;
};

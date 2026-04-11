import Reward from '../models/Reward.js';
import RewardSettings from '../models/RewardSettings.js';
import { SUPPORTED_UTILITY_KEYS } from '../utils/validators.js';

export const DEFAULT_REWARDS = [
  {
    name: '$5 Gift Card',
    description: 'Redeem for a $5 gift card after admin approval.',
    pointsRequired: 500,
  },
  {
    name: '$10 Gift Card',
    description: 'Redeem for a $10 gift card after admin approval.',
    pointsRequired: 1000,
  },
  {
    name: '$25 Gift Card',
    description: 'Redeem for a $25 gift card after admin approval.',
    pointsRequired: 2500,
  },
];

export const DEFAULT_REWARD_SETTINGS = {
  key: 'default',
  basePoints: {
    electricity: 20,
    water: 20,
    gas: 15,
    trash: 10,
  },
  consistencyBonus: 10,
  improvementBonusPerCategory: 5,
  streakBonuses: {
    threeMonth: 15,
    sixMonth: 30,
    twelveMonth: 60,
  },
  badgeBonuses: {
    firstEntry: 10,
    streak3: 20,
    streak6: 40,
    streak12: 75,
    level5: 15,
    level10: 25,
    level20: 50,
    usageReducer: 20,
  },
  levelUpBonusPerLevel: 10,
  pointsPerDollar: 100,
};

const CATEGORY_LABELS = {
  electricity: 'Electricity',
  water: 'Water',
  gas: 'Gas',
  trash: 'Trash / Waste',
};

const BADGE_BONUS_KEYS = {
  'first-entry': 'firstEntry',
  'streak-3': 'streak3',
  'streak-6': 'streak6',
  'streak-12': 'streak12',
  'level-5': 'level5',
  'level-10': 'level10',
  'level-20': 'level20',
  'usage-reducer': 'usageReducer',
};

const getEligibleUtilityKeys = (paidUtilities = []) => {
  const normalized = Array.isArray(paidUtilities)
    ? paidUtilities.filter((key) => SUPPORTED_UTILITY_KEYS.includes(key))
    : [];

  return normalized.length ? normalized : SUPPORTED_UTILITY_KEYS;
};

const getFullHouseholdBaseTotal = (settings = DEFAULT_REWARD_SETTINGS) =>
  Math.round(
    SUPPORTED_UTILITY_KEYS.reduce(
      (sum, key) => sum + Number(settings.basePoints?.[key] || 0),
      0,
    ),
  );

const distributeIntegerPoints = (allocations = [], targetTotal = 0) => {
  const normalized = allocations.map((item, index) => ({
    ...item,
    index,
    rawAmount: Math.max(0, Number(item.amount || 0)),
  }));

  const baseTotal = normalized.reduce((sum, item) => sum + Math.floor(item.rawAmount), 0);
  let remainder = Math.max(0, Math.round(targetTotal) - baseTotal);

  const distributed = normalized.map((item) => ({
    ...item,
    amount: Math.floor(item.rawAmount),
  }));

  normalized
    .map((item) => ({
      index: item.index,
      fraction: item.rawAmount - Math.floor(item.rawAmount),
    }))
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index)
    .forEach(({ index }) => {
      if (remainder > 0) {
        distributed[index].amount += 1;
        remainder -= 1;
      }
    });

  return distributed;
};

const getScaledBasePointItems = ({ settings = DEFAULT_REWARD_SETTINGS, paidUtilities = [] }) => {
  const eligibleUtilities = getEligibleUtilityKeys(paidUtilities);
  const fullHouseholdBaseTotal = getFullHouseholdBaseTotal(settings);
  const selectedWeightTotal = eligibleUtilities.reduce(
    (sum, key) => sum + Number(settings.basePoints?.[key] || 0),
    0,
  );

  const weightedItems = distributeIntegerPoints(
    eligibleUtilities.map((key) => ({
      key,
      amount:
        (fullHouseholdBaseTotal * Number(settings.basePoints?.[key] || 0)) /
        Math.max(1, selectedWeightTotal),
    })),
    fullHouseholdBaseTotal,
  );

  return {
    eligibleUtilities,
    fullHouseholdBaseTotal,
    items: weightedItems.map((item) => ({
      key: item.key,
      label: `${CATEGORY_LABELS[item.key]} entry submitted`,
      amount: item.amount,
    })),
  };
};

const getScaledImprovementBonus = ({
  settings = DEFAULT_REWARD_SETTINGS,
  paidUtilities = [],
  improvedCategories = [],
}) => {
  const eligibleUtilities = getEligibleUtilityKeys(paidUtilities);
  const fullImprovementPool = Math.round(
    Number(settings.improvementBonusPerCategory || 0) * SUPPORTED_UTILITY_KEYS.length,
  );

  if (!eligibleUtilities.length || !improvedCategories.length || fullImprovementPool <= 0) {
    return {
      amount: 0,
      fullImprovementPool,
    };
  }

  const perUtilityAllocations = distributeIntegerPoints(
    eligibleUtilities.map((key) => ({
      key,
      amount: fullImprovementPool / eligibleUtilities.length,
    })),
    fullImprovementPool,
  );

  const amount = improvedCategories.reduce((sum, key) => {
    const match = perUtilityAllocations.find((item) => item.key === key);
    return sum + Number(match?.amount || 0);
  }, 0);

  return {
    amount,
    fullImprovementPool,
  };
};

const sanitizeRewardSettings = (settings = {}) => ({
  ...DEFAULT_REWARD_SETTINGS,
  ...settings,
  basePoints: SUPPORTED_UTILITY_KEYS.reduce((accumulator, key) => {
    accumulator[key] = Number(settings.basePoints?.[key] ?? DEFAULT_REWARD_SETTINGS.basePoints[key] ?? 0);
    return accumulator;
  }, {}),
  consistencyBonus: Number(settings.consistencyBonus ?? DEFAULT_REWARD_SETTINGS.consistencyBonus),
  improvementBonusPerCategory: Number(
    settings.improvementBonusPerCategory ?? DEFAULT_REWARD_SETTINGS.improvementBonusPerCategory,
  ),
  streakBonuses: {
    ...DEFAULT_REWARD_SETTINGS.streakBonuses,
    ...(settings.streakBonuses || {}),
  },
  badgeBonuses: {
    ...DEFAULT_REWARD_SETTINGS.badgeBonuses,
    ...(settings.badgeBonuses || {}),
  },
  levelUpBonusPerLevel: Number(
    settings.levelUpBonusPerLevel ?? DEFAULT_REWARD_SETTINGS.levelUpBonusPerLevel,
  ),
  pointsPerDollar: Math.max(1, Number(settings.pointsPerDollar ?? DEFAULT_REWARD_SETTINGS.pointsPerDollar)),
});

export const ensureDefaultRewards = async () => {
  const defaultRewardNames = DEFAULT_REWARDS.map((reward) => reward.name);

  await Reward.updateMany(
    { name: { $nin: defaultRewardNames } },
    { $set: { active: false } },
  );

  await Promise.all(
    DEFAULT_REWARDS.map((reward) =>
      Reward.findOneAndUpdate(
        { name: reward.name },
        { ...reward, active: true },
        { upsert: true, new: true, runValidators: true },
      ),
    ),
  );

  return Reward.find({ active: true, name: { $in: defaultRewardNames } }).sort({ pointsRequired: 1 });
};

export const getRewardSettings = async () => {
  const settings = await RewardSettings.findOneAndUpdate(
    { key: 'default' },
    { $setOnInsert: DEFAULT_REWARD_SETTINGS },
    { new: true, upsert: true },
  ).lean();

  return sanitizeRewardSettings(settings);
};

export const updateRewardSettings = async (payload = {}) => {
  const currentSettings = await getRewardSettings();

  const nextSettings = {
    key: 'default',
    basePoints: {
      electricity: Number(payload.basePoints?.electricity ?? currentSettings.basePoints.electricity),
      water: Number(payload.basePoints?.water ?? currentSettings.basePoints.water),
      gas: Number(payload.basePoints?.gas ?? currentSettings.basePoints.gas),
      trash: Number(payload.basePoints?.trash ?? currentSettings.basePoints.trash),
    },
    consistencyBonus: Number(payload.consistencyBonus ?? currentSettings.consistencyBonus),
    improvementBonusPerCategory: Number(
      payload.improvementBonusPerCategory ?? currentSettings.improvementBonusPerCategory,
    ),
    streakBonuses: {
      threeMonth: Number(payload.streakBonuses?.threeMonth ?? currentSettings.streakBonuses.threeMonth),
      sixMonth: Number(payload.streakBonuses?.sixMonth ?? currentSettings.streakBonuses.sixMonth),
      twelveMonth: Number(
        payload.streakBonuses?.twelveMonth ?? currentSettings.streakBonuses.twelveMonth,
      ),
    },
    badgeBonuses: {
      firstEntry: Number(payload.badgeBonuses?.firstEntry ?? currentSettings.badgeBonuses.firstEntry),
      streak3: Number(payload.badgeBonuses?.streak3 ?? currentSettings.badgeBonuses.streak3),
      streak6: Number(payload.badgeBonuses?.streak6 ?? currentSettings.badgeBonuses.streak6),
      streak12: Number(payload.badgeBonuses?.streak12 ?? currentSettings.badgeBonuses.streak12),
      level5: Number(payload.badgeBonuses?.level5 ?? currentSettings.badgeBonuses.level5),
      level10: Number(payload.badgeBonuses?.level10 ?? currentSettings.badgeBonuses.level10),
      level20: Number(payload.badgeBonuses?.level20 ?? currentSettings.badgeBonuses.level20),
      usageReducer: Number(payload.badgeBonuses?.usageReducer ?? currentSettings.badgeBonuses.usageReducer),
    },
    levelUpBonusPerLevel: Number(
      payload.levelUpBonusPerLevel ?? currentSettings.levelUpBonusPerLevel,
    ),
    pointsPerDollar: Math.max(1, Number(payload.pointsPerDollar ?? currentSettings.pointsPerDollar)),
  };

  return RewardSettings.findOneAndUpdate(
    { key: 'default' },
    nextSettings,
    { new: true, upsert: true, runValidators: true },
  ).lean();
};

export const calculateCashValue = (points = 0, settings = DEFAULT_REWARD_SETTINGS) =>
  Number((Number(points || 0) / Math.max(1, Number(settings.pointsPerDollar || 100))).toFixed(2));

export const buildRewardTransparency = (
  settings = DEFAULT_REWARD_SETTINGS,
  paidUtilities = SUPPORTED_UTILITY_KEYS,
) => {
  const { eligibleUtilities, fullHouseholdBaseTotal, items } = getScaledBasePointItems({
    settings,
    paidUtilities,
  });
  const utilityLabels = eligibleUtilities.map((key) => CATEGORY_LABELS[key]);
  const fullImprovementPool = Math.round(
    Number(settings.improvementBonusPerCategory || 0) * SUPPORTED_UTILITY_KEYS.length,
  );

  return {
    summary:
      `Reward points are transparent and fair: if you submit all of the bills you pay, you can earn the same base monthly reward pool as a household that pays all four bills (+${fullHouseholdBaseTotal} base points).`,
    factors: [
      `Your active tracked bills: ${utilityLabels.join(', ')}`,
      `Fair-share bill completion pool: up to +${fullHouseholdBaseTotal} points when you submit all of your selected bills.`,
      ...items.map((item) => `${CATEGORY_LABELS[item.key]} submission (N/A adding adjustment): +${item.amount} points`),
      `Consistency bonus: +${settings.consistencyBonus} points for staying current month-to-month`,
      `Improvement pool: up to +${fullImprovementPool} points across the paid bills you improve`,
      `3-month streak bonus: +${settings.streakBonuses.threeMonth} points`,
      `6-month streak bonus: +${settings.streakBonuses.sixMonth} points`,
      `12-month streak bonus: +${settings.streakBonuses.twelveMonth} points`,
      `Level-up bonus: +${settings.levelUpBonusPerLevel} points per level gained`,
      `${settings.pointsPerDollar} points = $1.00`,
    ],
  };
};

export const calculateImprovedCategories = ({ previousEntry, categories, paidUtilities = [] }) => {
  if (!previousEntry?.categories) {
    return { improvedCategories: [], improvedCount: 0 };
  }

  const eligibleUtilities = getEligibleUtilityKeys(paidUtilities);
  const improvedCategories = eligibleUtilities.filter((key) => {
    const currentValue = Number(categories?.[key]);
    const previousValue = Number(previousEntry.categories?.[key]);

    return Number.isFinite(currentValue) && Number.isFinite(previousValue) && currentValue < previousValue;
  });

  return {
    improvedCategories,
    improvedCount: improvedCategories.length,
  };
};

export const calculateRewardBreakdown = ({
  categories = {},
  paidUtilities = [],
  previousEntry = null,
  streakCount = 0,
  previousLevel = 1,
  newLevel = 1,
  unlockedBadges = [],
  settings = DEFAULT_REWARD_SETTINGS,
}) => {
  const items = [];
  const { eligibleUtilities, fullHouseholdBaseTotal, items: scaledBaseItems } = getScaledBasePointItems({
    settings,
    paidUtilities,
  });

  scaledBaseItems.forEach((item) => {
    if (item.amount > 0) {
      items.push({
        label: item.label,
        amount: item.amount,
      });
    }
  });

  if (streakCount >= 2) {
    items.push({ label: 'Consistency bonus', amount: Number(settings.consistencyBonus || 0) });
  }

  const { improvedCategories, improvedCount } = calculateImprovedCategories({
    previousEntry,
    categories,
    paidUtilities: eligibleUtilities,
  });
  const improvementBonus = getScaledImprovementBonus({
    settings,
    paidUtilities: eligibleUtilities,
    improvedCategories,
  });
  if (improvedCount > 0 && improvementBonus.amount > 0) {
    items.push({
      label: `Improvement bonus (${improvedCount === 1 ? '1 category improved' : `${improvedCount} categories improved`})`,
      amount: improvementBonus.amount,
    });
  }

  if (streakCount >= 12) {
    items.push({ label: '12-month streak bonus', amount: Number(settings.streakBonuses?.twelveMonth || 0) });
  } else if (streakCount >= 6) {
    items.push({ label: '6-month streak bonus', amount: Number(settings.streakBonuses?.sixMonth || 0) });
  } else if (streakCount >= 3) {
    items.push({ label: '3-month streak bonus', amount: Number(settings.streakBonuses?.threeMonth || 0) });
  }

  const levelsGained = Math.max(0, Number(newLevel || 1) - Number(previousLevel || 1));
  if (levelsGained > 0) {
    items.push({
      label: `Level-up bonus (${levelsGained} level${levelsGained > 1 ? 's' : ''})`,
      amount: levelsGained * Number(settings.levelUpBonusPerLevel || 0),
    });
  }

  unlockedBadges.forEach((badge) => {
    const badgeKey = BADGE_BONUS_KEYS[badge.key];
    const amount = Number(badge.rewardPointBonus ?? settings.badgeBonuses?.[badgeKey] ?? 0);

    if (amount > 0) {
      items.push({
        label: `${badge.name} bonus`,
        amount,
      });
    }
  });

  const totalPoints = items.reduce((sum, item) => sum + item.amount, 0);

  return {
    items,
    improvedCategories: improvedCategories.map((categoryKey) => CATEGORY_LABELS[categoryKey]),
    paidUtilities: eligibleUtilities.map((categoryKey) => CATEGORY_LABELS[categoryKey]),
    fairness: {
      fullHouseholdBaseTotal,
      fullImprovementPool: improvementBonus.fullImprovementPool,
    },
    totalPoints,
    cashValue: calculateCashValue(totalPoints, settings),
    conversionRate: settings.pointsPerDollar,
  };
};

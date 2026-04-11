import dotenv from 'dotenv';
import mongoose from 'mongoose';

import connectDatabase from '../config/db.js';
import { closeInsightsDatabase, connectInsightsDatabase } from '../config/insightsDb.js';
import Badge from '../models/Badge.js';
import BillingHistory from '../models/BillingHistory.js';
import Notification from '../models/Notification.js';
import ProviderChange from '../models/ProviderChange.js';
import Reward from '../models/Reward.js';
import User from '../models/User.js';
import UtilityEntry from '../models/UtilityEntry.js';
import { runAggregationJob } from '../services/aggregation.service.js';
import { ensureBadgeCatalog } from '../services/badgeService.js';
import { provisionBuyerAccess } from '../services/buyerAuth.service.js';
import { ensureDefaultRewards, getRewardSettings } from '../services/rewardService.js';

dotenv.config();

const CATEGORY_KEYS = ['electricity', 'water', 'gas', 'trash'];
const CATEGORY_RATES = {
  electricity: 0.18,
  water: 0.04,
  gas: 0.09,
  trash: 1.2,
};
const DEFAULT_BUYER_API_KEY = process.env.DEMO_BUYER_API_KEY || 'buyer_demo.safeinsights2026';
const PROVIDER_PROFILES = {
  north: {
    electricity: 'northgrid',
    water: 'clearflow',
    gas: 'blueflame',
    trash: 'citywaste',
  },
  south: {
    electricity: 'southgrid',
    water: 'deltawater',
    gas: 'heatco',
    trash: 'citywaste',
  },
  hq: {
    electricity: 'northgrid',
    water: 'clearflow',
    gas: 'blueflame',
    trash: 'citywaste',
  },
};

const buildHistoryEntries = (userId, { baseTotal = 540, variance = 0 } = {}) => {
  const totals = [36, 22, 12, -2, -14, -24].map((delta) => baseTotal + variance + delta);

  return totals.map((total, index) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - (totals.length - index - 1));

    const electricity = Math.round(total * 0.5);
    const water = Math.round(total * 0.19);
    const gas = Math.round(total * 0.16);
    const trash = total - electricity - water - gas;

    return {
      user: userId,
      month: date.getMonth() + 1,
      year: date.getFullYear(),
      paidUtilities: CATEGORY_KEYS,
      categories: { electricity, water, gas, trash },
      totalUsage: total,
      notes: 'Seeded demo history entry.',
    };
  });
};

const buildBillingHistoryEntries = (userId, region, historyEntries) => {
  const providers = PROVIDER_PROFILES[region] || PROVIDER_PROFILES.north;

  return historyEntries.flatMap((entry) =>
    CATEGORY_KEYS.map((category) => ({
      user: userId,
      month: entry.month,
      year: entry.year,
      region,
      provider: providers[category],
      category,
      amount: Number((entry.categories[category] * CATEGORY_RATES[category]).toFixed(2)),
      usageAmount: entry.categories[category],
      pricePerUnit: CATEGORY_RATES[category],
      billedAt: new Date(entry.year, entry.month - 1, 8),
    })),
  );
};

const buildProviderChangeEntries = (userId, region) => {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() - 1);

  return [
    {
      user: userId,
      fromProvider: 'northgrid',
      toProvider: 'sparkchoice',
      region,
      category: 'electricity',
      effectiveMonth: date.getMonth() + 1,
      effectiveYear: date.getFullYear(),
      reason: 'Seeded demo provider switch for aggregated buyer insights.',
      changedAt: new Date(date.getFullYear(), date.getMonth(), 12),
    },
  ];
};

const upsertUser = async ({
  name,
  email,
  password,
  role,
  xp,
  level,
  rewardPoints,
  streakCount,
  badges,
  rewardHistory = [],
  preferredUtilities = ['electricity', 'water', 'gas', 'trash'],
  preferredProviders = {
    electricity: '',
    water: '',
    gas: '',
    trash: '',
  },
  region = 'unassigned',
  mustChangePassword = false,
}) => {
  let user = await User.findOne({ email });

  if (!user) {
    user = new User({ name, email, password, role, region });
  }

  user.name = name;
  user.email = email;
  user.password = password;
  user.role = role;
  user.xp = xp;
  user.level = level;
  user.rewardPoints = rewardPoints;
  user.streakCount = streakCount;
  user.preferredUtilities = preferredUtilities;
  user.preferredProviders = preferredProviders;
  user.region = region;
  user.mustChangePassword = mustChangePassword;
  user.rewardHistory = rewardHistory;
  user.badges = badges;
  await user.save();

  return user;
};

const runSeed = async () => {
  await connectDatabase();
  await connectInsightsDatabase();
  await ensureDefaultRewards();
  const rewardSettings = await getRewardSettings();
  const badgeCatalog = await ensureBadgeCatalog();

  const badgeIds = (keys) =>
    badgeCatalog.filter((badge) => keys.includes(badge.key)).map((badge) => badge._id);

  const adminUser = await upsertUser({
    name: 'Utility Watch Admin',
    email: 'admin@utilitywatch.dev',
    password: 'Admin123!',
    role: 'admin',
    region: 'hq',
    mustChangePassword: true,
    xp: 640,
    level: 7,
    rewardPoints: 260,
    streakCount: 6,
    badges: badgeIds(['first-entry', 'streak-3', 'streak-6', 'level-5']),
    rewardHistory: [
      {
        source: 'monthly-entry',
        pointsEarned: 105,
        cashValue: Number((105 / rewardSettings.pointsPerDollar).toFixed(2)),
        balanceAfter: 260,
        description: 'Reward points earned for Mar 2026.',
        paidUtilities: ['Electricity', 'Water', 'Gas', 'Trash / Waste'],
        breakdown: [
          { label: 'Electricity entry submitted', amount: 20 },
          { label: 'Water entry submitted', amount: 20 },
          { label: 'Gas entry submitted', amount: 15 },
          { label: 'Trash / Waste entry submitted', amount: 10 },
          { label: 'Consistency bonus', amount: 10 },
          { label: '6-month streak bonus', amount: 30 },
        ],
      },
    ],
  });

  const householdConfigs = [
    {
      name: 'Jordan Lee',
      email: 'member@utilitywatch.dev',
      password: 'Member123!',
      xp: 470,
      level: 5,
      rewardPoints: 185,
      streakCount: 4,
      baseTotal: 548,
      variance: 0,
      badges: badgeIds(['first-entry', 'streak-3', 'usage-reducer', 'level-5']),
      rewardHistory: [
        {
          source: 'monthly-entry',
          pointsEarned: 100,
          cashValue: Number((100 / rewardSettings.pointsPerDollar).toFixed(2)),
          balanceAfter: 185,
          description: 'Reward points earned for Apr 2026.',
          paidUtilities: ['Electricity', 'Water', 'Gas', 'Trash / Waste'],
          breakdown: [
            { label: 'Electricity entry submitted', amount: 20 },
            { label: 'Water entry submitted', amount: 20 },
            { label: 'Gas entry submitted', amount: 15 },
            { label: 'Trash / Waste entry submitted', amount: 10 },
            { label: 'Consistency bonus', amount: 10 },
            { label: 'Improvement bonus (3 categories improved)', amount: 15 },
            { label: 'Level-up bonus (1 level)', amount: 10 },
          ],
        },
      ],
    },
    { name: 'Avery Stone', email: 'avery@utilitywatch.dev', password: 'Member123!', xp: 420, level: 4, rewardPoints: 140, streakCount: 3, baseTotal: 534, variance: 4, badges: badgeIds(['first-entry', 'streak-3']) },
    { name: 'Cameron Brooks', email: 'cameron@utilitywatch.dev', password: 'Member123!', xp: 455, level: 5, rewardPoints: 172, streakCount: 4, baseTotal: 526, variance: -3, badges: badgeIds(['first-entry', 'streak-3']) },
    { name: 'Skyler Price', email: 'skyler@utilitywatch.dev', password: 'Member123!', xp: 390, level: 4, rewardPoints: 118, streakCount: 2, baseTotal: 512, variance: 6, badges: badgeIds(['first-entry']) },
    { name: 'Morgan Diaz', email: 'morgan.diaz@utilitywatch.dev', password: 'Member123!', xp: 438, level: 4, rewardPoints: 154, streakCount: 3, baseTotal: 520, variance: 1, badges: badgeIds(['first-entry', 'streak-3']) },
  ];

  const seededHouseholds = [];

  for (const config of householdConfigs) {
    const user = await upsertUser({
      ...config,
      role: 'user',
      region: 'north',
    });

    const historyEntries = buildHistoryEntries(user._id, {
      baseTotal: config.baseTotal,
      variance: config.variance,
    });

    seededHouseholds.push({ user, historyEntries });
  }

  const householdUserIds = seededHouseholds.map((item) => item.user._id);
  await UtilityEntry.deleteMany({ user: { $in: householdUserIds } });
  await UtilityEntry.insertMany(seededHouseholds.flatMap((item) => item.historyEntries));

  await BillingHistory.deleteMany({ user: { $in: householdUserIds } });
  await BillingHistory.insertMany(
    seededHouseholds.flatMap((item) => buildBillingHistoryEntries(item.user._id, item.user.region, item.historyEntries)),
  );

  await ProviderChange.deleteMany({ user: { $in: householdUserIds } });
  await ProviderChange.insertMany(seededHouseholds.slice(0, 2).flatMap((item) => buildProviderChangeEntries(item.user._id, item.user.region)));

  const buyerProvision = await provisionBuyerAccess({
    name: 'Insight Buyer',
    email: 'buyer@utilitywatch.dev',
    pin: '246810',
    region: 'north',
    apiKey: DEFAULT_BUYER_API_KEY,
  });

  await Notification.deleteMany({ user: { $in: [adminUser._id, ...householdUserIds] } });
  await Notification.insertMany([
    {
      user: seededHouseholds[0].user._id,
      title: 'XP earned',
      message: 'You earned 80 XP from your latest utility entry.',
      type: 'xp',
      read: false,
    },
    {
      user: seededHouseholds[0].user._id,
      title: 'Achievement unlocked',
      message: 'You unlocked the Usage Reducer Achievement.',
      type: 'badge',
      read: false,
    },
    {
      user: adminUser._id,
      title: 'Admin summary',
      message: 'Demo analytics and payout review data are ready.',
      type: 'admin',
      read: false,
    },
  ]);

  const aggregationResult = await runAggregationJob({ trigger: 'seed-script' });
  const rewardCount = await Reward.countDocuments({ active: true });
  const badgeCount = await Badge.countDocuments();
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();

  console.log('Seed complete.');
  console.log(`Admin login: admin@utilitywatch.dev / Admin123!`);
  console.log(`Member login: member@utilitywatch.dev / Member123!`);
  console.log(`Buyer login: buyer@utilitywatch.dev / 246810`);
  console.log(`Buyer API key: ${buyerProvision.apiKey}`);
  console.log(`Insights ready: ${aggregationResult.summary.monthlySummaryCount} monthly summaries, ${aggregationResult.summary.providerTrendCount} provider trend records.`);
  console.log(`Rewards available: ${rewardCount}`);
  console.log(`Achievements available: ${badgeCount}`);
  console.log('Example buyer login (PowerShell):');
  console.log(`Invoke-RestMethod -Method Post -Uri "http://localhost:5000/api/buyer/auth/login" -ContentType "application/json" -Body '{"email":"buyer@utilitywatch.dev","pin":"246810"}'`);
  console.log('Example monthly insights call (PowerShell):');
  console.log(`Invoke-RestMethod -Headers @{ 'x-api-key'='${buyerProvision.apiKey}' } -Uri "http://localhost:5000/api/insights/usage/monthly?region=north&month=${currentMonth}&year=${currentYear}"`);
  console.log('Example provider trends call (curl):');
  console.log(`curl -H "x-api-key: ${buyerProvision.apiKey}" "http://localhost:5000/api/insights/providers/trends?region=north&provider=northgrid&month=${currentMonth}&year=${currentYear}"`);

  await closeInsightsDatabase();
  await mongoose.connection.close();
};

runSeed().catch(async (error) => {
  console.error('Seed failed:', error.message);
  await closeInsightsDatabase();
  await mongoose.connection.close();
  process.exit(1);
});

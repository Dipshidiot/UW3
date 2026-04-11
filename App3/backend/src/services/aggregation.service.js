import AggregatedUsage from '../models/AggregatedUsage.js';
import BillingHistory from '../models/BillingHistory.js';
import CategorySpendTrend from '../models/CategorySpendTrend.js';
import MonthlySummary from '../models/MonthlySummary.js';
import ProviderChange from '../models/ProviderChange.js';
import ProviderTrend from '../models/ProviderTrend.js';
import RegionalStat from '../models/RegionalStat.js';
import User from '../models/User.js';
import UtilityEntry from '../models/UtilityEntry.js';
import { connectInsightsDatabase } from '../config/insightsDb.js';

const CATEGORY_KEYS = ['electricity', 'water', 'gas', 'trash'];
const CATEGORY_SPEND_RATES = {
  electricity: 0.18,
  water: 0.04,
  gas: 0.09,
  trash: 1.2,
};

let aggregationTimer;
let lastNightlyRunKey = '';

const round = (value, decimals = 2) => Number(Number(value || 0).toFixed(decimals));
const emptyCategoryMetrics = () => ({ electricity: 0, water: 0, gas: 0, trash: 0 });
const buildMonthKey = (year, month) => `${year}-${String(month).padStart(2, '0')}`;
const normalizeRegion = (value = '') => String(value || 'unassigned').trim().toLowerCase() || 'unassigned';
const normalizeProvider = (value = '') => String(value || 'market-average').trim().toLowerCase() || 'market-average';
const normalizeCategory = (value = '') => {
  const normalized = String(value || '').trim().toLowerCase();
  return CATEGORY_KEYS.includes(normalized) ? normalized : null;
};

const addCategoryValues = (target, source = {}) => {
  CATEGORY_KEYS.forEach((key) => {
    target[key] = round((target[key] || 0) + Number(source[key] || 0));
  });
  return target;
};

const buildUsageBucket = () => ({
  users: new Set(),
  entryCount: 0,
  totalUsage: 0,
  categoryTotals: emptyCategoryMetrics(),
});

const buildRegionalBucket = () => ({
  users: new Set(),
  totalUsage: 0,
  categoryTotals: emptyCategoryMetrics(),
});

const buildSpendBucket = () => ({
  users: new Set(),
  totalSpend: 0,
  spendTotals: emptyCategoryMetrics(),
});

const buildMonthlyBucket = () => ({
  users: new Set(),
  entryCount: 0,
  totalUsage: 0,
  categoryTotals: emptyCategoryMetrics(),
  regions: new Set(),
  totalSpend: 0,
});

const buildProviderBucket = () => ({
  users: new Set(),
  recordCount: 0,
  totalSpend: 0,
  totalPricePerUnit: 0,
  switchCount: 0,
});

const deriveSpendByCategory = (categories = {}) =>
  CATEGORY_KEYS.reduce((accumulator, key) => {
    accumulator[key] = round(Number(categories[key] || 0) * CATEGORY_SPEND_RATES[key]);
    return accumulator;
  }, emptyCategoryMetrics());

const writeDocuments = async (Model, documents) => {
  await Model.deleteMany({});

  if (documents.length) {
    await Model.insertMany(documents, { ordered: false });
  }
};

const buildSpendRecords = (entries, billingHistory, regionByUserId) => {
  if (billingHistory.length) {
    return billingHistory
      .map((record) => {
        const category = normalizeCategory(record.category);

        if (!category) {
          return null;
        }

        const region = normalizeRegion(record.region || regionByUserId.get(String(record.user)));
        const amount = Number(record.amount || 0);
        const usageAmount = Number(record.usageAmount || 0);
        const pricePerUnit = Number(record.pricePerUnit || (usageAmount ? amount / usageAmount : 0));

        return {
          year: Number(record.year),
          month: Number(record.month),
          region,
          provider: normalizeProvider(record.provider),
          category,
          amount: round(amount),
          usageAmount: round(usageAmount),
          pricePerUnit: round(pricePerUnit, 4),
          userId: String(record.user || ''),
        };
      })
      .filter(Boolean);
  }

  return entries.flatMap((entry) => {
    const region = normalizeRegion(regionByUserId.get(String(entry.user)));
    const estimatedSpend = deriveSpendByCategory(entry.categories || {});

    return CATEGORY_KEYS.filter((key) => Number(entry.categories?.[key] || 0) > 0).map((key) => ({
      year: Number(entry.year),
      month: Number(entry.month),
      region,
      provider: 'market-average',
      category: key,
      amount: round(estimatedSpend[key]),
      usageAmount: round(Number(entry.categories?.[key] || 0)),
      pricePerUnit: round(CATEGORY_SPEND_RATES[key], 4),
      userId: String(entry.user || ''),
    }));
  });
};

const buildProviderSwitchMaps = (providerChanges, regionByUserId) => {
  const providerSwitchMap = new Map();
  const monthlySwitchMap = new Map();

  providerChanges.forEach((change) => {
    const month = Number(change.effectiveMonth);
    const year = Number(change.effectiveYear);
    const category = normalizeCategory(change.category);

    if (!Number.isInteger(month) || !Number.isInteger(year) || !category) {
      return;
    }

    const region = normalizeRegion(change.region || regionByUserId.get(String(change.user)));
    const provider = normalizeProvider(change.toProvider);
    const providerKey = JSON.stringify([year, month, region, provider, category]);
    const monthKey = buildMonthKey(year, month);

    providerSwitchMap.set(providerKey, (providerSwitchMap.get(providerKey) || 0) + 1);
    monthlySwitchMap.set(monthKey, (monthlySwitchMap.get(monthKey) || 0) + 1);
  });

  return { providerSwitchMap, monthlySwitchMap };
};

export const buildRegionalStatDocuments = ({ entries, regionByUserId, spendByRegionMap }) => {
  const regionalBuckets = new Map();

  entries.forEach((entry) => {
    const month = Number(entry.month);
    const year = Number(entry.year);

    if (!Number.isInteger(month) || !Number.isInteger(year)) {
      return;
    }

    const region = normalizeRegion(regionByUserId.get(String(entry.user)));
    const bucketKey = `${year}-${month}-${region}`;
    const bucket = regionalBuckets.get(bucketKey) || buildRegionalBucket();

    bucket.users.add(String(entry.user));
    bucket.totalUsage = round(bucket.totalUsage + Number(entry.totalUsage || 0));
    addCategoryValues(bucket.categoryTotals, entry.categories || {});

    regionalBuckets.set(bucketKey, bucket);
  });

  const regionalDocs = Array.from(regionalBuckets.entries()).map(([bucketKey, bucket]) => {
    const [yearPart, monthPart, ...regionParts] = bucketKey.split('-');
    const region = regionParts.join('-');
    const householdCount = bucket.users.size;
    const spendBucket = spendByRegionMap.get(bucketKey) || buildSpendBucket();

    return {
      year: Number(yearPart),
      month: Number(monthPart),
      region,
      householdCount,
      totalUsage: round(bucket.totalUsage),
      averageUsage: householdCount ? round(bucket.totalUsage / householdCount) : 0,
      averageHouseholdSpend: householdCount ? round((spendBucket.totalSpend || 0) / householdCount) : 0,
      categoryTotals: bucket.categoryTotals,
      categoryAverages: CATEGORY_KEYS.reduce((accumulator, key) => {
        accumulator[key] = householdCount ? round((bucket.categoryTotals[key] || 0) / householdCount) : 0;
        return accumulator;
      }, emptyCategoryMetrics()),
      spendTotals: spendBucket.spendTotals,
      anomalyFlag: false,
      anomalyDeltaPercent: 0,
      refreshedAt: new Date(),
    };
  });

  const docsByRegion = new Map();

  regionalDocs.forEach((doc) => {
    const list = docsByRegion.get(doc.region) || [];
    list.push(doc);
    docsByRegion.set(doc.region, list);
  });

  docsByRegion.forEach((docs) => {
    docs.sort((left, right) => new Date(left.year, left.month - 1).getTime() - new Date(right.year, right.month - 1).getTime());

    for (let index = 1; index < docs.length; index += 1) {
      const current = docs[index];
      const previous = docs[index - 1];

      if (!previous.averageUsage) {
        continue;
      }

      const deltaPercent = round(((current.averageUsage - previous.averageUsage) / previous.averageUsage) * 100);
      current.anomalyDeltaPercent = deltaPercent;
      current.anomalyFlag = Math.abs(deltaPercent) >= 20 && current.householdCount >= 5 && previous.householdCount >= 5;
    }
  });

  return regionalDocs;
};

export const buildProviderTrendDocuments = ({ spendRecords, providerSwitchMap }) => {
  const providerBuckets = new Map();

  spendRecords.forEach((record) => {
    const month = Number(record.month);
    const year = Number(record.year);
    const category = normalizeCategory(record.category);

    if (!Number.isInteger(month) || !Number.isInteger(year) || !category) {
      return;
    }

    const region = normalizeRegion(record.region);
    const provider = normalizeProvider(record.provider);
    const key = JSON.stringify([year, month, region, provider, category]);
    const bucket = providerBuckets.get(key) || buildProviderBucket();

    bucket.users.add(String(record.userId || ''));
    bucket.recordCount += 1;
    bucket.totalSpend = round(bucket.totalSpend + Number(record.amount || 0));
    bucket.totalPricePerUnit = round(bucket.totalPricePerUnit + Number(record.pricePerUnit || 0), 4);
    bucket.switchCount = providerSwitchMap.get(key) || 0;

    providerBuckets.set(key, bucket);
  });

  const providerDocs = Array.from(providerBuckets.entries()).map(([key, bucket]) => {
    const [yearPart, monthPart, regionPart, providerPart, category] = JSON.parse(key);
    const householdCount = bucket.users.size;

    return {
      year: Number(yearPart),
      month: Number(monthPart),
      region: regionPart,
      provider: providerPart,
      category,
      householdCount,
      recordCount: bucket.recordCount,
      totalSpend: round(bucket.totalSpend),
      averageMonthlyCost: householdCount ? round(bucket.totalSpend / householdCount) : 0,
      averagePricePerUnit: bucket.recordCount ? round(bucket.totalPricePerUnit / bucket.recordCount, 4) : 0,
      priceChangePercent: 0,
      switchCount: bucket.switchCount,
      switchRate: householdCount ? round((bucket.switchCount / householdCount) * 100) : 0,
      refreshedAt: new Date(),
    };
  });

  const docsByProviderAndCategory = new Map();

  providerDocs.forEach((doc) => {
    const listKey = `${doc.region}-${doc.provider}-${doc.category}`;
    const list = docsByProviderAndCategory.get(listKey) || [];
    list.push(doc);
    docsByProviderAndCategory.set(listKey, list);
  });

  docsByProviderAndCategory.forEach((docs) => {
    docs.sort((left, right) => new Date(left.year, left.month - 1).getTime() - new Date(right.year, right.month - 1).getTime());

    for (let index = 1; index < docs.length; index += 1) {
      const current = docs[index];
      const previous = docs[index - 1];

      if (!previous.averagePricePerUnit) {
        continue;
      }

      current.priceChangePercent = round(
        ((current.averagePricePerUnit - previous.averagePricePerUnit) / previous.averagePricePerUnit) * 100,
      );
    }
  });

  return providerDocs;
};

export const runAggregationJob = async ({ trigger = 'manual' } = {}) => {
  await connectInsightsDatabase();

  const [users, entries, billingHistory, providerChanges] = await Promise.all([
    User.find().select('_id region').lean(),
    UtilityEntry.find().select('user month year categories totalUsage').lean(),
    BillingHistory.find().select('user month year region provider category amount usageAmount pricePerUnit').lean(),
    ProviderChange.find().select('user fromProvider toProvider region category effectiveMonth effectiveYear').lean(),
  ]);

  const regionByUserId = new Map(
    users.map((user) => [String(user._id), normalizeRegion(user.region)]),
  );

  const usageBuckets = new Map();
  const monthlyBuckets = new Map();

  entries.forEach((entry) => {
    const month = Number(entry.month);
    const year = Number(entry.year);

    if (!Number.isInteger(month) || !Number.isInteger(year)) {
      return;
    }

    const userId = String(entry.user || '');
    const region = normalizeRegion(regionByUserId.get(userId));
    const usageKeys = [
      `${year}-${month}-all`,
      `${year}-${month}-${region}`,
    ];

    usageKeys.forEach((bucketKey) => {
      const bucket = usageBuckets.get(bucketKey) || buildUsageBucket();
      bucket.users.add(userId);
      bucket.entryCount += 1;
      bucket.totalUsage = round(bucket.totalUsage + Number(entry.totalUsage || 0));
      addCategoryValues(bucket.categoryTotals, entry.categories || {});
      usageBuckets.set(bucketKey, bucket);
    });

    const monthlyKey = buildMonthKey(year, month);
    const monthlyBucket = monthlyBuckets.get(monthlyKey) || buildMonthlyBucket();
    monthlyBucket.users.add(userId);
    monthlyBucket.entryCount += 1;
    monthlyBucket.totalUsage = round(monthlyBucket.totalUsage + Number(entry.totalUsage || 0));
    addCategoryValues(monthlyBucket.categoryTotals, entry.categories || {});
    monthlyBucket.regions.add(region);
    monthlyBuckets.set(monthlyKey, monthlyBucket);
  });

  const spendRecords = buildSpendRecords(entries, billingHistory, regionByUserId);
  const spendByRegionMap = new Map();
  const spendByMonthMap = new Map();
  const categorySpendBuckets = new Map();

  spendRecords.forEach((record) => {
    const month = Number(record.month);
    const year = Number(record.year);
    const category = normalizeCategory(record.category);

    if (!Number.isInteger(month) || !Number.isInteger(year) || !category) {
      return;
    }

    const region = normalizeRegion(record.region);
    const userId = String(record.userId || '');
    const regionKey = `${year}-${month}-${region}`;
    const monthKey = buildMonthKey(year, month);
    const categoryKey = JSON.stringify([year, month, region, category]);

    const regionBucket = spendByRegionMap.get(regionKey) || buildSpendBucket();
    regionBucket.users.add(userId);
    regionBucket.totalSpend = round(regionBucket.totalSpend + Number(record.amount || 0));
    regionBucket.spendTotals[category] = round(regionBucket.spendTotals[category] + Number(record.amount || 0));
    spendByRegionMap.set(regionKey, regionBucket);

    const monthBucket = spendByMonthMap.get(monthKey) || buildSpendBucket();
    monthBucket.users.add(userId);
    monthBucket.totalSpend = round(monthBucket.totalSpend + Number(record.amount || 0));
    monthBucket.spendTotals[category] = round(monthBucket.spendTotals[category] + Number(record.amount || 0));
    spendByMonthMap.set(monthKey, monthBucket);

    const categoryBucket = categorySpendBuckets.get(categoryKey) || { users: new Set(), totalSpend: 0 };
    categoryBucket.users.add(userId);
    categoryBucket.totalSpend = round(categoryBucket.totalSpend + Number(record.amount || 0));
    categorySpendBuckets.set(categoryKey, categoryBucket);
  });

  const regionalDocs = buildRegionalStatDocuments({ entries, regionByUserId, spendByRegionMap });
  const { providerSwitchMap, monthlySwitchMap } = buildProviderSwitchMaps(providerChanges, regionByUserId);
  const providerDocs = buildProviderTrendDocuments({ spendRecords, providerSwitchMap });

  const anomalyCountByMonth = regionalDocs.reduce((accumulator, doc) => {
    if (doc.anomalyFlag) {
      const key = buildMonthKey(doc.year, doc.month);
      accumulator.set(key, (accumulator.get(key) || 0) + 1);
    }

    return accumulator;
  }, new Map());

  const aggregatedUsageDocs = Array.from(usageBuckets.entries()).map(([bucketKey, bucket]) => {
    const [yearPart, monthPart, ...regionParts] = bucketKey.split('-');
    const householdCount = bucket.users.size;

    return {
      year: Number(yearPart),
      month: Number(monthPart),
      region: regionParts.join('-'),
      householdCount,
      entryCount: bucket.entryCount,
      totalUsage: round(bucket.totalUsage),
      averageUsage: householdCount ? round(bucket.totalUsage / householdCount) : 0,
      categoryTotals: bucket.categoryTotals,
      categoryAverages: CATEGORY_KEYS.reduce((accumulator, key) => {
        accumulator[key] = householdCount ? round((bucket.categoryTotals[key] || 0) / householdCount) : 0;
        return accumulator;
      }, emptyCategoryMetrics()),
      refreshedAt: new Date(),
    };
  });

  const monthlyDocs = Array.from(monthlyBuckets.entries()).map(([monthKey, bucket]) => {
    const [yearPart, monthPart] = monthKey.split('-');
    const householdCount = bucket.users.size;
    const monthSpendBucket = spendByMonthMap.get(monthKey) || buildSpendBucket();
    const switchCount = monthlySwitchMap.get(monthKey) || 0;

    return {
      year: Number(yearPart),
      month: Number(monthPart),
      householdCount,
      entryCount: bucket.entryCount,
      totalUsage: round(bucket.totalUsage),
      averageUsage: householdCount ? round(bucket.totalUsage / householdCount) : 0,
      averageHouseholdSpend: householdCount ? round((monthSpendBucket.totalSpend || 0) / householdCount) : 0,
      categoryTotals: bucket.categoryTotals,
      categoryAverages: CATEGORY_KEYS.reduce((accumulator, key) => {
        accumulator[key] = householdCount ? round((bucket.categoryTotals[key] || 0) / householdCount) : 0;
        return accumulator;
      }, emptyCategoryMetrics()),
      regionsCovered: bucket.regions.size,
      anomalyCount: anomalyCountByMonth.get(monthKey) || 0,
      switchCount,
      switchRate: householdCount ? round((switchCount / householdCount) * 100) : 0,
      refreshedAt: new Date(),
    };
  });

  const categoryTrendDocs = Array.from(categorySpendBuckets.entries()).map(([bucketKey, bucket]) => {
    const [yearPart, monthPart, regionPart, category] = JSON.parse(bucketKey);
    const householdCount = bucket.users.size;
    const monthSpendKey = buildMonthKey(Number(yearPart), Number(monthPart));
    const regionSpendKey = `${yearPart}-${monthPart}-${regionPart}`;
    const regionSpendBucket = spendByRegionMap.get(regionSpendKey) || buildSpendBucket();

    return {
      year: Number(yearPart),
      month: Number(monthPart),
      region: regionPart,
      category,
      householdCount,
      totalSpend: round(bucket.totalSpend),
      averageSpend: householdCount ? round(bucket.totalSpend / householdCount) : 0,
      percentageOfMonthlySpend: regionSpendBucket.totalSpend
        ? round((bucket.totalSpend / regionSpendBucket.totalSpend) * 100)
        : 0,
      trendPercent: 0,
      refreshedAt: new Date(),
    };
  });

  const categoryDocsByRegionAndCategory = new Map();

  categoryTrendDocs.forEach((doc) => {
    const key = `${doc.region}-${doc.category}`;
    const list = categoryDocsByRegionAndCategory.get(key) || [];
    list.push(doc);
    categoryDocsByRegionAndCategory.set(key, list);
  });

  categoryDocsByRegionAndCategory.forEach((docs) => {
    docs.sort((left, right) => new Date(left.year, left.month - 1).getTime() - new Date(right.year, right.month - 1).getTime());

    for (let index = 1; index < docs.length; index += 1) {
      const current = docs[index];
      const previous = docs[index - 1];

      if (!previous.totalSpend) {
        continue;
      }

      current.trendPercent = round(((current.totalSpend - previous.totalSpend) / previous.totalSpend) * 100);
    }
  });

  await Promise.all([
    writeDocuments(AggregatedUsage, aggregatedUsageDocs),
    writeDocuments(RegionalStat, regionalDocs),
    writeDocuments(ProviderTrend, providerDocs),
    writeDocuments(MonthlySummary, monthlyDocs),
    writeDocuments(CategorySpendTrend, categoryTrendDocs),
  ]);

  return {
    trigger,
    generatedAt: new Date().toISOString(),
    summary: {
      aggregatedUsageCount: aggregatedUsageDocs.length,
      regionalStatsCount: regionalDocs.length,
      providerTrendCount: providerDocs.length,
      monthlySummaryCount: monthlyDocs.length,
      categorySpendTrendCount: categoryTrendDocs.length,
    },
  };
};

const runNightlyAggregationIfDue = async () => {
  const hourUtc = Number(process.env.AGGREGATION_HOUR_UTC || 2);
  const now = new Date();
  const runKey = `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}`;

  if (now.getUTCHours() !== hourUtc || lastNightlyRunKey === runKey) {
    return;
  }

  lastNightlyRunKey = runKey;
  await runAggregationJob({ trigger: 'nightly-cron' });
};

export const startAggregationJobs = () => {
  if (aggregationTimer) {
    return aggregationTimer;
  }

  const pollMs = Number(process.env.AGGREGATION_POLL_MS || 60 * 60 * 1000);
  aggregationTimer = setInterval(() => {
    runNightlyAggregationIfDue().catch((error) => {
      console.error('Nightly aggregation failed:', error.message);
    });
  }, pollMs);

  if (typeof aggregationTimer.unref === 'function') {
    aggregationTimer.unref();
  }

  runAggregationJob({ trigger: 'startup-warm-cache' }).catch((error) => {
    console.error('Initial aggregation warm-up failed:', error.message);
  });

  return aggregationTimer;
};

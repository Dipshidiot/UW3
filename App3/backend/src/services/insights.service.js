import AggregatedUsage from '../models/AggregatedUsage.js';
import CategorySpendTrend from '../models/CategorySpendTrend.js';
import MonthlySummary from '../models/MonthlySummary.js';
import ProviderTrend from '../models/ProviderTrend.js';
import RegionalStat from '../models/RegionalStat.js';
import { connectInsightsDatabase } from '../config/insightsDb.js';
import { createHttpError } from '../utils/httpError.js';
import { runAggregationJob } from './aggregation.service.js';

const MIN_PRIVACY_HOUSEHOLDS = 5;
const BLOCKED_FILTER_PATTERN = /(user|email|name|identifier|receipt|timestamp|createdat|updatedat|hash|token)/i;
const ALLOWED_FILTERS = ['region', 'provider', 'month', 'year', 'category'];

const round = (value, decimals = 2) => Number(Number(value || 0).toFixed(decimals));

const normalizeFilterValue = (key, value) => {
  if (key === 'month') {
    const month = Number(value);

    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw createHttpError(400, 'Month must be an integer from 1 to 12.');
    }

    return month;
  }

  if (key === 'year') {
    const year = Number(value);

    if (!Number.isInteger(year) || year < 2000 || year > 9999) {
      throw createHttpError(400, 'Year must be a valid four-digit value.');
    }

    return year;
  }

  return String(value || '').trim().toLowerCase();
};

const sanitizeFilters = (rawFilters = {}, allowedFilters = ALLOWED_FILTERS) => {
  const filters = {};

  Object.entries(rawFilters || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    const normalizedKey = String(key || '').trim().toLowerCase();

    if (BLOCKED_FILTER_PATTERN.test(normalizedKey)) {
      throw createHttpError(400, `Blocked filter "${key}" cannot be used. Raw identifiers are not allowed.`);
    }

    if (!allowedFilters.includes(normalizedKey)) {
      throw createHttpError(400, `Unsupported filter "${key}" for this insights endpoint.`);
    }

    filters[normalizedKey] = normalizeFilterValue(normalizedKey, value);
  });

  return filters;
};

const buildQuery = (filters = {}) => {
  const query = {};

  if (filters.region) {
    query.region = filters.region;
  }

  if (filters.provider) {
    query.provider = filters.provider;
  }

  if (filters.category) {
    query.category = filters.category;
  }

  if (filters.month) {
    query.month = filters.month;
  }

  if (filters.year) {
    query.year = filters.year;
  }

  return query;
};

const ensureAggregationsReady = async (Model) => {
  await connectInsightsDatabase();
  const existingCount = await Model.countDocuments();

  if (!existingCount) {
    await runAggregationJob({ trigger: 'on-demand-insights-request' });
  }
};

const enforcePrivacyThreshold = (documents, filters) => {
  const safeDocuments = documents.filter((document) => {
    const audienceSize = document.householdCount ?? document.recordCount ?? 0;
    return audienceSize >= MIN_PRIVACY_HOUSEHOLDS;
  });

  const targetedFilters = Boolean(filters.region || filters.provider || filters.category);

  if (targetedFilters && documents.length > 0 && safeDocuments.length !== documents.length) {
    throw createHttpError(
      403,
      `This request would fall below the minimum privacy threshold of at least ${MIN_PRIVACY_HOUSEHOLDS} households.`,
    );
  }

  return safeDocuments;
};

const buildResponse = (filters, data) => ({
  meta: {
    scope: 'aggregated',
    privacyThreshold: MIN_PRIVACY_HOUSEHOLDS,
    filters,
    resultCount: data.length,
    generatedAt: data[0]?.refreshedAt || new Date().toISOString(),
  },
  data,
});

export const getMonthlyUsageInsights = async (rawFilters = {}) => {
  const filters = sanitizeFilters(rawFilters, ['region', 'month', 'year']);
  await ensureAggregationsReady(AggregatedUsage);

  const query = buildQuery(filters);

  if (!filters.region) {
    query.region = 'all';
  }

  const documents = await AggregatedUsage.find(query).sort({ year: -1, month: -1, region: 1 }).lean();
  const safeDocuments = enforcePrivacyThreshold(documents, filters).map((document) => ({
    year: document.year,
    month: document.month,
    region: document.region,
    householdCount: document.householdCount,
    entryCount: document.entryCount,
    totalUsage: round(document.totalUsage),
    averageUsage: round(document.averageUsage),
    categoryTotals: document.categoryTotals,
    categoryAverages: document.categoryAverages,
    refreshedAt: document.refreshedAt,
  }));

  return buildResponse(filters, safeDocuments);
};

export const getRegionalUsageInsights = async (rawFilters = {}) => {
  const filters = sanitizeFilters(rawFilters, ['region', 'month', 'year']);
  await ensureAggregationsReady(RegionalStat);

  const documents = await RegionalStat.find(buildQuery(filters)).sort({ year: -1, month: -1, region: 1 }).lean();
  const safeDocuments = enforcePrivacyThreshold(documents, filters).map((document) => ({
    year: document.year,
    month: document.month,
    region: document.region,
    householdCount: document.householdCount,
    totalUsage: round(document.totalUsage),
    averageUsage: round(document.averageUsage),
    averageHouseholdSpend: round(document.averageHouseholdSpend),
    categoryTotals: document.categoryTotals,
    categoryAverages: document.categoryAverages,
    refreshedAt: document.refreshedAt,
  }));

  return buildResponse(filters, safeDocuments);
};

export const getProviderTrendsInsights = async (rawFilters = {}) => {
  const filters = sanitizeFilters(rawFilters, ['region', 'provider', 'month', 'year', 'category']);
  await ensureAggregationsReady(ProviderTrend);

  const documents = await ProviderTrend.find(buildQuery(filters))
    .sort({ year: -1, month: -1, provider: 1, category: 1 })
    .lean();
  const safeDocuments = enforcePrivacyThreshold(documents, filters).map((document) => ({
    year: document.year,
    month: document.month,
    region: document.region,
    provider: document.provider,
    category: document.category,
    householdCount: document.householdCount,
    averageMonthlyCost: round(document.averageMonthlyCost),
    averagePricePerUnit: round(document.averagePricePerUnit, 4),
    priceChangePercent: round(document.priceChangePercent),
    switchCount: document.switchCount,
    switchRate: round(document.switchRate),
    refreshedAt: document.refreshedAt,
  }));

  return buildResponse(filters, safeDocuments);
};

export const getProviderPriceChangesInsights = async (rawFilters = {}) => {
  const baseResponse = await getProviderTrendsInsights(rawFilters);

  return {
    meta: baseResponse.meta,
    data: baseResponse.data.map((document) => ({
      year: document.year,
      month: document.month,
      region: document.region,
      provider: document.provider,
      category: document.category,
      householdCount: document.householdCount,
      averagePricePerUnit: document.averagePricePerUnit,
      priceChangePercent: document.priceChangePercent,
      direction:
        document.priceChangePercent > 0 ? 'up' : document.priceChangePercent < 0 ? 'down' : 'flat',
      refreshedAt: document.refreshedAt,
    })),
  };
};

export const getCategorySpendInsights = async (rawFilters = {}) => {
  const filters = sanitizeFilters(rawFilters, ['region', 'month', 'year', 'category']);
  await ensureAggregationsReady(CategorySpendTrend);

  const documents = await CategorySpendTrend.find(buildQuery(filters))
    .sort({ year: -1, month: -1, category: 1 })
    .lean();
  const safeDocuments = enforcePrivacyThreshold(documents, filters).map((document) => ({
    year: document.year,
    month: document.month,
    region: document.region,
    category: document.category,
    householdCount: document.householdCount,
    totalSpend: round(document.totalSpend),
    averageSpend: round(document.averageSpend),
    percentageOfMonthlySpend: round(document.percentageOfMonthlySpend),
    trendPercent: round(document.trendPercent),
    refreshedAt: document.refreshedAt,
  }));

  return buildResponse(filters, safeDocuments);
};

export const getAnomalyInsights = async (rawFilters = {}) => {
  const filters = sanitizeFilters(rawFilters, ['region', 'month', 'year']);
  await ensureAggregationsReady(RegionalStat);

  const query = {
    ...buildQuery(filters),
    anomalyFlag: true,
  };

  const documents = await RegionalStat.find(query).sort({ year: -1, month: -1, region: 1 }).lean();
  const safeDocuments = enforcePrivacyThreshold(documents, filters).map((document) => ({
    year: document.year,
    month: document.month,
    region: document.region,
    householdCount: document.householdCount,
    averageUsage: round(document.averageUsage),
    anomalyDeltaPercent: round(document.anomalyDeltaPercent),
    refreshedAt: document.refreshedAt,
  }));

  return buildResponse(filters, safeDocuments);
};

export const getSwitchingInsights = async (rawFilters = {}) => {
  const filters = sanitizeFilters(rawFilters, ['region', 'provider', 'month', 'year', 'category']);
  await ensureAggregationsReady(ProviderTrend);

  const query = buildQuery(filters);
  query.switchCount = { $gt: 0 };

  const documents = await ProviderTrend.find(query).sort({ year: -1, month: -1, provider: 1 }).lean();
  const safeDocuments = enforcePrivacyThreshold(documents, filters).map((document) => ({
    year: document.year,
    month: document.month,
    region: document.region,
    provider: document.provider,
    category: document.category,
    householdCount: document.householdCount,
    switchCount: document.switchCount,
    switchRate: round(document.switchRate),
    refreshedAt: document.refreshedAt,
  }));

  if (safeDocuments.length) {
    return buildResponse(filters, safeDocuments);
  }

  await ensureAggregationsReady(MonthlySummary);
  const monthlyDocuments = await MonthlySummary.find(buildQuery(filters)).sort({ year: -1, month: -1 }).lean();
  const fallbackData = monthlyDocuments
    .filter((document) => document.householdCount >= MIN_PRIVACY_HOUSEHOLDS)
    .map((document) => ({
      year: document.year,
      month: document.month,
      householdCount: document.householdCount,
      switchCount: document.switchCount,
      switchRate: round(document.switchRate),
      refreshedAt: document.refreshedAt,
    }));

  return buildResponse(filters, fallbackData);
};

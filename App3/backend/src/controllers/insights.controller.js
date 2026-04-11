import {
  getAnomalyInsights,
  getCategorySpendInsights,
  getMonthlyUsageInsights,
  getProviderPriceChangesInsights,
  getProviderTrendsInsights,
  getRegionalUsageInsights,
  getSwitchingInsights,
} from '../services/insights.service.js';

const sendInsights = async (req, res, next, service) => {
  try {
    const payload = await service(req.query || {});
    req.auditFilters = payload.meta.filters;
    return res.json(payload);
  } catch (error) {
    return next(error);
  }
};

export const readMonthlyUsageInsights = (req, res, next) =>
  sendInsights(req, res, next, getMonthlyUsageInsights);

export const readRegionalUsageInsights = (req, res, next) =>
  sendInsights(req, res, next, getRegionalUsageInsights);

export const readProviderTrendsInsights = (req, res, next) =>
  sendInsights(req, res, next, getProviderTrendsInsights);

export const readProviderPriceChangesInsights = (req, res, next) =>
  sendInsights(req, res, next, getProviderPriceChangesInsights);

export const readCategorySpendInsights = (req, res, next) =>
  sendInsights(req, res, next, getCategorySpendInsights);

export const readAnomalyInsights = (req, res, next) =>
  sendInsights(req, res, next, getAnomalyInsights);

export const readSwitchingInsights = (req, res, next) =>
  sendInsights(req, res, next, getSwitchingInsights);

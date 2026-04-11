import { provisionBuyerAccess, authenticateBuyer } from '../services/buyerAuth.service.js';
import { runAggregationJob } from '../services/aggregation.service.js';

export const loginBuyer = async (req, res, next) => {
  try {
    const result = await authenticateBuyer({
      email: req.body.email,
      pin: req.body.pin,
      apiKey: req.body.apiKey || req.headers['x-api-key'] || req.headers['x-buyer-key'],
    });

    return res.json({
      message: 'Buyer authenticated successfully.',
      buyer: result.buyer,
      token: result.token,
    });
  } catch (error) {
    return next(error);
  }
};

export const provisionBuyer = async (req, res, next) => {
  try {
    const result = await provisionBuyerAccess({
      buyerUserId: req.body.buyerUserId,
      name: req.body.name,
      email: req.body.email,
      pin: req.body.pin,
      region: req.body.region,
      apiKey: req.body.apiKey,
      autoGenerateCredentials: req.body.autoGenerateCredentials,
    });

    return res.status(201).json({
      message: 'Buyer access provisioned successfully.',
      buyer: result.buyer,
      credentials: {
        apiKey: result.apiKey,
        pin: result.pin,
        pinConfigured: true,
        generatedPin: result.generatedPin,
        generatedApiKey: result.generatedApiKey,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const runBuyerAggregation = async (_req, res, next) => {
  try {
    const result = await runAggregationJob({ trigger: 'admin-on-demand' });

    return res.json({
      message: 'Aggregated insights refreshed successfully.',
      ...result,
    });
  } catch (error) {
    return next(error);
  }
};

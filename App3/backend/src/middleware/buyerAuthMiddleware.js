import jwt from 'jsonwebtoken';

import { validateBuyerApiKey } from '../services/buyerAuth.service.js';
import { createHttpError } from '../utils/httpError.js';

const READ_ONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const BLOCKED_FILTER_PATTERN = /(user|email|name|identifier|receipt|timestamp|createdat|updatedat|hash|token)/i;

export const buyerAuthMiddleware = async (req, _res, next) => {
  try {
    if (!READ_ONLY_METHODS.has(req.method)) {
      throw createHttpError(405, 'Buyer insights endpoints are read-only.');
    }

    const blockedFilter = Object.keys(req.query || {}).find((key) => BLOCKED_FILTER_PATTERN.test(key));

    if (blockedFilter) {
      throw createHttpError(400, `Blocked filter "${blockedFilter}" cannot be used with buyer insights.`);
    }

    const authHeader = String(req.headers.authorization || '').trim();

    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '').trim();
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'development-secret');

      if (!['buyer', 'admin'].includes(decoded.role)) {
        throw createHttpError(403, 'Buyer role is required to access these insights.');
      }

      req.buyer = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        apiKeyPrefix: 'bearer-token',
        apiKeyFingerprint: 'bearer-token',
      };

      return next();
    }

    const apiKey = req.headers['x-api-key'] || req.headers['x-buyer-key'];

    if (!apiKey) {
      throw createHttpError(401, 'Buyer API key or buyer bearer token is required.');
    }

    const { user, apiKeyPrefix, apiKeyFingerprint } = await validateBuyerApiKey(String(apiKey));

    req.buyer = {
      id: user._id,
      email: user.email,
      role: user.role,
      apiKeyPrefix,
      apiKeyFingerprint,
    };

    return next();
  } catch (error) {
    return next(error);
  }
};

export default buyerAuthMiddleware;

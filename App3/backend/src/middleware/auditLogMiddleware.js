import BuyerAccessLog from '../models/BuyerAccessLog.js';

export const auditLogMiddleware = (req, res, next) => {
  res.on('finish', () => {
    if (!req.buyer || !req.originalUrl.startsWith('/api/insights')) {
      return;
    }

    BuyerAccessLog.create({
      buyerUserId: String(req.buyer.id || ''),
      buyerEmail: req.buyer.email || '',
      endpoint: req.originalUrl,
      method: req.method,
      filters: req.auditFilters || req.query || {},
      apiKeyPrefix: req.buyer.apiKeyPrefix || '',
      apiKeyFingerprint: req.buyer.apiKeyFingerprint || '',
      ipAddress: req.ip || req.headers['x-forwarded-for'] || '',
      statusCode: res.statusCode,
      requestedAt: new Date(),
    }).catch((error) => {
      console.error('Failed to write buyer audit log:', error.message);
    });
  });

  return next();
};

export default auditLogMiddleware;

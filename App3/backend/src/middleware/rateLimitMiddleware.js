const rateLimitStore = new Map();
const authRateLimitStore = new Map();

const pruneExpiredHits = (entry, now, windowMs) => entry.filter((timestamp) => now - timestamp < windowMs);

export const createRateLimitMiddleware = ({ windowMs = 60_000, max = 120 } = {}) => (req, res, next) => {
  const now = Date.now();
  const key = req.buyer?.apiKeyPrefix || req.ip || 'anonymous';
  const recentHits = pruneExpiredHits(rateLimitStore.get(key) || [], now, windowMs);

  if (recentHits.length >= max) {
    return res.status(429).json({
      message: 'Buyer insights rate limit exceeded. Please slow down and try again shortly.',
    });
  }

  recentHits.push(now);
  rateLimitStore.set(key, recentHits);
  return next();
};

export const authRateLimitMiddleware = (() => {
  const windowMs = 15 * 60_000; // 15 minutes
  const max = 20; // 20 attempts per 15 minutes per IP

  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || 'anonymous';
    const recentHits = (authRateLimitStore.get(key) || []).filter((ts) => now - ts < windowMs);

    if (recentHits.length >= max) {
      return res.status(429).json({
        message: 'Too many attempts. Please wait 15 minutes before trying again.',
      });
    }

    recentHits.push(now);
    authRateLimitStore.set(key, recentHits);
    return next();
  };
})();

export default createRateLimitMiddleware;

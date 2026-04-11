import jwt from 'jsonwebtoken';

import { isDemoModeOnly } from '../config/appMode.js';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization || '';

  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  const token = authHeader.replace('Bearer ', '').trim();

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'development-secret');
    const user = await User.findById(decoded.id).select('_id email role mustChangePassword adminAccessRevokedAt');

    if (!user) {
      return res.status(401).json({ message: 'Account no longer exists.' });
    }

    req.user = {
      id: String(user._id),
      email: user.email,
      role: user.role,
      mustChangePassword: Boolean(user.mustChangePassword),
      adminAccessRevokedAt: user.adminAccessRevokedAt,
    };

    if (isDemoModeOnly() && req.user.role === 'user') {
      return res.status(403).json({
        message: 'Demo preview mode is active. Live member access is disabled until launch.',
      });
    }

    return next();
  } catch (_error) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};

export const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access is required.' });
  }

  if (req.user?.mustChangePassword) {
    return res.status(403).json({ message: 'Change your admin password before using admin tools.' });
  }

  return next();
};

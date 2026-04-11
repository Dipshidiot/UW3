import { isDemoModeOnly } from '../config/appMode.js';
import User from '../models/User.js';
import { signToken } from '../utils/tokens.js';
import { isValidEmail, SUPPORTED_UTILITY_KEYS } from '../utils/validators.js';

export const formatUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  region: user.region || 'unassigned',
  xp: user.xp,
  level: user.level,
  rewardPoints: user.rewardPoints,
  streakCount: user.streakCount,
  preferredUtilities: user.preferredUtilities?.length ? user.preferredUtilities : SUPPORTED_UTILITY_KEYS,
  preferredProviders: user.preferredProviders || {
    electricity: '',
    water: '',
    gas: '',
    trash: '',
  },
  buyerAccessEnabled: Boolean(user.buyerAccess?.enabled),
  mustChangePassword: Boolean(user.mustChangePassword),
  adminAccessRevokedAt: user.adminAccessRevokedAt || null,
  badges: user.badges || [],
  achievements: user.badges || [],
});

export const register = async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const region = String(req.body.region || 'unassigned').trim().toLowerCase() || 'unassigned';

    if (!name || !isValidEmail(email) || password.length < 6) {
      return res.status(400).json({
        message: 'Name, valid email, and a password of at least 6 characters are required.',
      });
    }

    if (isDemoModeOnly()) {
      return res.status(403).json({
        message: 'Demo preview mode is active. Live account creation is disabled until launch.',
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    const user = await User.create({ name, email, password, region });

    return res.status(201).json({
      user: formatUser(user),
      token: signToken(user),
    });
  } catch (error) {
    return next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!isValidEmail(email) || !password) {
      return res.status(400).json({ message: 'Valid email and password are required.' });
    }

    const user = await User.findOne({ email }).populate('badges', 'key name icon description');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    if (isDemoModeOnly() && user.role === 'user') {
      return res.status(403).json({
        message: 'Demo preview mode is active. Live member sign-in is disabled until launch.',
      });
    }

    return res.json({
      user: formatUser(user),
      token: signToken(user),
    });
  } catch (error) {
    return next(error);
  }
};

export const getCurrentUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).populate('badges', 'key name icon description');

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    return res.json({ user: formatUser(user) });
  } catch (error) {
    return next(error);
  }
};

export const changePassword = async (req, res, next) => {
  try {
    const newPassword = String(req.body.newPassword || '');

    if (newPassword.length < 6) {
      return res.status(400).json({
        message: 'A new password of at least 6 characters is required.',
      });
    }

    const user = await User.findById(req.user.id).populate('badges', 'key name icon description');

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const isSamePassword = await user.comparePassword(newPassword);

    if (isSamePassword) {
      return res.status(400).json({ message: 'Choose a new password that is different from the current one.' });
    }

    user.password = newPassword;
    let message = 'Password updated successfully.';
    let requiresRelogin = false;

    if (user.role === 'admin' && user.mustChangePassword) {
      user.mustChangePassword = false;
      user.adminAccessRevokedAt = null;
      message = 'Password updated successfully. Sign in again to restore your admin buttons and tools.';
      requiresRelogin = true;
    }

    await user.save();

    return res.json({
      message,
      requiresRelogin,
      user: formatUser(user),
    });
  } catch (error) {
    return next(error);
  }
};

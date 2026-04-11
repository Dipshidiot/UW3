import bcrypt from 'bcryptjs';
import crypto from 'crypto';

import User from '../models/User.js';
import { signToken } from '../utils/tokens.js';
import { createHttpError } from '../utils/httpError.js';
import { isValidEmail } from '../utils/validators.js';

const normalizeRegion = (value = '') => String(value || 'unassigned').trim().toLowerCase() || 'unassigned';
const hashApiKey = (value) => crypto.createHash('sha256').update(String(value || '')).digest('hex');
const buildRandomPassword = () => `${crypto.randomBytes(18).toString('base64url')}Aa1!`;
const buildRandomPin = () => String(crypto.randomInt(100000, 1000000));

const formatBuyer = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  region: user.region || 'unassigned',
  accessEnabled: Boolean(user.buyerAccess?.enabled),
  keyPrefix: user.buyerAccess?.keyPrefix || '',
  lastAuthenticatedAt: user.buyerAccess?.lastAuthenticatedAt || null,
  lastRotatedAt: user.buyerAccess?.lastRotatedAt || null,
});

const buildApiKeyMaterial = (providedApiKey) => {
  const candidate = String(providedApiKey || '').trim();

  if (candidate) {
    const [keyPrefix, secret] = candidate.split('.');

    if (!keyPrefix || !secret) {
      throw createHttpError(400, 'Buyer API key must include a prefix and secret separated by a dot.');
    }

    return {
      apiKey: candidate,
      keyPrefix,
      apiKeyHash: hashApiKey(candidate),
    };
  }

  const keyPrefix = `buyer_${crypto.randomBytes(4).toString('hex')}`;
  const secret = crypto.randomBytes(24).toString('hex');
  const apiKey = `${keyPrefix}.${secret}`;

  return {
    apiKey,
    keyPrefix,
    apiKeyHash: hashApiKey(apiKey),
  };
};

export const provisionBuyerAccess = async ({ buyerUserId, name, email, pin, region, apiKey, autoGenerateCredentials = false }) => {
  const trimmedName = String(name || '').trim();
  const trimmedEmail = String(email || '').trim().toLowerCase();
  const shouldGeneratePin = Boolean(autoGenerateCredentials) || !String(pin || '').trim();
  const plainPin = shouldGeneratePin ? buildRandomPin() : String(pin || '').trim();

  if (!buyerUserId && (!trimmedName || !isValidEmail(trimmedEmail))) {
    throw createHttpError(400, 'Buyer name and a valid buyer email are required.');
  }

  if (plainPin.length < 4) {
    throw createHttpError(400, 'Buyer PIN must be at least 4 characters long.');
  }

  let buyer = buyerUserId ? await User.findById(buyerUserId) : await User.findOne({ email: trimmedEmail });

  if (!buyer && !trimmedEmail) {
    throw createHttpError(404, 'Buyer user not found.');
  }

  if (!buyer) {
    buyer = await User.create({
      name: trimmedName,
      email: trimmedEmail,
      password: buildRandomPassword(),
      role: 'buyer',
      region: normalizeRegion(region),
    });
  } else {
    if (trimmedName) {
      buyer.name = trimmedName;
    }

    if (trimmedEmail) {
      buyer.email = trimmedEmail;
    }

    buyer.role = 'buyer';
    buyer.region = normalizeRegion(region || buyer.region);
  }

  const apiKeyMaterial = buildApiKeyMaterial(apiKey);
  const pinHash = await bcrypt.hash(plainPin, 10);

  buyer.buyerAccess = {
    enabled: true,
    pinHash,
    apiKeyHash: apiKeyMaterial.apiKeyHash,
    keyPrefix: apiKeyMaterial.keyPrefix,
    lastAuthenticatedAt: buyer.buyerAccess?.lastAuthenticatedAt || null,
    lastRotatedAt: new Date(),
  };

  await buyer.save();

  return {
    buyer: formatBuyer(buyer),
    apiKey: apiKeyMaterial.apiKey,
    pin: plainPin,
    generatedPin: shouldGeneratePin,
    generatedApiKey: !String(apiKey || '').trim(),
  };
};

export const validateBuyerApiKey = async (apiKey) => {
  const candidate = String(apiKey || '').trim();

  if (!candidate || !candidate.includes('.')) {
    throw createHttpError(401, 'A valid buyer API key is required.');
  }

  const [keyPrefix] = candidate.split('.');
  const buyer = await User.findOne({
    role: 'buyer',
    'buyerAccess.enabled': true,
    'buyerAccess.keyPrefix': keyPrefix,
  });

  if (!buyer || !buyer.buyerAccess?.apiKeyHash) {
    throw createHttpError(401, 'Buyer access is not enabled for this credential.');
  }

  if (buyer.buyerAccess.apiKeyHash !== hashApiKey(candidate)) {
    throw createHttpError(401, 'Invalid buyer API key.');
  }

  buyer.buyerAccess.lastAuthenticatedAt = new Date();
  await buyer.save();

  return {
    user: buyer,
    apiKeyPrefix: keyPrefix,
    apiKeyFingerprint: hashApiKey(candidate),
  };
};

export const authenticateBuyer = async ({ email, pin, apiKey }) => {
  if (apiKey) {
    const { user, apiKeyPrefix, apiKeyFingerprint } = await validateBuyerApiKey(apiKey);

    return {
      buyer: formatBuyer(user),
      token: signToken(user),
      apiKeyPrefix,
      apiKeyFingerprint,
    };
  }

  const trimmedEmail = String(email || '').trim().toLowerCase();
  const trimmedPin = String(pin || '').trim();

  if (!isValidEmail(trimmedEmail) || !trimmedPin) {
    throw createHttpError(400, 'Buyer email and PIN are required.');
  }

  const buyer = await User.findOne({ email: trimmedEmail, role: 'buyer' });

  if (!buyer || !buyer.buyerAccess?.enabled || !buyer.buyerAccess?.pinHash) {
    throw createHttpError(401, 'Buyer access is not enabled for this account.');
  }

  const isValidPin = await bcrypt.compare(trimmedPin, buyer.buyerAccess.pinHash);

  if (!isValidPin) {
    throw createHttpError(401, 'Invalid buyer PIN.');
  }

  buyer.buyerAccess.lastAuthenticatedAt = new Date();
  await buyer.save();

  return {
    buyer: formatBuyer(buyer),
    token: signToken(buyer),
    apiKeyPrefix: buyer.buyerAccess.keyPrefix || '',
    apiKeyFingerprint: buyer.buyerAccess.apiKeyHash || '',
  };
};

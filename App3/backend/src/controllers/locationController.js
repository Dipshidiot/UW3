import User from '../models/User.js';

const consentStore = new Map();

const normalizeConsentType = (value) => {
  const consentType = String(value || '').trim().toLowerCase();
  return ['precise', 'approximate'].includes(consentType) ? consentType : '';
};

const buildConsentPayload = (entry = {}, fallbackRegion = 'unassigned') => ({
  consentGiven: Boolean(entry.consentGiven),
  consentType: entry.consentType || null,
  consentScope: entry.consentScope || null,
  consentSource: entry.consentSource || null,
  consentTextVersion: entry.consentTextVersion || null,
  consentRevokedAt: entry.consentRevokedAt || null,
  region: entry.region || fallbackRegion || 'unassigned',
  collectedAt: entry.collectedAt || null,
  updatedAt: entry.updatedAt || null,
});

export const getLocationStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('region');
    const stored = consentStore.get(req.user.id) || {};

    return res.json({
      consent: buildConsentPayload(stored, user?.region || 'unassigned'),
    });
  } catch (error) {
    return next(error);
  }
};

export const recordLocationConsent = async (req, res, next) => {
  try {
    const consentType = normalizeConsentType(req.body.consentType);

    if (!consentType) {
      return res.status(400).json({ message: 'consentType must be either precise or approximate.' });
    }

    const now = new Date().toISOString();
    const current = consentStore.get(req.user.id) || {};
    const nextValue = {
      ...current,
      consentGiven: true,
      consentType,
      consentScope: String(req.body.consentScope || 'persistent'),
      consentSource: String(req.body.consentSource || 'app'),
      consentTextVersion: String(req.body.consentTextVersion || 'unknown'),
      consentRevokedAt: null,
      updatedAt: now,
    };

    consentStore.set(req.user.id, nextValue);

    const user = await User.findById(req.user.id).select('region');

    return res.json({
      message: 'Location consent saved.',
      consent: buildConsentPayload(nextValue, user?.region || 'unassigned'),
    });
  } catch (error) {
    return next(error);
  }
};

export const collectLocation = async (req, res, next) => {
  try {
    const current = consentStore.get(req.user.id) || {};

    if (!current.consentGiven) {
      return res.status(403).json({ message: 'Location consent is required before collecting location data.' });
    }

    const region = String(req.body.region || '').trim().toLowerCase();
    if (region) {
      await User.findByIdAndUpdate(req.user.id, { region });
    }

    const now = new Date().toISOString();
    const nextValue = {
      ...current,
      region: region || current.region || 'unassigned',
      collectedAt: now,
      updatedAt: now,
    };

    consentStore.set(req.user.id, nextValue);

    return res.json({
      message: 'Location data saved.',
      consent: buildConsentPayload(nextValue, nextValue.region),
    });
  } catch (error) {
    return next(error);
  }
};

export const revokeLocationConsent = async (req, res, next) => {
  try {
    const now = new Date().toISOString();
    const current = consentStore.get(req.user.id) || {};
    const deleteStoredData = Boolean(req.body.deleteStoredData);

    const nextValue = {
      ...current,
      consentGiven: false,
      consentType: current.consentType || null,
      consentRevokedAt: now,
      updatedAt: now,
    };

    if (deleteStoredData) {
      nextValue.collectedAt = null;
      nextValue.region = 'unassigned';
      await User.findByIdAndUpdate(req.user.id, { region: 'unassigned' });
    }

    consentStore.set(req.user.id, nextValue);

    return res.json({
      message: 'Location consent revoked.',
      consent: buildConsentPayload(nextValue, nextValue.region || 'unassigned'),
    });
  } catch (error) {
    return next(error);
  }
};

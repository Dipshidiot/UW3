export const isValidEmail = (value = '') =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim().toLowerCase());

export const isNonNegativeNumber = (value) => Number.isFinite(Number(value)) && Number(value) >= 0;

export const SUPPORTED_UTILITY_KEYS = ['electricity', 'water', 'gas', 'trash'];
export const UTILITY_USAGE_KEYS = ['electricity', 'water', 'gas'];

const normalizeUtilityKey = (value = '') => String(value).trim().toLowerCase();

export const normalizeEntryPayload = (payload = {}) => {
  const month = Number(payload.month);
  const year = Number(payload.year);
  const sourceCategories = payload.categories && typeof payload.categories === 'object' ? payload.categories : payload;
  const sourceProviders = payload.providers && typeof payload.providers === 'object' ? payload.providers : {};
  const rawPaidUtilities = Array.isArray(payload.paidUtilities)
    ? payload.paidUtilities
    : SUPPORTED_UTILITY_KEYS.filter((key) => sourceCategories[key] !== undefined);
  const normalizedPaidUtilities = [...new Set(rawPaidUtilities.map(normalizeUtilityKey).filter(Boolean))];
  const validPaidUtilities = normalizedPaidUtilities.filter((key) => SUPPORTED_UTILITY_KEYS.includes(key));
  const invalidPaidUtilities = normalizedPaidUtilities.filter((key) => !SUPPORTED_UTILITY_KEYS.includes(key));
  const submittedKeys = Object.keys(sourceCategories).filter(
    (key) => !['month', 'year', 'notes', 'paidUtilities'].includes(key),
  );
  const invalidCategoryKeys = submittedKeys
    .map(normalizeUtilityKey)
    .filter((key) => !SUPPORTED_UTILITY_KEYS.includes(key));

  const categories = SUPPORTED_UTILITY_KEYS.reduce((accumulator, key) => {
    const value = sourceCategories[key];
    accumulator[key] = validPaidUtilities.includes(key) ? Number(value ?? 0) : 0;
    return accumulator;
  }, {});

  const providers = SUPPORTED_UTILITY_KEYS.reduce((accumulator, key) => {
    accumulator[key] = validPaidUtilities.includes(key) ? String(sourceProviders[key] || '').trim() : '';
    return accumulator;
  }, {});

  const sourceUsage = payload.usage && typeof payload.usage === 'object' ? payload.usage : {};
  const usage = UTILITY_USAGE_KEYS.reduce((accumulator, key) => {
    const raw = sourceUsage[key];
    accumulator[key] =
      validPaidUtilities.includes(key) && raw !== undefined && raw !== null && raw !== ''
        ? Number(raw)
        : null;
    return accumulator;
  }, {});

  const errors = [];

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    errors.push('Month must be an integer from 1 to 12.');
  }

  if (!Number.isInteger(year) || year < 2000) {
    errors.push('Year must be a valid four-digit value.');
  }

  if (invalidCategoryKeys.length || invalidPaidUtilities.length) {
    errors.push('Only electricity, water, gas, and trash entries are allowed.');
  }

  if (!validPaidUtilities.length) {
    errors.push('Select at least one utility bill you actually pay for this entry.');
  }

  if (validPaidUtilities.some((key) => !isNonNegativeNumber(categories[key]))) {
    errors.push('Selected utility categories must be non-negative numbers.');
  }

  return {
    month,
    year,
    categories,
    providers,
    usage,
    paidUtilities: validPaidUtilities,
    notes: String(payload.notes || '').trim(),
    errors,
  };
};

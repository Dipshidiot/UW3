export const toPeriodKey = (month, year) => `${year}-${String(month).padStart(2, '0')}`;

export const getAllowedPeriods = (referenceDate = new Date()) => {
  const current = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const previous = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 1, 1);

  return [current, previous].map((date) => ({
    month: date.getMonth() + 1,
    year: date.getFullYear(),
    key: toPeriodKey(date.getMonth() + 1, date.getFullYear()),
  }));
};

export const isAllowedSubmissionWindow = (month, year, referenceDate = new Date()) => {
  if (!Number.isInteger(month) || !Number.isInteger(year)) {
    return false;
  }

  return getAllowedPeriods(referenceDate).some(
    (period) => period.month === month && period.year === year,
  );
};

export const buildEntryLabel = (month, year) => {
  const date = new Date(year, month - 1, 1);
  return date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
};

export const calculateImprovementPercent = (currentTotal, previousTotal) => {
  if (!previousTotal || previousTotal <= 0 || currentTotal >= previousTotal) {
    return 0;
  }

  return Math.round(((previousTotal - currentTotal) / previousTotal) * 100);
};

export const calculateStreakFromEntries = (entries = []) => {
  if (!entries.length) {
    return 0;
  }

  const ordered = [...entries].sort(
    (left, right) => new Date(right.year, right.month - 1, 1) - new Date(left.year, left.month - 1, 1),
  );

  let streak = 1;

  for (let index = 1; index < ordered.length; index += 1) {
    const previousDate = new Date(ordered[index - 1].year, ordered[index - 1].month - 1, 1);
    const currentDate = new Date(ordered[index].year, ordered[index].month - 1, 1);
    const monthDifference =
      (previousDate.getFullYear() - currentDate.getFullYear()) * 12 +
      (previousDate.getMonth() - currentDate.getMonth());

    if (monthDifference === 1) {
      streak += 1;
    } else {
      break;
    }
  }

  return streak;
};

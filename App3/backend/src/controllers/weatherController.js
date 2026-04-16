const WEATHER_CONDITIONS = ['sunny', 'cloudy', 'rain', 'snow', 'windy', 'stormy'];

const weatherStore = new Map();

const toDateString = (value = new Date()) => {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const ensureUserEntries = (userId) => {
  if (!weatherStore.has(userId)) {
    weatherStore.set(userId, []);
  }

  return weatherStore.get(userId);
};

const calculateStreak = (entries = []) => {
  const uniqueDays = [...new Set(entries.map((entry) => entry.date))].sort().reverse();
  if (!uniqueDays.length) {
    return 0;
  }

  let streak = 0;
  let cursor = new Date();

  for (const dateText of uniqueDays) {
    const cursorText = toDateString(cursor);

    if (dateText === cursorText) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }

    break;
  }

  return streak;
};

const normalizeCondition = (value) => String(value || '').trim().toLowerCase();

export const getWeatherStreak = async (req, res) => {
  const entries = ensureUserEntries(req.user.id);
  const streak = calculateStreak(entries);
  const today = toDateString();
  const loggedToday = entries.some((entry) => entry.date === today);

  return res.json({
    streak,
    loggedToday,
    nextWeeklyMilestone: Math.ceil((Math.max(streak, 0) + 1) / 7) * 7,
    nextMonthlyMilestone: Math.ceil((Math.max(streak, 0) + 1) / 30) * 30,
  });
};

export const getWeatherLogs = async (req, res) => {
  const entries = [...ensureUserEntries(req.user.id)].sort((a, b) => (a.date < b.date ? 1 : -1));

  return res.json({
    entries,
    streak: calculateStreak(entries),
  });
};

export const logWeather = async (req, res) => {
  const entries = ensureUserEntries(req.user.id);
  const today = toDateString();
  const condition = normalizeCondition(req.body.condition);

  if (!WEATHER_CONDITIONS.includes(condition)) {
    return res.status(400).json({
      message: `Condition must be one of: ${WEATHER_CONDITIONS.join(', ')}.`,
    });
  }

  const existing = entries.find((entry) => entry.date === today);
  if (existing) {
    return res.status(409).json({
      message: "You have already logged today's weather. Use the edit button to update it.",
      entry: existing,
    });
  }

  const entry = {
    _id: `${req.user.id}-${today}`,
    date: today,
    condition,
    isWindy: Boolean(req.body.isWindy),
    temperature: req.body.temperature != null ? Number(req.body.temperature) : null,
    precipitation: req.body.precipitation != null ? Number(req.body.precipitation) : null,
    wind: req.body.wind != null ? Number(req.body.wind) : null,
    unit: req.body.unit === 'metric' ? 'metric' : 'imperial',
    location: {
      zip: String(req.body.zip || '').trim(),
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  entries.push(entry);

  return res.status(201).json({
    message: 'Weather logged successfully.',
    entry,
    streak: calculateStreak(entries),
    xpEarned: 0,
    pointsEarned: 0,
    bonuses: {
      weeklyStreakBonus: false,
      monthlyStreakBonus: false,
    },
  });
};

export const updateWeatherLog = async (req, res) => {
  const entries = ensureUserEntries(req.user.id);
  const target = entries.find((entry) => entry._id === req.params.id);

  if (!target) {
    return res.status(404).json({ message: 'Weather log not found.' });
  }

  const condition = req.body.condition != null ? normalizeCondition(req.body.condition) : target.condition;
  if (!WEATHER_CONDITIONS.includes(condition)) {
    return res.status(400).json({
      message: `Condition must be one of: ${WEATHER_CONDITIONS.join(', ')}.`,
    });
  }

  target.condition = condition;
  if (req.body.isWindy !== undefined) target.isWindy = Boolean(req.body.isWindy);
  if (req.body.temperature !== undefined) target.temperature = req.body.temperature != null ? Number(req.body.temperature) : null;
  if (req.body.precipitation !== undefined) target.precipitation = req.body.precipitation != null ? Number(req.body.precipitation) : null;
  if (req.body.wind !== undefined) target.wind = req.body.wind != null ? Number(req.body.wind) : null;
  if (req.body.unit !== undefined) target.unit = req.body.unit === 'metric' ? 'metric' : 'imperial';
  if (req.body.zip !== undefined) target.location.zip = String(req.body.zip || '').trim();
  target.updatedAt = new Date().toISOString();

  return res.json({
    message: 'Weather log updated.',
    entry: target,
  });
};

export const deleteWeatherLog = async (req, res) => {
  const entries = ensureUserEntries(req.user.id);
  const index = entries.findIndex((entry) => entry._id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ message: 'Weather log not found.' });
  }

  entries.splice(index, 1);

  return res.json({
    message: 'Weather log deleted and points reversed.',
  });
};

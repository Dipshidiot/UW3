export const XP_RULES = {
  monthlyEntry: 50,
  improvement: 30,
  streak3: 25,
  streak6: 50,
  streak12: 100,
  milestone: 40,
};

export const calculateLevelFromXp = (xp = 0) => Math.max(1, Math.floor(xp / 100) + 1);

export const buildXpBreakdown = ({ streakCount = 0, improvementPercent = 0, totalEntries = 0 }) => {
  const items = [
    {
      label: 'Monthly utility entry',
      amount: XP_RULES.monthlyEntry,
    },
  ];

  if (improvementPercent >= 5) {
    items.push({
      label: `Usage improvement (${improvementPercent}%)`,
      amount: XP_RULES.improvement,
    });
  }

  if (streakCount >= 12) {
    items.push({ label: '12-month streak', amount: XP_RULES.streak12 });
  } else if (streakCount >= 6) {
    items.push({ label: '6-month streak', amount: XP_RULES.streak6 });
  } else if (streakCount >= 3) {
    items.push({ label: '3-month streak', amount: XP_RULES.streak3 });
  }

  if (totalEntries > 0 && totalEntries % 5 === 0) {
    items.push({ label: 'Milestone bonus', amount: XP_RULES.milestone });
  }

  const totalXp = items.reduce((sum, item) => sum + item.amount, 0);

  return {
    totalXp,
    items,
    projectedLevel: calculateLevelFromXp(totalXp),
  };
};

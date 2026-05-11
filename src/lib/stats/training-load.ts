import type { Activity } from '@/types/unified';
import type { TrainingLoad, WeeklyStats, MonthlyStats, YearlyProgress } from '@/types/records';

// ATL/CTL decay constants
const ATL_DECAY = 2 / (7 + 1); // 7-day window
const CTL_DECAY = 2 / (42 + 1); // 42-day window

// Get ISO week number
function getWeekNumber(date: Date): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { week: weekNo, year: d.getUTCFullYear() };
}

// Get week start (Monday) for a date
function getWeekStart(timestamp: number): number {
  const d = new Date(timestamp);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// Calculate training load (ATL/CTL/TSB model)
export function calculateTrainingLoad(activities: Activity[]): TrainingLoad[] {
  // Sort activities by date
  const sorted = [...activities].sort((a, b) => a.startTime - b.startTime);

  if (sorted.length === 0) return [];

  // Create daily load array
  const startDate = sorted[0].startTime;
  const endDate = Date.now();
  const days: Map<string, number> = new Map();

  // Initialize all days with 0 load
  let currentDate = new Date(startDate);
  currentDate.setHours(0, 0, 0, 0);

  while (currentDate.getTime() <= endDate) {
    const key = currentDate.toISOString().split('T')[0];
    days.set(key, 0);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Calculate daily training load (using duration * intensity proxy)
  for (const activity of sorted) {
    const date = new Date(activity.startTime);
    const key = date.toISOString().split('T')[0];

    // Training load = duration (hours) * relative intensity
    // Intensity approximated by pace vs easy pace ratio
    const durationHours = activity.stats.durationSeconds / 3600;

    // Use pace to estimate intensity (faster = higher load)
    // Reference: 400 sec/km (6:40/km) as baseline easy pace
    const intensity = Math.min(2, Math.max(0.5, 400 / activity.stats.avgPaceSecPerKm));

    const load = durationHours * intensity * 100;
    days.set(key, (days.get(key) || 0) + load);
  }

  // Calculate ATL and CTL using exponential weighted moving average
  const loads: TrainingLoad[] = [];
  let atl = 0;
  let ctl = 0;

  for (const [dateStr, dailyLoad] of days) {
    atl = atl * (1 - ATL_DECAY) + dailyLoad * ATL_DECAY;
    ctl = ctl * (1 - CTL_DECAY) + dailyLoad * CTL_DECAY;

    const balance = ctl - atl;

    // Determine injury risk based on ATL/CTL ratio
    let risk: TrainingLoad['risk'];
    const ratio = ctl > 0 ? atl / ctl : 1;

    if (ratio < 0.8) {
      risk = 'low';
    } else if (ratio <= 1.3) {
      risk = 'optimal';
    } else if (ratio <= 1.5) {
      risk = 'high';
    } else {
      risk = 'very-high';
    }

    loads.push({
      date: new Date(dateStr).getTime(),
      acute: Math.round(atl),
      chronic: Math.round(ctl),
      balance: Math.round(balance),
      risk,
    });
  }

  // Return last 90 days
  return loads.slice(-90);
}

// Calculate weekly statistics
export function calculateWeeklyStats(activities: Activity[], numWeeks: number = 12): WeeklyStats[] {
  const stats: Map<string, WeeklyStats> = new Map();

  // Initialize weeks
  const today = Date.now();
  for (let i = 0; i < numWeeks; i++) {
    const weekStart = getWeekStart(today - i * 7 * 24 * 60 * 60 * 1000);
    const weekEnd = weekStart + 6 * 24 * 60 * 60 * 1000;

    const { week, year } = getWeekNumber(new Date(weekStart));
    const key = `${year}-${week}`;

    stats.set(key, {
      weekStart,
      weekEnd,
      weekNumber: week,
      year,
      activities: 0,
      totalDistanceMeters: 0,
      totalDurationSeconds: 0,
      totalElevation: 0,
      avgPaceSecPerKm: 0,
      longestRunMeters: 0,
      fastestPaceSecPerKm: Infinity,
    });
  }

  // Aggregate activities
  for (const activity of activities) {
    const { week, year } = getWeekNumber(new Date(activity.startTime));
    const key = `${year}-${week}`;

    const weekStats = stats.get(key);
    if (!weekStats) continue;

    weekStats.activities++;
    weekStats.totalDistanceMeters += activity.stats.distanceMeters;
    weekStats.totalDurationSeconds += activity.stats.durationSeconds;
    weekStats.totalElevation += activity.stats.elevationGain;

    if (activity.stats.distanceMeters > weekStats.longestRunMeters) {
      weekStats.longestRunMeters = activity.stats.distanceMeters;
    }

    if (
      activity.stats.avgPaceSecPerKm < weekStats.fastestPaceSecPerKm &&
      activity.stats.avgPaceSecPerKm > 0
    ) {
      weekStats.fastestPaceSecPerKm = activity.stats.avgPaceSecPerKm;
    }
  }

  // Calculate averages
  for (const weekStats of stats.values()) {
    if (weekStats.totalDistanceMeters > 0) {
      weekStats.avgPaceSecPerKm =
        (weekStats.totalDurationSeconds / weekStats.totalDistanceMeters) * 1000;
    }
    if (weekStats.fastestPaceSecPerKm === Infinity) {
      weekStats.fastestPaceSecPerKm = 0;
    }
  }

  return Array.from(stats.values()).sort((a, b) => b.weekStart - a.weekStart);
}

// Calculate monthly statistics
export function calculateMonthlyStats(
  activities: Activity[],
  numMonths: number = 12
): MonthlyStats[] {
  const monthNames = [
    'Janvier',
    'Février',
    'Mars',
    'Avril',
    'Mai',
    'Juin',
    'Juillet',
    'Août',
    'Septembre',
    'Octobre',
    'Novembre',
    'Décembre',
  ];

  const stats: Map<string, MonthlyStats> = new Map();

  // Initialize months
  const today = new Date();
  for (let i = 0; i < numMonths; i++) {
    const monthDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const key = `${monthDate.getFullYear()}-${monthDate.getMonth()}`;

    stats.set(key, {
      month: monthDate.getMonth(),
      year: monthDate.getFullYear(),
      monthName: monthNames[monthDate.getMonth()],
      activities: 0,
      totalDistanceMeters: 0,
      totalDurationSeconds: 0,
      totalElevation: 0,
      avgPaceSecPerKm: 0,
      avgDistancePerRun: 0,
    });
  }

  // Aggregate activities
  for (const activity of activities) {
    const activityDate = new Date(activity.startTime);
    const key = `${activityDate.getFullYear()}-${activityDate.getMonth()}`;

    const monthStats = stats.get(key);
    if (!monthStats) continue;

    monthStats.activities++;
    monthStats.totalDistanceMeters += activity.stats.distanceMeters;
    monthStats.totalDurationSeconds += activity.stats.durationSeconds;
    monthStats.totalElevation += activity.stats.elevationGain;
  }

  // Calculate averages
  for (const monthStats of stats.values()) {
    if (monthStats.totalDistanceMeters > 0) {
      monthStats.avgPaceSecPerKm =
        (monthStats.totalDurationSeconds / monthStats.totalDistanceMeters) * 1000;
    }
    if (monthStats.activities > 0) {
      monthStats.avgDistancePerRun = monthStats.totalDistanceMeters / monthStats.activities;
    }
  }

  return Array.from(stats.values()).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });
}

// Calculate yearly progress
export function calculateYearlyProgress(activities: Activity[]): YearlyProgress[] {
  const years: Map<number, YearlyProgress> = new Map();

  for (const activity of activities) {
    const date = new Date(activity.startTime);
    const year = date.getFullYear();
    const month = date.getMonth();

    if (!years.has(year)) {
      years.set(year, {
        year,
        totalDistanceMeters: 0,
        totalActivities: 0,
        totalDurationSeconds: 0,
        monthlyDistances: Array(12).fill(0),
      });
    }

    const yearStats = years.get(year)!;
    yearStats.totalDistanceMeters += activity.stats.distanceMeters;
    yearStats.totalActivities++;
    yearStats.totalDurationSeconds += activity.stats.durationSeconds;
    yearStats.monthlyDistances[month] += activity.stats.distanceMeters;
  }

  return Array.from(years.values()).sort((a, b) => b.year - a.year);
}

// Get current fitness status
export function getCurrentFitnessStatus(loads: TrainingLoad[]): {
  atl: number;
  ctl: number;
  tsb: number;
  risk: TrainingLoad['risk'];
  recommendation: string;
} {
  if (loads.length === 0) {
    return {
      atl: 0,
      ctl: 0,
      tsb: 0,
      risk: 'low',
      recommendation: 'Commencez à enregistrer vos activités pour suivre votre forme.',
    };
  }

  const latest = loads[loads.length - 1];

  let recommendation = '';
  switch (latest.risk) {
    case 'low':
      recommendation =
        'Volume faible. Vous pouvez augmenter progressivement votre entraînement.';
      break;
    case 'optimal':
      recommendation =
        'Équilibre optimal entre charge et récupération. Continuez comme ça !';
      break;
    case 'high':
      recommendation =
        'Charge élevée. Pensez à inclure des jours de récupération.';
      break;
    case 'very-high':
      recommendation =
        'Risque de surentraînement. Réduisez le volume et privilégiez la récupération.';
      break;
  }

  return {
    atl: latest.acute,
    ctl: latest.chronic,
    tsb: latest.balance,
    risk: latest.risk,
    recommendation,
  };
}

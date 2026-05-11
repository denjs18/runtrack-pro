import type { TrainingPaces, FitnessEstimate } from '@/types/training';
import type { Activity } from '@/types/unified';
import type { PersonalRecord } from '@/types/records';

// Riegel formula exponent for race time prediction
const RIEGEL_EXPONENT = 1.06;

// Calculate VDOT (VO2max estimate) from a race performance
// Based on Jack Daniels' Running Formula
export function calculateVDOT(distanceMeters: number, timeSeconds: number): number {
  if (distanceMeters <= 0 || timeSeconds <= 0) return 30;

  const timeMinutes = timeSeconds / 60;
  const velocity = distanceMeters / timeMinutes; // meters per minute

  // Percent VO2max formula (how much of your VO2max you can sustain for this duration)
  const percentVO2max =
    0.8 +
    0.1894393 * Math.exp(-0.012778 * timeMinutes) +
    0.2989558 * Math.exp(-0.1932605 * timeMinutes);

  // VO2 at this velocity (ml/kg/min)
  const vo2 = -4.6 + 0.182258 * velocity + 0.000104 * Math.pow(velocity, 2);

  // VDOT = VO2 / percentVO2max
  const vdot = vo2 / percentVO2max;

  // Sanity check - VDOT should be between 25 (beginner) and 85 (elite)
  if (vdot < 25 || vdot > 85 || !isFinite(vdot)) {
    return 35; // Default to intermediate beginner
  }

  return vdot;
}

// Predict race time using Riegel formula
// T2 = T1 * (D2/D1)^1.06
export function predictRaceTime(
  knownDistance: number,
  knownTime: number,
  targetDistance: number
): number {
  return knownTime * Math.pow(targetDistance / knownDistance, RIEGEL_EXPONENT);
}

// VDOT pace table (in sec/km)
const VDOT_PACE_TABLE: Record<number, TrainingPaces> = {
  30: {
    easy: { min: 447, max: 497 },
    marathon: 404,
    threshold: 372,
    interval: 344,
    repetition: 317,
  },
  35: {
    easy: { min: 398, max: 441 },
    marathon: 357,
    threshold: 330,
    interval: 304,
    repetition: 280,
  },
  40: {
    easy: { min: 358, max: 394 },
    marathon: 319,
    threshold: 295,
    interval: 271,
    repetition: 250,
  },
  45: {
    easy: { min: 323, max: 356 },
    marathon: 287,
    threshold: 266,
    interval: 244,
    repetition: 225,
  },
  50: {
    easy: { min: 295, max: 323 },
    marathon: 260,
    threshold: 242,
    interval: 222,
    repetition: 204,
  },
  55: {
    easy: { min: 270, max: 295 },
    marathon: 238,
    threshold: 221,
    interval: 203,
    repetition: 187,
  },
  60: {
    easy: { min: 249, max: 271 },
    marathon: 219,
    threshold: 203,
    interval: 187,
    repetition: 172,
  },
  65: {
    easy: { min: 231, max: 251 },
    marathon: 203,
    threshold: 188,
    interval: 173,
    repetition: 159,
  },
  70: {
    easy: { min: 215, max: 233 },
    marathon: 188,
    threshold: 175,
    interval: 161,
    repetition: 148,
  },
};

// Calculate training paces from VDOT
export function calculateTrainingPaces(vdot: number): TrainingPaces {
  // Clamp VDOT to table range
  const clampedVdot = Math.max(30, Math.min(70, vdot));

  // Find surrounding values in table
  const lowerVdot = Math.floor(clampedVdot / 5) * 5;
  const upperVdot = Math.ceil(clampedVdot / 5) * 5;

  // If exact match
  if (VDOT_PACE_TABLE[clampedVdot]) {
    return VDOT_PACE_TABLE[clampedVdot];
  }

  // Linear interpolation
  const lowerPaces = VDOT_PACE_TABLE[lowerVdot] || VDOT_PACE_TABLE[30];
  const upperPaces = VDOT_PACE_TABLE[upperVdot] || VDOT_PACE_TABLE[70];

  const ratio = (clampedVdot - lowerVdot) / (upperVdot - lowerVdot || 1);

  return {
    easy: {
      min: Math.round(
        lowerPaces.easy.min + (upperPaces.easy.min - lowerPaces.easy.min) * ratio
      ),
      max: Math.round(
        lowerPaces.easy.max + (upperPaces.easy.max - lowerPaces.easy.max) * ratio
      ),
    },
    marathon: Math.round(
      lowerPaces.marathon + (upperPaces.marathon - lowerPaces.marathon) * ratio
    ),
    threshold: Math.round(
      lowerPaces.threshold + (upperPaces.threshold - lowerPaces.threshold) * ratio
    ),
    interval: Math.round(
      lowerPaces.interval + (upperPaces.interval - lowerPaces.interval) * ratio
    ),
    repetition: Math.round(
      lowerPaces.repetition + (upperPaces.repetition - lowerPaces.repetition) * ratio
    ),
  };
}

// Estimate fitness level from recent activities and PRs
export function estimateFitness(
  activities: Activity[],
  personalRecords: PersonalRecord[]
): FitnessEstimate {
  // Filter to only running activities with realistic paces
  const runningActivities = activities.filter(
    (a) =>
      (a.type === 'running' || a.type === 'trail') &&
      a.stats.avgPaceSecPerKm >= 180 &&
      a.stats.avgPaceSecPerKm <= 600
  );

  // Get activities from last 4 weeks
  const fourWeeksAgo = Date.now() - 28 * 24 * 60 * 60 * 1000;
  const recentActivities = runningActivities.filter((a) => a.startTime >= fourWeeksAgo);

  // Calculate weekly volume
  const totalDistance = recentActivities.reduce(
    (sum, a) => sum + a.stats.distanceMeters,
    0
  );
  const weeklyVolume = totalDistance / 4 / 1000; // km per week

  // Calculate average pace (weighted by distance)
  const totalTime = recentActivities.reduce(
    (sum, a) => sum + a.stats.movingTimeSeconds,
    0
  );
  const avgPace = totalDistance > 0 ? (totalTime / totalDistance) * 1000 : 300;

  // Calculate VDOT from best 5k or 10k effort
  let vdot = 35; // Default intermediate level
  const validRecords = personalRecords.filter(
    (r) => r.rank === 1 && r.paceSecPerKm >= 150 && r.paceSecPerKm <= 600
  );

  const best5k = validRecords.find((r) => r.distance === 5000);
  const best10k = validRecords.find((r) => r.distance === 10000);

  if (best10k) {
    vdot = calculateVDOT(10000, best10k.timeSeconds);
  } else if (best5k) {
    vdot = calculateVDOT(5000, best5k.timeSeconds);
  } else if (validRecords.length > 0) {
    // Use the longest valid effort
    const longestEffort = validRecords.sort((a, b) => b.distance - a.distance)[0];
    vdot = calculateVDOT(longestEffort.distance, longestEffort.timeSeconds);
  }

  // Ensure VDOT is in valid range
  vdot = Math.max(25, Math.min(85, vdot));

  // Determine level based on VDOT
  let level: FitnessEstimate['level'];
  if (vdot >= 60) {
    level = 'elite';
  } else if (vdot >= 50) {
    level = 'advanced';
  } else if (vdot >= 40) {
    level = 'intermediate';
  } else {
    level = 'beginner';
  }

  // Calculate trend (compare last 2 weeks vs previous 2 weeks)
  const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;

  const lastTwoWeeks = runningActivities.filter((a) => a.startTime >= twoWeeksAgo);
  const previousTwoWeeks = runningActivities.filter(
    (a) => a.startTime >= fourWeeksAgo && a.startTime < twoWeeksAgo
  );

  const recentAvgPace =
    lastTwoWeeks.length > 0
      ? lastTwoWeeks.reduce((sum, a) => sum + a.stats.avgPaceSecPerKm, 0) /
        lastTwoWeeks.length
      : avgPace;
  const previousAvgPace =
    previousTwoWeeks.length > 0
      ? previousTwoWeeks.reduce((sum, a) => sum + a.stats.avgPaceSecPerKm, 0) /
        previousTwoWeeks.length
      : avgPace;

  let trend: FitnessEstimate['trend'];
  if (previousAvgPace > 0 && recentAvgPace < previousAvgPace * 0.98) {
    trend = 'improving';
  } else if (previousAvgPace > 0 && recentAvgPace > previousAvgPace * 1.02) {
    trend = 'declining';
  } else {
    trend = 'stable';
  }

  return {
    vdot: Math.round(vdot * 10) / 10,
    level,
    weeklyVolume: Math.round(weeklyVolume * 10) / 10,
    avgPace,
    trend,
  };
}

// Estimate easy pace from profile
export function estimateEasyPace(
  experienceLevel: 'beginner' | 'intermediate' | 'advanced',
  recentRaceTimes?: { distance: number; time: number }[]
): number {
  let basePace = 390; // ~6:30/km default

  if (experienceLevel === 'beginner') basePace = 420; // 7:00/km
  if (experienceLevel === 'advanced') basePace = 330; // 5:30/km

  // Adjust based on recent race times
  if (recentRaceTimes && recentRaceTimes.length > 0) {
    const racePace = (recentRaceTimes[0].time / recentRaceTimes[0].distance) * 1000;
    basePace = racePace + 60; // Easy pace ~1min slower than race pace
  }

  return Math.round(basePace);
}

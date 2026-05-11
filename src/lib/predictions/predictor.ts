import type { PersonalRecord, RacePrediction } from '@/types/records';
import { BEST_EFFORT_DISTANCES } from '@/types/unified';

// Riegel formula exponent
const RIEGEL_EXPONENT = 1.06;

// Standard race distances for predictions
const RACE_DISTANCES = [
  { distance: 5000, label: '5 km' },
  { distance: 10000, label: '10 km' },
  { distance: 21097, label: 'Semi-Marathon' },
  { distance: 42195, label: 'Marathon' },
];

// Predict race time using Riegel formula
// T2 = T1 * (D2/D1)^1.06
export function predictRaceTime(
  referenceDistance: number,
  referenceTime: number,
  targetDistance: number
): number {
  return (
    referenceTime * Math.pow(targetDistance / referenceDistance, RIEGEL_EXPONENT)
  );
}

// Predict all race times from PRs
export function predictRaceTimes(personalRecords: PersonalRecord[]): RacePrediction[] {
  if (personalRecords.length === 0) return [];

  // Filter valid records (rank 1, realistic pace between 2:30/km and 10:00/km)
  const validRecords = personalRecords.filter(
    (r) => r.rank === 1 && r.paceSecPerKm >= 150 && r.paceSecPerKm <= 600
  );

  if (validRecords.length === 0) return [];

  // Use the longest distance PR as reference (more accurate predictions)
  const referenceRecord = validRecords.sort(
    (a, b) => b.distance - a.distance
  )[0];

  const predictions: RacePrediction[] = [];

  for (const { distance, label } of RACE_DISTANCES) {
    // Check if we already have a PR for this distance
    const existingPR = personalRecords.find(
      (r) => r.distance === distance && r.rank === 1
    );

    // Predict time using Riegel formula
    const predictedTime = predictRaceTime(
      referenceRecord.distance,
      referenceRecord.timeSeconds,
      distance
    );
    const predictedPace = (predictedTime / distance) * 1000;

    // Determine confidence based on distance ratio
    const ratio = distance / referenceRecord.distance;
    let confidence: 'high' | 'medium' | 'low';

    if (ratio >= 0.5 && ratio <= 2) {
      confidence = 'high';
    } else if (ratio >= 0.25 && ratio <= 4) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    // Use existing PR if it's valid and realistic
    const useExistingPR =
      existingPR &&
      existingPR.paceSecPerKm >= 150 &&
      existingPR.paceSecPerKm <= 600;

    predictions.push({
      distance,
      distanceLabel: label,
      predictedTimeSeconds: useExistingPR
        ? existingPR.timeSeconds
        : predictedTime,
      predictedPaceSecPerKm: useExistingPR
        ? existingPR.paceSecPerKm
        : predictedPace,
      confidence: useExistingPR ? 'high' : confidence,
      basedOn: {
        distance: referenceRecord.distance,
        distanceLabel: referenceRecord.distanceLabel,
        timeSeconds: referenceRecord.timeSeconds,
      },
    });
  }

  return predictions;
}

// Calculate VDOT from race performance (Jack Daniels formula)
export function calculateVDOT(distanceMeters: number, timeSeconds: number): number {
  if (distanceMeters <= 0 || timeSeconds <= 0) return 30;

  const timeMinutes = timeSeconds / 60;
  const velocity = distanceMeters / timeMinutes; // meters per minute

  // Percent VO2max formula
  const percentVO2max =
    0.8 +
    0.1894393 * Math.exp(-0.012778 * timeMinutes) +
    0.2989558 * Math.exp(-0.1932605 * timeMinutes);

  // VO2 at this velocity
  const vo2 = -4.6 + 0.182258 * velocity + 0.000104 * Math.pow(velocity, 2);

  // VDOT = VO2 / percentVO2max
  const vdot = vo2 / percentVO2max;

  // Clamp to realistic range
  return Math.max(25, Math.min(85, vdot));
}

// Estimate training paces from VDOT
export interface TrainingPaces {
  easy: { min: number; max: number };
  marathon: number;
  threshold: number;
  interval: number;
  repetition: number;
}

export function getTrainingPaces(vdot: number): TrainingPaces {
  // Simplified VDOT pace table (in sec/km)
  // Based on Jack Daniels' Running Formula
  const basePaces: Record<number, TrainingPaces> = {
    30: { easy: { min: 447, max: 497 }, marathon: 404, threshold: 372, interval: 344, repetition: 317 },
    35: { easy: { min: 398, max: 441 }, marathon: 357, threshold: 330, interval: 304, repetition: 280 },
    40: { easy: { min: 358, max: 394 }, marathon: 319, threshold: 295, interval: 271, repetition: 250 },
    45: { easy: { min: 323, max: 356 }, marathon: 287, threshold: 266, interval: 244, repetition: 225 },
    50: { easy: { min: 295, max: 323 }, marathon: 260, threshold: 242, interval: 222, repetition: 204 },
    55: { easy: { min: 270, max: 295 }, marathon: 238, threshold: 221, interval: 203, repetition: 187 },
    60: { easy: { min: 249, max: 271 }, marathon: 219, threshold: 203, interval: 187, repetition: 172 },
  };

  // Find nearest VDOT values and interpolate
  const vdotKeys = Object.keys(basePaces).map(Number).sort((a, b) => a - b);
  const clampedVdot = Math.max(30, Math.min(60, vdot));

  let lower = 30;
  let upper = 60;

  for (let i = 0; i < vdotKeys.length - 1; i++) {
    if (clampedVdot >= vdotKeys[i] && clampedVdot <= vdotKeys[i + 1]) {
      lower = vdotKeys[i];
      upper = vdotKeys[i + 1];
      break;
    }
  }

  if (lower === upper || basePaces[clampedVdot]) {
    return basePaces[lower] || basePaces[30];
  }

  // Linear interpolation
  const ratio = (clampedVdot - lower) / (upper - lower);
  const lowerPaces = basePaces[lower];
  const upperPaces = basePaces[upper];

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
      lowerPaces.repetition +
        (upperPaces.repetition - lowerPaces.repetition) * ratio
    ),
  };
}

// Get estimated race times from VDOT
export function getVdotRaceTimes(vdot: number): Record<string, number> {
  // Approximate race times based on VDOT
  // These are rough estimates; actual times depend on many factors

  const baseVdot = 50;
  const baseTimesSeconds = {
    '5km': 20 * 60, // 20:00
    '10km': 41.5 * 60, // 41:30
    'semi': 91.5 * 60, // 1:31:30
    'marathon': 195 * 60, // 3:15:00
  };

  // Each VDOT point is roughly 2-3% improvement
  const improvement = Math.pow(0.97, vdot - baseVdot);

  return {
    '5km': baseTimesSeconds['5km'] * improvement,
    '10km': baseTimesSeconds['10km'] * improvement,
    'semi': baseTimesSeconds['semi'] * improvement,
    'marathon': baseTimesSeconds['marathon'] * improvement,
  };
}

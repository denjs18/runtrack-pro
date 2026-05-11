import type { Activity, BestEffort, BEST_EFFORT_DISTANCES } from '@/types/unified';
import type { PersonalRecord, PersonalRecordsDTO } from '@/types/records';

// Keep top N records per distance
const TOP_N_RECORDS = 3;

// Detect personal records from best efforts
export function detectRecords(
  newEfforts: BestEffort[],
  existingRecords: PersonalRecordsDTO | null,
  activityName: string
): {
  newRecords: PersonalRecord[];
  updatedRecords: PersonalRecordsDTO;
  hasNewPR: boolean;
} {
  const records: Record<string, PersonalRecord[]> = existingRecords?.records || {};
  const newRecords: PersonalRecord[] = [];

  for (const effort of newEfforts) {
    const distanceKey = effort.distance.toString();
    const existingForDistance = records[distanceKey] || [];

    // Check if this is a new record
    const isNewPR =
      existingForDistance.length === 0 ||
      effort.timeSeconds < existingForDistance[0].timeSeconds;

    // Create record entry
    const record: PersonalRecord = {
      distance: effort.distance,
      distanceLabel: effort.distanceLabel,
      timeSeconds: effort.timeSeconds,
      paceSecPerKm: effort.paceSecPerKm,
      date: effort.date,
      activityId: effort.activityId,
      activityName,
      rank: 1, // Will be recalculated
    };

    // Add to existing records
    existingForDistance.push(record);

    // Sort by time and keep top N
    existingForDistance.sort((a, b) => a.timeSeconds - b.timeSeconds);
    const topN = existingForDistance.slice(0, TOP_N_RECORDS);

    // Update ranks
    topN.forEach((r, idx) => {
      r.rank = idx + 1;
    });

    records[distanceKey] = topN;

    // Check if this effort made it to top N
    const madeTopN = topN.some(
      (r) =>
        r.activityId === effort.activityId && r.timeSeconds === effort.timeSeconds
    );

    if (madeTopN) {
      newRecords.push({
        ...record,
        rank: topN.findIndex(
          (r) =>
            r.activityId === effort.activityId &&
            r.timeSeconds === effort.timeSeconds
        ) + 1,
      });
    }
  }

  const hasNewPR = newRecords.some((r) => r.rank === 1);

  return {
    newRecords,
    updatedRecords: {
      userId: existingRecords?.userId || '',
      updatedAt: Date.now(),
      records,
    },
    hasNewPR,
  };
}

// Update records from all activities (full recompute)
export function computeAllRecords(
  activities: Activity[],
  userId: string
): PersonalRecordsDTO {
  const allEfforts: Array<BestEffort & { activityName: string }> = [];

  // Collect all best efforts from all activities
  for (const activity of activities) {
    for (const effort of activity.bestEfforts) {
      allEfforts.push({
        ...effort,
        activityName: activity.name,
      });
    }
  }

  // Group by distance
  const byDistance: Record<
    string,
    Array<BestEffort & { activityName: string }>
  > = {};

  for (const effort of allEfforts) {
    const key = effort.distance.toString();
    if (!byDistance[key]) {
      byDistance[key] = [];
    }
    byDistance[key].push(effort);
  }

  // Build records
  const records: Record<string, PersonalRecord[]> = {};

  for (const [distanceKey, efforts] of Object.entries(byDistance)) {
    // Sort by time
    efforts.sort((a, b) => a.timeSeconds - b.timeSeconds);

    // Keep top N
    const topN = efforts.slice(0, TOP_N_RECORDS).map((effort, idx) => ({
      distance: effort.distance,
      distanceLabel: effort.distanceLabel,
      timeSeconds: effort.timeSeconds,
      paceSecPerKm: effort.paceSecPerKm,
      date: effort.date,
      activityId: effort.activityId,
      activityName: effort.activityName,
      rank: idx + 1,
    }));

    records[distanceKey] = topN;
  }

  return {
    userId,
    updatedAt: Date.now(),
    records,
  };
}

// Get best record for a specific distance
export function getBestRecord(
  records: PersonalRecordsDTO,
  distance: number
): PersonalRecord | null {
  const distanceRecords = records.records[distance.toString()];
  if (!distanceRecords || distanceRecords.length === 0) return null;
  return distanceRecords[0];
}

// Get all PRs (rank 1 records)
export function getAllPRs(records: PersonalRecordsDTO): PersonalRecord[] {
  const prs: PersonalRecord[] = [];

  for (const distanceRecords of Object.values(records.records)) {
    const pr = distanceRecords.find((r) => r.rank === 1);
    if (pr) {
      prs.push(pr);
    }
  }

  // Sort by distance
  return prs.sort((a, b) => a.distance - b.distance);
}

// Check if a time would be a new PR
export function wouldBePR(
  records: PersonalRecordsDTO,
  distance: number,
  timeSeconds: number
): boolean {
  const existing = getBestRecord(records, distance);
  if (!existing) return true;
  return timeSeconds < existing.timeSeconds;
}

// Get improvement percentage for a new record
export function getImprovementPercent(
  oldTime: number,
  newTime: number
): number {
  return ((oldTime - newTime) / oldTime) * 100;
}

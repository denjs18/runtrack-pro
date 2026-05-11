import { XMLParser } from 'fast-xml-parser';
import type {
  Activity,
  GpsCoordinate,
  ActivityStats,
  Split,
  BestEffort,
  BEST_EFFORT_DISTANCES,
} from '@/types/unified';
import { calculateDistance } from './geo';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

// Validation constants
const MIN_REALISTIC_PACE = 120; // 2:00/km - no one runs faster
const MAX_REALISTIC_PACE = 900; // 15:00/km - slower is walking
const MIN_ACTIVITY_DISTANCE = 500; // 500m minimum
const MIN_ACTIVITY_DURATION = 60; // 1 minute minimum

// Valid running activity types
const RUNNING_TYPES = ['running', 'run', 'trail', 'trailrunning', 'trail_running', 'trail running'];

export interface ParseOptions {
  onlyRunning?: boolean;
  userId: string;
}

export interface ParseResult {
  success: boolean;
  activity?: Activity;
  error?: string;
}

// Best effort distances to check
const EFFORT_DISTANCES = [
  { distance: 400, label: '400m' },
  { distance: 800, label: '800m' },
  { distance: 1000, label: '1 km' },
  { distance: 1609, label: '1 mile' },
  { distance: 2000, label: '2 km' },
  { distance: 3219, label: '2 miles' },
  { distance: 5000, label: '5 km' },
  { distance: 10000, label: '10 km' },
  { distance: 15000, label: '15 km' },
  { distance: 16090, label: '10 miles' },
  { distance: 20000, label: '20 km' },
  { distance: 21097, label: 'Semi-marathon' },
  { distance: 30000, label: '30 km' },
  { distance: 42195, label: 'Marathon' },
];

export function parseGpx(
  gpxContent: string,
  filename: string,
  options: ParseOptions
): ParseResult {
  try {
    const parsed = parser.parse(gpxContent);
    const gpx = parsed.gpx;

    if (!gpx?.trk) {
      return { success: false, error: 'Invalid GPX: no track found' };
    }

    const trk = gpx.trk;
    const name = trk.name || filename.replace('.gpx', '');
    const type = (trk.type || 'running').toLowerCase();

    // Filter: only running/trail activities
    if (options.onlyRunning !== false && !RUNNING_TYPES.includes(type)) {
      return { success: false, error: `Not a running activity: ${type}` };
    }

    // Get track points
    const trkseg = trk.trkseg;
    if (!trkseg?.trkpt) {
      return { success: false, error: 'No track points found' };
    }

    const trkpts = Array.isArray(trkseg.trkpt) ? trkseg.trkpt : [trkseg.trkpt];

    // Parse points - convert lon to lng
    const points: GpsCoordinate[] = trkpts
      .filter((pt: Record<string, unknown>) => pt['@_lat'] && pt['@_lon'] && pt.time)
      .map((pt: Record<string, unknown>) => ({
        lat: parseFloat(pt['@_lat'] as string),
        lng: parseFloat(pt['@_lon'] as string), // Using lng convention
        elevation: parseFloat(pt.ele as string) || null,
        timestamp: new Date(pt.time as string).getTime(),
        accuracy: null,
        speed: null,
      }));

    if (points.length < 2) {
      return { success: false, error: 'Not enough track points' };
    }

    // Calculate stats
    const stats = calculateActivityStats(points);

    // Validation
    if (stats.distanceMeters < MIN_ACTIVITY_DISTANCE) {
      return {
        success: false,
        error: `Activity too short: ${Math.round(stats.distanceMeters)}m (min: ${MIN_ACTIVITY_DISTANCE}m)`,
      };
    }

    if (stats.durationSeconds < MIN_ACTIVITY_DURATION) {
      return { success: false, error: 'Activity too short in duration' };
    }

    if (stats.avgPaceSecPerKm < MIN_REALISTIC_PACE || stats.avgPaceSecPerKm > MAX_REALISTIC_PACE) {
      return {
        success: false,
        error: `Unrealistic pace: ${Math.floor(stats.avgPaceSecPerKm / 60)}:${Math.round(stats.avgPaceSecPerKm % 60).toString().padStart(2, '0')}/km`,
      };
    }

    const splits = calculateSplits(points);
    const bestEfforts = calculateBestEfforts(points, filename.replace('.gpx', ''));

    const activityId = `gpx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    const activity: Activity = {
      id: activityId,
      userId: options.userId,
      name,
      type: type.includes('trail') ? 'trail' : 'running',
      source: 'gpx_import',
      startTime: points[0].timestamp,
      endTime: points[points.length - 1].timestamp,
      createdAt: now,
      updatedAt: now,
      points,
      stats,
      splits,
      bestEfforts,
      syncStatus: 'pending',
    };

    return { success: true, activity };
  } catch (error) {
    console.error('Error parsing GPX:', error);
    return { success: false, error: `Parse error: ${(error as Error).message}` };
  }
}

function calculateActivityStats(points: GpsCoordinate[]): ActivityStats {
  let distance = 0;
  let elevationGain = 0;
  let elevationLoss = 0;
  let maxSpeed = 0;
  let movingTime = 0;

  const speeds: number[] = [];

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];

    const segmentDist = calculateDistance(prev.lat, prev.lng, curr.lat, curr.lng);
    distance += segmentDist;

    const timeDiff = (curr.timestamp - prev.timestamp) / 1000;

    if (timeDiff > 0 && timeDiff < 30) {
      // Ignore pauses > 30s
      const speed = segmentDist / timeDiff;
      speeds.push(speed);

      if (speed > 0.5) {
        // Consider moving if > 0.5 m/s
        movingTime += timeDiff;
      }

      // Cap max speed to realistic running speed (7 m/s = 25 km/h)
      if (speed > maxSpeed && speed < 7) {
        maxSpeed = speed;
      }
    }

    // Elevation changes
    if (prev.elevation !== null && curr.elevation !== null) {
      const eleDiff = curr.elevation - prev.elevation;
      if (eleDiff > 0) {
        elevationGain += eleDiff;
      } else {
        elevationLoss += Math.abs(eleDiff);
      }
    }
  }

  const duration = (points[points.length - 1].timestamp - points[0].timestamp) / 1000;
  const avgSpeed = movingTime > 0 ? distance / movingTime : 0;
  const avgPace = avgSpeed > 0 ? 1000 / avgSpeed : 0;

  return {
    distanceMeters: distance,
    durationSeconds: duration,
    movingTimeSeconds: movingTime,
    avgSpeedMs: avgSpeed,
    maxSpeedMs: maxSpeed,
    avgPaceSecPerKm: avgPace,
    elevationGain,
    elevationLoss,
  };
}

function calculateSplits(points: GpsCoordinate[]): Split[] {
  const splits: Split[] = [];
  let currentKm = 1;
  let kmStartIndex = 0;
  let accumulatedDistance = 0;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    accumulatedDistance += calculateDistance(prev.lat, prev.lng, curr.lat, curr.lng);

    if (accumulatedDistance >= currentKm * 1000) {
      const kmStartPoint = points[kmStartIndex];
      const time = (curr.timestamp - kmStartPoint.timestamp) / 1000;
      const elevationChange =
        curr.elevation !== null && kmStartPoint.elevation !== null
          ? curr.elevation - kmStartPoint.elevation
          : 0;
      const pace = time; // time for 1km
      const avgSpeed = 1000 / time;

      // Only add split if pace is realistic
      if (pace >= MIN_REALISTIC_PACE && pace <= MAX_REALISTIC_PACE) {
        splits.push({
          km: currentKm,
          timeSeconds: time,
          paceSecPerKm: pace,
          elevationChange,
          avgSpeedMs: avgSpeed,
        });
      }

      currentKm++;
      kmStartIndex = i;
    }
  }

  // Add partial last km if significant
  if (points.length > kmStartIndex + 1) {
    const remainingDist = accumulatedDistance - (currentKm - 1) * 1000;
    if (remainingDist > 100) {
      const kmStartPoint = points[kmStartIndex];
      const lastPoint = points[points.length - 1];
      const time = (lastPoint.timestamp - kmStartPoint.timestamp) / 1000;
      const elevationChange =
        lastPoint.elevation !== null && kmStartPoint.elevation !== null
          ? lastPoint.elevation - kmStartPoint.elevation
          : 0;
      const pace = (time / remainingDist) * 1000;
      const avgSpeed = remainingDist / time;

      if (pace >= MIN_REALISTIC_PACE && pace <= MAX_REALISTIC_PACE) {
        splits.push({
          km: currentKm,
          timeSeconds: time,
          paceSecPerKm: pace,
          elevationChange,
          avgSpeedMs: avgSpeed,
        });
      }
    }
  }

  return splits;
}

function calculateBestEfforts(points: GpsCoordinate[], activityId: string): BestEffort[] {
  const bestEfforts: BestEffort[] = [];

  // Pre-calculate cumulative distances
  const cumulativeDistances: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const dist = calculateDistance(prev.lat, prev.lng, curr.lat, curr.lng);
    cumulativeDistances.push(cumulativeDistances[i - 1] + dist);
  }

  const totalDistance = cumulativeDistances[cumulativeDistances.length - 1];

  for (const { distance, label } of EFFORT_DISTANCES) {
    if (totalDistance < distance) continue;

    let bestTime = Infinity;
    let bestStart = 0;
    let bestEnd = 0;

    // Sliding window approach
    let endIdx = 0;

    for (let startIdx = 0; startIdx < points.length; startIdx++) {
      // Move end pointer until we cover the target distance
      while (
        endIdx < points.length - 1 &&
        cumulativeDistances[endIdx] - cumulativeDistances[startIdx] < distance
      ) {
        endIdx++;
      }

      const coveredDist = cumulativeDistances[endIdx] - cumulativeDistances[startIdx];

      if (coveredDist >= distance) {
        const time = (points[endIdx].timestamp - points[startIdx].timestamp) / 1000;

        // Validate: pace must be realistic for running
        const pace = (time / coveredDist) * 1000;

        if (
          time > 0 &&
          time < bestTime &&
          pace >= MIN_REALISTIC_PACE &&
          pace <= MAX_REALISTIC_PACE
        ) {
          bestTime = time;
          bestStart = startIdx;
          bestEnd = endIdx;
        }
      }
    }

    if (bestTime < Infinity) {
      const pace = (bestTime / distance) * 1000;
      bestEfforts.push({
        distance,
        distanceLabel: label,
        timeSeconds: bestTime,
        paceSecPerKm: pace,
        startIndex: bestStart,
        endIndex: bestEnd,
        date: points[bestStart].timestamp,
        activityId,
      });
    }
  }

  return bestEfforts;
}

// Parse GPX from File object
export async function parseGpxFile(
  file: File,
  options: ParseOptions
): Promise<ParseResult> {
  const content = await file.text();
  return parseGpx(content, file.name, options);
}

// Parse multiple GPX files
export async function parseMultipleGpxFiles(
  files: File[],
  options: ParseOptions
): Promise<{ results: ParseResult[]; successful: number; failed: number }> {
  const results: ParseResult[] = [];
  let successful = 0;
  let failed = 0;

  for (const file of files) {
    const result = await parseGpxFile(file, options);
    results.push(result);

    if (result.success) {
      successful++;
    } else {
      failed++;
    }
  }

  return { results, successful, failed };
}

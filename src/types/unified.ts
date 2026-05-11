// Unified GPS Coordinate - using lng (matching runtrack-pro convention)
export interface GpsCoordinate {
  lat: number;
  lng: number;
  elevation: number | null;
  timestamp: number; // milliseconds since epoch
  accuracy: number | null;
  speed: number | null; // m/s (internal unit)
}

// Activity stats - nested structure for clarity
export interface ActivityStats {
  distanceMeters: number;
  durationSeconds: number;
  movingTimeSeconds: number;
  avgSpeedMs: number; // m/s (internal unit)
  maxSpeedMs: number; // m/s
  avgPaceSecPerKm: number;
  currentPaceSecPerKm?: number;
  currentSpeedMs?: number;
  elevationGain: number;
  elevationLoss: number;
}

// Split data for each kilometer
export interface Split {
  km: number;
  timeSeconds: number;
  paceSecPerKm: number;
  elevationChange: number;
  avgSpeedMs: number;
}

// Best effort for a specific distance
export interface BestEffort {
  distance: number; // meters
  distanceLabel: string;
  timeSeconds: number;
  paceSecPerKm: number;
  startIndex: number;
  endIndex: number;
  date: number; // timestamp
  activityId: string;
}

// Activity source type
export type ActivitySource = 'recorded' | 'gpx_import' | 'strava_import' | 'manual';

// Sync status for offline-first storage
export type SyncStatus = 'synced' | 'pending' | 'conflict' | 'local_only';

// Main unified Activity type
export interface Activity {
  id: string;
  userId: string;
  name: string;
  type: 'running' | 'trail' | 'walk' | 'other';
  source: ActivitySource;

  // Timestamps as numbers for consistency
  startTime: number;
  endTime: number;
  createdAt: number;
  updatedAt: number;

  // GPS data
  points: GpsCoordinate[];

  // Computed stats (nested)
  stats: ActivityStats;

  // Per-km splits
  splits: Split[];

  // Best efforts for this activity
  bestEfforts: BestEffort[];

  // Sync metadata
  syncStatus: SyncStatus;
  lastSyncedAt?: number;

  // Optional fields
  description?: string;
  tags?: string[];
}

// Simplified activity for list views
export interface ActivitySummary {
  id: string;
  name: string;
  type: string;
  date: number;
  distanceMeters: number;
  durationSeconds: number;
  avgPaceSecPerKm: number;
  elevationGain: number;
}

// Sync queue item for offline changes
export interface SyncQueueItem {
  id: string;
  type: 'create' | 'update' | 'delete';
  collection: 'activities' | 'trainingPlans' | 'personalRecords';
  documentId: string;
  data?: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
}

// Standard distances for best efforts (in meters)
export const BEST_EFFORT_DISTANCES = [
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
] as const;

export type DistanceKey = typeof BEST_EFFORT_DISTANCES[number]['distance'];

import { DistanceKey } from './unified';

// Personal record for a specific distance
export interface PersonalRecord {
  distance: number; // meters
  distanceLabel: string;
  timeSeconds: number;
  paceSecPerKm: number;
  date: number; // timestamp
  activityId: string;
  activityName: string;
  rank: number; // 1 = best, 2 = second best, etc.
}

// Collection of all personal records by distance
export interface PersonalRecords {
  userId: string;
  updatedAt: number;
  records: Map<DistanceKey, PersonalRecord[]>; // Array to keep top N per distance
}

// Serializable version for storage
export interface PersonalRecordsDTO {
  userId: string;
  updatedAt: number;
  records: Record<string, PersonalRecord[]>;
}

// Race prediction based on current PRs
export interface RacePrediction {
  distance: number;
  distanceLabel: string;
  predictedTimeSeconds: number;
  predictedPaceSecPerKm: number;
  confidence: 'high' | 'medium' | 'low';
  basedOn: {
    distance: number;
    distanceLabel: string;
    timeSeconds: number;
  };
}

// Training load data point
export interface TrainingLoad {
  date: number; // timestamp
  acute: number; // 7-day load (ATL - fatigue)
  chronic: number; // 42-day load (CTL - fitness)
  balance: number; // TSB = CTL - ATL (form)
  risk: 'low' | 'optimal' | 'high' | 'very-high';
}

// Weekly statistics
export interface WeeklyStats {
  weekStart: number; // timestamp
  weekEnd: number;
  weekNumber: number;
  year: number;
  activities: number;
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  totalElevation: number;
  avgPaceSecPerKm: number;
  longestRunMeters: number;
  fastestPaceSecPerKm: number;
}

// Monthly statistics
export interface MonthlyStats {
  month: number;
  year: number;
  monthName: string;
  activities: number;
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  totalElevation: number;
  avgPaceSecPerKm: number;
  avgDistancePerRun: number;
}

// Yearly progress
export interface YearlyProgress {
  year: number;
  totalDistanceMeters: number;
  totalActivities: number;
  totalDurationSeconds: number;
  monthlyDistances: number[]; // 12 values, one per month
}

// Heatmap data point
export interface HeatmapPoint {
  lat: number;
  lng: number;
  intensity: number;
}

// Heatmap grid cell
export interface HeatmapCell {
  lat: number;
  lng: number;
  count: number;
}

export interface IGPSPoint {
  lat: number;
  lng: number;
  alt: number | null;
  speed: number | null;
  accuracy: number;
  timestamp: number;
}

export interface IActivityStats {
  distance: number;
  duration: number;
  avgPace: number;
  avgSpeed: number;
  maxSpeed: number;
  elevationGain: number;
  currentPace: number;
  currentSpeed: number;
}

export interface IActivity {
  id?: string;
  userId: string;
  name: string;
  startTime: Date | string;
  endTime?: Date | string;
  points: IGPSPoint[];
  stats: IActivityStats;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

// Helper to create default stats
export const defaultStats: IActivityStats = {
  distance: 0,
  duration: 0,
  avgPace: 0,
  avgSpeed: 0,
  maxSpeed: 0,
  elevationGain: 0,
  currentPace: 0,
  currentSpeed: 0,
};

export interface GPSPoint {
  lat: number;
  lng: number;
  alt: number | null;
  speed: number | null;
  accuracy: number;
  timestamp: number;
}

export interface ActivityStats {
  distance: number; // in meters
  duration: number; // in seconds
  avgPace: number; // in seconds per km
  avgSpeed: number; // in km/h
  maxSpeed: number; // in km/h
  elevationGain: number; // in meters
  currentPace: number; // in seconds per km
  currentSpeed: number; // in km/h
}

export interface Activity {
  _id?: string;
  userId: string;
  name: string;
  startTime: Date;
  endTime?: Date;
  points: GPSPoint[];
  stats: ActivityStats;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TrackingState {
  isTracking: boolean;
  isPaused: boolean;
  points: GPSPoint[];
  startTime: number | null;
  pausedTime: number;
}

import { GPSPoint } from '@/types';

/**
 * Haversine formula to calculate distance between two GPS points
 * Returns distance in meters
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Calculate total distance from an array of GPS points
 */
export function calculateTotalDistance(points: GPSPoint[]): number {
  if (points.length < 2) return 0;

  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineDistance(
      points[i - 1].lat,
      points[i - 1].lng,
      points[i].lat,
      points[i].lng
    );
  }

  return total;
}

/**
 * Calculate elevation gain (positive only)
 */
export function calculateElevationGain(points: GPSPoint[]): number {
  if (points.length < 2) return 0;

  let gain = 0;
  for (let i = 1; i < points.length; i++) {
    const prevAlt = points[i - 1].alt;
    const currAlt = points[i].alt;

    if (prevAlt !== null && currAlt !== null) {
      const diff = currAlt - prevAlt;
      if (diff > 0) {
        gain += diff;
      }
    }
  }

  return gain;
}

/**
 * Format pace as min:ss/km
 */
export function formatPace(secondsPerKm: number): string {
  if (!secondsPerKm || secondsPerKm === Infinity || secondsPerKm <= 0) {
    return '--:--';
  }

  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = Math.floor(secondsPerKm % 60);

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Format duration as HH:MM:SS or MM:SS
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format distance in km or m
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
}

/**
 * Format speed in km/h
 */
export function formatSpeed(kmh: number): string {
  return `${kmh.toFixed(1)} km/h`;
}

/**
 * Format date
 */
export function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format time
 */
export function formatTime(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Generate activity name based on time of day
 */
export function generateActivityName(): string {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) {
    return 'Course matinale';
  } else if (hour >= 12 && hour < 17) {
    return 'Course de l\'après-midi';
  } else if (hour >= 17 && hour < 21) {
    return 'Course du soir';
  } else {
    return 'Course nocturne';
  }
}

/**
 * Get color based on speed (for polyline gradient)
 * Returns color from red (slow) to green (fast)
 */
export function getSpeedColor(speed: number, minSpeed = 0, maxSpeed = 15): string {
  const normalized = Math.min(Math.max((speed - minSpeed) / (maxSpeed - minSpeed), 0), 1);

  // Interpolate from red (#ef4444) to yellow (#eab308) to green (#22c55e)
  if (normalized < 0.5) {
    const t = normalized * 2;
    const r = Math.round(239 + (234 - 239) * t);
    const g = Math.round(68 + (179 - 68) * t);
    const b = Math.round(68 + (8 - 68) * t);
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    const t = (normalized - 0.5) * 2;
    const r = Math.round(234 + (34 - 234) * t);
    const g = Math.round(179 + (197 - 179) * t);
    const b = Math.round(8 + (94 - 8) * t);
    return `rgb(${r}, ${g}, ${b})`;
  }
}

/**
 * Throttle function
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function (this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

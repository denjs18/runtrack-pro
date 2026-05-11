// Speed conversions
export function msToKmh(ms: number): number {
  return ms * 3.6;
}

export function kmhToMs(kmh: number): number {
  return kmh / 3.6;
}

// Pace conversions
export function msToSecPerKm(ms: number): number {
  if (ms <= 0) return 0;
  return 1000 / ms;
}

export function secPerKmToMs(secPerKm: number): number {
  if (secPerKm <= 0) return 0;
  return 1000 / secPerKm;
}

// Format pace as MM:SS
export function formatPace(secPerKm: number): string {
  if (!secPerKm || secPerKm <= 0 || !isFinite(secPerKm)) return '--:--';
  const minutes = Math.floor(secPerKm / 60);
  const seconds = Math.round(secPerKm % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Format duration as HH:MM:SS or MM:SS
export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.round(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Format distance
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(2)}km`;
}

// Normalize coordinate from lon to lng
export function normalizeCoordinate(coord: { lat: number; lon?: number; lng?: number }): { lat: number; lng: number } {
  return {
    lat: coord.lat,
    lng: coord.lng ?? coord.lon ?? 0,
  };
}

// Normalize timestamp to milliseconds
export function normalizeTimestamp(time: Date | number | string): number {
  if (typeof time === 'number') {
    // If it's already a number, ensure it's in milliseconds
    return time < 10000000000 ? time * 1000 : time;
  }
  if (time instanceof Date) {
    return time.getTime();
  }
  return new Date(time).getTime();
}

// Convert Date to number timestamp
export function dateToTimestamp(date: Date | number): number {
  if (typeof date === 'number') return date;
  return date.getTime();
}

// Convert number timestamp to Date
export function timestampToDate(timestamp: number): Date {
  return new Date(timestamp);
}

// Distance conversions
export function metersToKm(meters: number): number {
  return meters / 1000;
}

export function kmToMeters(km: number): number {
  return km * 1000;
}

export function metersToMiles(meters: number): number {
  return meters / 1609.344;
}

export function milesToMeters(miles: number): number {
  return miles * 1609.344;
}

// Elevation
export function metersToFeet(meters: number): number {
  return meters * 3.28084;
}

export function feetToMeters(feet: number): number {
  return feet / 3.28084;
}

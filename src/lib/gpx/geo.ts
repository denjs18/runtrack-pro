// Haversine formula to calculate distance between two GPS points
export function calculateDistance(
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
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// Calculate elevation gain and loss from points
export function calculateElevation(
  points: { elevation: number | null }[]
): { gain: number; loss: number } {
  let gain = 0;
  let loss = 0;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1].elevation;
    const curr = points[i].elevation;

    if (prev !== null && curr !== null) {
      const diff = curr - prev;
      if (diff > 0) {
        gain += diff;
      } else {
        loss += Math.abs(diff);
      }
    }
  }

  return { gain, loss };
}

// Calculate if two routes are similar (for matched runs)
export function calculateRouteSimilarity(
  route1: { lat: number; lng: number }[],
  route2: { lat: number; lng: number }[]
): number {
  if (route1.length < 10 || route2.length < 10) return 0;

  // Sample points from both routes
  const sampleSize = Math.min(20, Math.min(route1.length, route2.length));
  const step1 = Math.floor(route1.length / sampleSize);
  const step2 = Math.floor(route2.length / sampleSize);

  let matchingPoints = 0;
  const threshold = 50; // 50 meters threshold

  for (let i = 0; i < sampleSize; i++) {
    const p1 = route1[i * step1];
    const p2 = route2[i * step2];

    const dist = calculateDistance(p1.lat, p1.lng, p2.lat, p2.lng);
    if (dist < threshold) {
      matchingPoints++;
    }
  }

  return matchingPoints / sampleSize;
}

// Check if start/end points are similar (for route matching)
export function isSameRoute(
  route1: { lat: number; lng: number }[],
  route2: { lat: number; lng: number }[],
  threshold: number = 100
): boolean {
  if (route1.length < 2 || route2.length < 2) return false;

  const start1 = route1[0];
  const end1 = route1[route1.length - 1];
  const start2 = route2[0];
  const end2 = route2[route2.length - 1];

  const startDist = calculateDistance(start1.lat, start1.lng, start2.lat, start2.lng);
  const endDist = calculateDistance(end1.lat, end1.lng, end2.lat, end2.lng);

  if (startDist > threshold || endDist > threshold) return false;

  // Also check overall similarity
  return calculateRouteSimilarity(route1, route2) > 0.7;
}

// Get bounds of a route
export function getRouteBounds(
  points: { lat: number; lng: number }[]
): { north: number; south: number; east: number; west: number } {
  if (points.length === 0) {
    return { north: 0, south: 0, east: 0, west: 0 };
  }

  let north = points[0].lat;
  let south = points[0].lat;
  let east = points[0].lng;
  let west = points[0].lng;

  for (const point of points) {
    if (point.lat > north) north = point.lat;
    if (point.lat < south) south = point.lat;
    if (point.lng > east) east = point.lng;
    if (point.lng < west) west = point.lng;
  }

  return { north, south, east, west };
}

// Get center of a route
export function getRouteCenter(
  points: { lat: number; lng: number }[]
): { lat: number; lng: number } {
  if (points.length === 0) {
    return { lat: 0, lng: 0 };
  }

  const bounds = getRouteBounds(points);
  return {
    lat: (bounds.north + bounds.south) / 2,
    lng: (bounds.east + bounds.west) / 2,
  };
}

// Calculate total distance of a route
export function calculateTotalDistance(points: { lat: number; lng: number }[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += calculateDistance(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
  }
  return total;
}

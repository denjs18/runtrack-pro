import type { Activity, GpsCoordinate } from '@/types/unified';
import type { HeatmapPoint, HeatmapCell } from '@/types/records';

// Grid resolution (~10m at equator)
const GRID_RESOLUTION = 0.0001; // degrees

// Process activities into heatmap points
export function processActivitiesForHeatmap(activities: Activity[]): HeatmapPoint[] {
  const cellMap: Map<string, HeatmapCell> = new Map();

  for (const activity of activities) {
    for (const point of activity.points) {
      // Round to grid cell
      const lat = Math.round(point.lat / GRID_RESOLUTION) * GRID_RESOLUTION;
      const lng = Math.round(point.lng / GRID_RESOLUTION) * GRID_RESOLUTION;
      const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;

      const existing = cellMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        cellMap.set(key, { lat, lng, count: 1 });
      }
    }
  }

  // Convert to heatmap points with intensity
  const cells = Array.from(cellMap.values());

  if (cells.length === 0) return [];

  // Find max count for normalization
  const maxCount = Math.max(...cells.map((c) => c.count));

  // Convert to heatmap points
  return cells.map((cell) => ({
    lat: cell.lat,
    lng: cell.lng,
    intensity: Math.min(1, cell.count / maxCount),
  }));
}

// Get bounds for heatmap
export function getHeatmapBounds(points: HeatmapPoint[]): {
  north: number;
  south: number;
  east: number;
  west: number;
  center: { lat: number; lng: number };
} {
  if (points.length === 0) {
    return {
      north: 0,
      south: 0,
      east: 0,
      west: 0,
      center: { lat: 0, lng: 0 },
    };
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

  return {
    north,
    south,
    east,
    west,
    center: {
      lat: (north + south) / 2,
      lng: (east + west) / 2,
    },
  };
}

// Calculate optimal zoom level for bounds
export function calculateZoom(
  north: number,
  south: number,
  east: number,
  west: number,
  mapWidth: number = 400,
  mapHeight: number = 400
): number {
  const latDiff = north - south;
  const lngDiff = east - west;

  const latZoom = Math.log2(mapHeight / (latDiff * 111320)) - 1;
  const lngZoom = Math.log2(mapWidth / (lngDiff * 111320 * Math.cos((north + south) / 2 * Math.PI / 180))) - 1;

  return Math.max(1, Math.min(18, Math.floor(Math.min(latZoom, lngZoom))));
}

// Sample points for large datasets
export function samplePoints(points: HeatmapPoint[], maxPoints: number = 10000): HeatmapPoint[] {
  if (points.length <= maxPoints) return points;

  const step = Math.ceil(points.length / maxPoints);
  return points.filter((_, idx) => idx % step === 0);
}

// Convert to Leaflet heat format: [lat, lng, intensity]
export function toLeafletHeatData(points: HeatmapPoint[]): [number, number, number][] {
  return points.map((p) => [p.lat, p.lng, p.intensity]);
}

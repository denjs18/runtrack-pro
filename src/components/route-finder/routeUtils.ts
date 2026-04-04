import type { OsmPath, GeneratedRoute } from './types';

export function getPathInfo(tags: Record<string, string>): {
  score: number;
  color: string;
  label: string;
  weight: number;
} {
  const highway = tags.highway || '';
  const foot = tags.foot || '';

  if (
    highway === 'motorway' ||
    highway === 'motorway_link' ||
    highway === 'trunk' ||
    highway === 'trunk_link'
  ) {
    return { score: 0, color: '#b91c1c', label: 'À éviter', weight: 2 };
  }

  if (foot === 'no') {
    return { score: 0, color: '#b91c1c', label: 'Interdit aux piétons', weight: 2 };
  }

  const scoreMap: Record<
    string,
    { score: number; color: string; label: string; weight: number }
  > = {
    footway:      { score: 1.0, color: '#16a34a', label: 'Chemin piéton',     weight: 4 },
    pedestrian:   { score: 1.0, color: '#16a34a', label: 'Zone piétonne',     weight: 4 },
    path:         { score: 0.9, color: '#22c55e', label: 'Chemin',            weight: 3.5 },
    track:        { score: 0.85, color: '#4ade80', label: 'Piste',            weight: 3.5 },
    living_street:{ score: 0.75, color: '#84cc16', label: 'Zone calme',       weight: 3 },
    cycleway:     { score: 0.7, color: '#a3e635',  label: 'Piste cyclable',   weight: 3 },
    residential:  { score: 0.55, color: '#ca8a04', label: 'Rue résidentielle',weight: 2.5 },
    service:      { score: 0.4, color: '#d97706',  label: 'Voie de service',  weight: 2 },
    unclassified: { score: 0.35, color: '#ea580c', label: 'Route non classée',weight: 2 },
    tertiary:     { score: 0.25, color: '#dc2626', label: 'Route tertiaire',  weight: 2 },
    secondary:    { score: 0.1, color: '#b91c1c',  label: 'Route secondaire', weight: 2 },
    primary:      { score: 0.05, color: '#991b1b', label: 'Route principale', weight: 2 },
  };

  if (scoreMap[highway]) {
    const info = { ...scoreMap[highway] };
    if (foot === 'designated' || foot === 'yes') {
      info.score = Math.min(1, info.score + 0.1);
    }
    return info;
  }

  return { score: 0.3, color: '#ea580c', label: 'Route', weight: 2 };
}

export async function fetchRunningPaths(
  lat: number,
  lng: number,
  radiusMeters: number,
  runningOnly: boolean
): Promise<OsmPath[]> {
  const highwayFilter = runningOnly
    ? '^(footway|path|track|pedestrian|living_street|cycleway|residential)$'
    : '^(footway|path|track|pedestrian|living_street|cycleway|residential|service|unclassified|tertiary|secondary|primary)$';

  const query = `[out:json][timeout:30];
(
  way["highway"~"${highwayFilter}"](around:${radiusMeters},${lat},${lng});
);
out body;
>;
out skel qt;`;

  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: query,
    headers: { 'Content-Type': 'text/plain' },
  });

  if (!response.ok) {
    throw new Error(`Overpass API error: ${response.status}`);
  }

  const data = await response.json();

  // Build node coordinate map
  const nodeMap = new Map<number, [number, number]>();
  for (const el of data.elements) {
    if (el.type === 'node') {
      nodeMap.set(el.id, [el.lat, el.lon]);
    }
  }

  const paths: OsmPath[] = [];
  for (const el of data.elements) {
    if (el.type === 'way' && el.nodes && el.tags?.highway) {
      const coords: [number, number][] = (el.nodes as number[])
        .map((id: number) => nodeMap.get(id))
        .filter((c): c is [number, number] => c !== undefined);

      if (coords.length >= 2) {
        const info = getPathInfo(el.tags);
        paths.push({ id: el.id, coords, tags: el.tags, ...info });
      }
    }
  }

  // Sort: good paths on top (rendered last = visible)
  paths.sort((a, b) => a.score - b.score);

  return paths;
}

function offsetPoint(
  lat: number,
  lng: number,
  distanceKm: number,
  bearingDeg: number
): [number, number] {
  const R = 6371;
  const d = distanceKm / R;
  const bearing = (bearingDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lng1 = (lng * Math.PI) / 180;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(bearing)
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );

  return [(lat2 * 180) / Math.PI, (lng2 * 180) / Math.PI];
}

export async function generateCircularRoute(
  lat: number,
  lng: number,
  targetKm: number
): Promise<GeneratedRoute | null> {
  // Radius of circle so that circumference ≈ targetKm
  const radius = targetKm / (2 * Math.PI);

  // 4 waypoints around the circle (N → E → S → W)
  const bearings = [0, 90, 180, 270];
  const waypoints = bearings.map((b) => offsetPoint(lat, lng, radius, b));

  // OSRM route: start → wp0 → wp1 → wp2 → wp3 → start
  const allPoints: [number, number][] = [[lat, lng], ...waypoints, [lat, lng]];
  const coordsStr = allPoints.map(([wlat, wlng]) => `${wlng},${wlat}`).join(';');

  const url = `https://router.project-osrm.org/route/v1/foot/${coordsStr}?overview=full&geometries=geojson`;

  const response = await fetch(url);
  if (!response.ok) throw new Error('OSRM routing failed');

  const data = await response.json();
  if (!data.routes?.length) return null;

  const route = data.routes[0];
  const coords: [number, number][] = route.geometry.coordinates.map(
    ([rLng, rLat]: [number, number]) => [rLat, rLng]
  );

  return {
    coords,
    distance: route.distance,
    duration: route.duration,
  };
}

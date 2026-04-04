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

  if (!response.ok) throw new Error(`Overpass API error: ${response.status}`);

  const data = await response.json();

  const nodeMap = new Map<number, [number, number]>();
  for (const el of data.elements) {
    if (el.type === 'node') nodeMap.set(el.id, [el.lat, el.lon]);
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

  paths.sort((a, b) => a.score - b.score);
  return paths;
}

/** Move a point by distanceKm in the given bearing (degrees, 0 = North) */
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

/** Generate waypoints evenly spaced around a circle, starting at bearingOffset */
function circleWaypoints(
  lat: number,
  lng: number,
  radiusKm: number,
  n: number,
  bearingOffset: number
): [number, number][] {
  return Array.from({ length: n }, (_, i) =>
    offsetPoint(lat, lng, radiusKm, bearingOffset + (360 / n) * i)
  );
}

/** Call OSRM foot routing and return the route */
async function osrmRoute(
  allPoints: [number, number][]
): Promise<{ distance: number; duration: number; coords: [number, number][] } | null> {
  const coordsStr = allPoints.map(([wlat, wlng]) => `${wlng},${wlat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/foot/${coordsStr}?overview=full&geometries=geojson`;

  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.routes?.length) return null;

  const route = data.routes[0];
  return {
    distance: route.distance,
    duration: route.duration,
    coords: (route.geometry.coordinates as [number, number][]).map(
      ([rLng, rLat]) => [rLat, rLng]
    ),
  };
}

/**
 * Generate a single circular route, adjusting radius iteratively so the
 * actual OSRM distance matches targetKm as closely as possible.
 */
async function generateSingleRoute(
  lat: number,
  lng: number,
  targetKm: number,
  numWaypoints: number,
  bearingOffset: number,
  label: string
): Promise<GeneratedRoute | null> {
  // Initial radius: account for the fact that street routing is ~30% longer
  // than straight-line distances (street network detour factor ≈ 1.3)
  let radius = targetKm / (2 * Math.PI * 1.3);

  for (let iter = 0; iter < 3; iter++) {
    const waypoints = circleWaypoints(lat, lng, radius, numWaypoints, bearingOffset);
    const allPoints: [number, number][] = [[lat, lng], ...waypoints, [lat, lng]];

    const result = await osrmRoute(allPoints);
    if (!result) return null;

    const actualKm = result.distance / 1000;
    const error = Math.abs(actualKm - targetKm) / targetKm;

    // Close enough (within 8%) or last iteration → return
    if (error < 0.08 || iter === 2) {
      return {
        id: `${label}-${bearingOffset}-${numWaypoints}`,
        label,
        coords: result.coords,
        distance: result.distance,
        duration: result.duration,
      };
    }

    // Adjust radius proportionally to the distance error
    radius = radius * (targetKm / actualKm);
  }

  return null;
}

/**
 * Generate multiple circular routes with different shapes and orientations,
 * all targeting targetKm, sorted by closeness to that distance.
 */
export async function generateMultipleRoutes(
  lat: number,
  lng: number,
  targetKm: number
): Promise<GeneratedRoute[]> {
  const configs = [
    { n: 4, bearing: 0,   label: 'Circuit A' },
    { n: 4, bearing: 45,  label: 'Circuit B' },
    { n: 3, bearing: 0,   label: 'Circuit C' },
    { n: 3, bearing: 60,  label: 'Circuit D' },
    { n: 4, bearing: 22,  label: 'Circuit E' },
  ];

  const results = await Promise.allSettled(
    configs.map(({ n, bearing, label }) =>
      generateSingleRoute(lat, lng, targetKm, n, bearing, label)
    )
  );

  const routes = results
    .filter(
      (r): r is PromiseFulfilledResult<GeneratedRoute> =>
        r.status === 'fulfilled' && r.value !== null
    )
    .map((r) => r.value)
    .sort(
      (a, b) =>
        Math.abs(a.distance - targetKm * 1000) - Math.abs(b.distance - targetKm * 1000)
    );

  return routes;
}

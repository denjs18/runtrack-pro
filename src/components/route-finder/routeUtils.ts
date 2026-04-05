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

  // Scale server-side timeout with radius, cap at 60s
  const overpassTimeout = radiusMeters <= 2000 ? 25 : radiusMeters <= 5000 ? 45 : 60;

  const query = `[out:json][timeout:${overpassTimeout}];
(
  way["highway"~"${highwayFilter}"](around:${radiusMeters},${lat},${lng});
);
out body;
>;
out skel qt;`;

  // Client-side abort after overpassTimeout + 10s buffer
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), (overpassTimeout + 10) * 1000);

  let response: Response;
  try {
    // Try primary endpoint first, fall back to mirror
    response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: query,
      headers: { 'Content-Type': 'text/plain' },
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    if ((e as Error).name === 'AbortError') {
      throw new Error('Timeout : zone trop grande, essayez un rayon plus petit.');
    }
    // Try mirror on network failure
    try {
      response = await fetch('https://overpass.kumi.systems/api/interpreter', {
        method: 'POST',
        body: query,
        headers: { 'Content-Type': 'text/plain' },
      });
    } catch {
      throw new Error('Serveur Overpass inaccessible. Vérifiez votre connexion.');
    }
  }
  clearTimeout(timer);

  if (!response.ok) {
    if (response.status === 429) throw new Error('Trop de requêtes, patientez quelques secondes.');
    if (response.status === 504) throw new Error('Timeout serveur : réduisez le rayon de recherche.');
    throw new Error(`Erreur serveur (${response.status}). Réessayez.`);
  }

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

// ── Geometry helpers ──────────────────────────────────────────────────────────

/** Move a point by distanceKm in the given bearing (0 = North) */
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

/**
 * Generate waypoints on an ellipse around origin.
 * stretchBearing: direction of the long axis (0 = elongated N-S, 90 = E-W)
 * stretchFactor:  ratio long/short axis (1 = circle)
 */
function ellipseWaypoints(
  lat: number,
  lng: number,
  radius: number,
  n: number,
  bearingOffset: number,
  stretchBearing: number,
  stretchFactor: number
): [number, number][] {
  return Array.from({ length: n }, (_, i) => {
    const angle = bearingOffset + (360 / n) * i;
    const angleDiff = ((angle - stretchBearing + 360) % 360);
    // cos²(angleDiff) = 1 on long axis, 0 on short axis
    const cos2 = Math.cos((angleDiff * Math.PI) / 180) ** 2;
    const r = radius * (1 / stretchFactor + (1 - 1 / stretchFactor) * cos2) * stretchFactor;
    return offsetPoint(lat, lng, r, angle);
  });
}

// ── OSRM Trip (TSP) ───────────────────────────────────────────────────────────

/**
 * Call the OSRM Trip API (Traveling Salesman Problem).
 * With roundtrip=true + source=first, OSRM:
 *   - Fixes the starting point (origin)
 *   - Visits all waypoints in the OPTIMAL order (no backtracking)
 *   - Returns to origin, forming a true loop
 *
 * This is fundamentally different from the Route API which follows waypoints
 * in the exact given order (and can double back).
 */
async function osrmTrip(
  origin: [number, number],
  waypoints: [number, number][]
): Promise<{ distance: number; duration: number; coords: [number, number][] } | null> {
  const allPoints = [origin, ...waypoints];
  const coordsStr = allPoints.map(([wlat, wlng]) => `${wlng},${wlat}`).join(';');
  const url =
    `https://router.project-osrm.org/trip/v1/foot/${coordsStr}` +
    `?roundtrip=true&source=first&geometries=geojson&overview=full`;

  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  if (data.code !== 'Ok' || !data.trips?.length) return null;

  const trip = data.trips[0];
  return {
    distance: trip.distance,
    duration: trip.duration,
    coords: (trip.geometry.coordinates as [number, number][]).map(
      ([rLng, rLat]) => [rLat, rLng] as [number, number]
    ),
  };
}

// ── Route configs ─────────────────────────────────────────────────────────────

interface RouteConfig {
  label: string;
  n: number;
  bearingOffset: number;
  stretchBearing: number;
  stretchFactor: number;
}

const ROUTE_CONFIGS: RouteConfig[] = [
  // True circles (hexagons give the best coverage for TSP)
  { label: 'Circuit A', n: 6, bearingOffset: 0,  stretchBearing: 0,  stretchFactor: 1 },
  { label: 'Circuit B', n: 6, bearingOffset: 30, stretchBearing: 0,  stretchFactor: 1 },
  // Elongated N-S (tall oval — good along rivers, parks)
  { label: 'Circuit C', n: 6, bearingOffset: 0,  stretchBearing: 0,  stretchFactor: 1.8 },
  // Elongated E-W (wide oval)
  { label: 'Circuit D', n: 6, bearingOffset: 90, stretchBearing: 90, stretchFactor: 1.8 },
  // Pentagon variant for more variety
  { label: 'Circuit E', n: 5, bearingOffset: 18, stretchBearing: 0,  stretchFactor: 1 },
];

/**
 * Generate a single loop route, adjusting radius iteratively so the
 * actual OSRM trip distance matches targetKm as closely as possible.
 */
async function generateSingleRoute(
  lat: number,
  lng: number,
  targetKm: number,
  config: RouteConfig
): Promise<GeneratedRoute | null> {
  const { label, n, bearingOffset, stretchBearing, stretchFactor } = config;

  // Initial radius: for n waypoints + origin, total trip ≈ (n+1) * sideLength.
  // For a hexagon at radius R: side ≈ R, so trip ≈ (n+1)*R → R ≈ targetKm/((n+1)*detour)
  const detour = 1.35; // street network is ~35% longer than straight-line
  let radius = targetKm / ((n + 1) * detour);

  for (let iter = 0; iter < 3; iter++) {
    const waypoints = ellipseWaypoints(lat, lng, radius, n, bearingOffset, stretchBearing, stretchFactor);
    const result = await osrmTrip([lat, lng], waypoints);
    if (!result) return null;

    const actualKm = result.distance / 1000;
    const error = Math.abs(actualKm - targetKm) / targetKm;

    if (error < 0.08 || iter === 2) {
      return {
        id: `${label}-${n}-${bearingOffset}-${stretchFactor}`,
        label,
        coords: result.coords,
        distance: result.distance,
        duration: result.duration,
      };
    }

    // Scale radius proportionally to distance error
    radius = radius * (targetKm / actualKm);
  }

  return null;
}

/**
 * Generate multiple loop routes with different shapes.
 * Uses OSRM Trip API (TSP) for proper non-backtracking loops.
 * onProgress(done, total) is called each time a circuit finishes.
 */
export async function generateMultipleRoutes(
  lat: number,
  lng: number,
  targetKm: number,
  onProgress?: (done: number, total: number) => void
): Promise<GeneratedRoute[]> {
  const total = ROUTE_CONFIGS.length;
  let done = 0;

  const results = await Promise.allSettled(
    ROUTE_CONFIGS.map((config) =>
      generateSingleRoute(lat, lng, targetKm, config).then((r) => {
        done++;
        onProgress?.(done, total);
        return r;
      })
    )
  );

  return results
    .filter(
      (r): r is PromiseFulfilledResult<GeneratedRoute> =>
        r.status === 'fulfilled' && r.value !== null
    )
    .map((r) => r.value)
    .sort(
      (a, b) =>
        Math.abs(a.distance - targetKm * 1000) - Math.abs(b.distance - targetKm * 1000)
    );
}

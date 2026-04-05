'use client';

import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { OsmPath, GeneratedRoute } from './types';

const ROUTE_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#06b6d4', '#8b5cf6'];

// ── Icons ────────────────────────────────────────────────────────────────────

const UserPositionIcon = L.divIcon({
  className: '',
  html: `<div style="width:20px;height:20px;position:relative">
    <div style="width:16px;height:16px;background:#3b82f6;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);position:absolute;top:2px;left:2px"></div>
    <div style="width:16px;height:16px;background:#3b82f6;border-radius:50%;position:absolute;top:2px;left:2px;animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;opacity:0.5"></div>
  </div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function startIcon(color: string, label: string, isSelected: boolean) {
  const size = isSelected ? 36 : 26;
  const fontSize = isSelected ? 13 : 10;
  const shadow = isSelected ? '0 3px 10px rgba(0,0,0,0.45)' : '0 2px 6px rgba(0,0,0,0.3)';
  return L.divIcon({
    className: '',
    html: `<div style="display:flex;flex-direction:column;align-items:center;gap:2px">
      <div style="
        background:${color};color:white;border-radius:50%;
        width:${size}px;height:${size}px;
        display:flex;align-items:center;justify-content:center;
        font-size:${fontSize}px;font-weight:800;
        border:${isSelected ? 3 : 2}px solid white;
        box-shadow:${shadow};
        transition:all 0.2s;
      ">${label}</div>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function arrowIcon(bearing: number, color: string) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:0;height:0;
      border-left:7px solid transparent;
      border-right:7px solid transparent;
      border-bottom:14px solid ${color};
      transform:rotate(${bearing}deg);
      transform-origin:center 9px;
      filter:drop-shadow(0 1px 2px rgba(0,0,0,0.3));
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

// ── Runner icon ───────────────────────────────────────────────────────────────

function runnerIcon(bearingDeg: number) {
  // 🏃 faces right (east = 90°), so rotate by (bearing - 90)
  const rot = bearingDeg - 90;
  return L.divIcon({
    className: '',
    html: `<div style="
      font-size:26px;line-height:1;
      transform:rotate(${rot}deg);
      filter:drop-shadow(0 2px 6px rgba(0,0,0,0.5));
      display:inline-block;
    ">🏃</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

// ── Geometry helpers ─────────────────────────────────────────────────────────

function haversineDist(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearing(lat1: number, lng1: number, lat2: number, lng2: number) {
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Interpolate a position + bearing along a polyline at progress [0-1] */
function interpolateRoute(
  coords: [number, number][],
  progress: number
): { pos: [number, number]; bear: number } {
  if (coords.length < 2) return { pos: coords[0], bear: 0 };
  if (progress <= 0) return { pos: coords[0], bear: bearing(coords[0][0], coords[0][1], coords[1][0], coords[1][1]) };
  if (progress >= 1) {
    const n = coords.length;
    return { pos: coords[n - 1], bear: bearing(coords[n - 2][0], coords[n - 2][1], coords[n - 1][0], coords[n - 1][1]) };
  }

  // Precompute cumulative distances
  const segs: number[] = [];
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    const d = haversineDist(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]);
    segs.push(d);
    total += d;
  }

  const target = progress * total;
  let acc = 0;
  for (let i = 0; i < segs.length; i++) {
    if (acc + segs[i] >= target) {
      const t = segs[i] > 0 ? (target - acc) / segs[i] : 0;
      const [la1, lo1] = coords[i];
      const [la2, lo2] = coords[i + 1];
      return {
        pos: [la1 + t * (la2 - la1), lo1 + t * (lo2 - lo1)],
        bear: bearing(la1, lo1, la2, lo2),
      };
    }
    acc += segs[i];
  }
  const n = coords.length;
  return { pos: coords[n - 1], bear: bearing(coords[n - 2][0], coords[n - 2][1], coords[n - 1][0], coords[n - 1][1]) };
}

/** Place an arrow every `intervalM` meters along the coords */
function buildArrows(
  coords: [number, number][],
  intervalM = 700
): { pos: [number, number]; bear: number }[] {
  const arrows: { pos: [number, number]; bear: number }[] = [];
  let dist = intervalM / 2; // first arrow at half-interval so it's not at the very start
  for (let i = 1; i < coords.length; i++) {
    const [la1, lo1] = coords[i - 1];
    const [la2, lo2] = coords[i];
    dist += haversineDist(la1, lo1, la2, lo2);
    if (dist >= intervalM) {
      arrows.push({ pos: [la2, lo2], bear: bearing(la1, lo1, la2, lo2) });
      dist = 0;
    }
  }
  return arrows;
}

// ── Map sub-components ───────────────────────────────────────────────────────

/** Auto-resize Leaflet when its CSS container is resized (panel open/close) */
function MapResizer() {
  const map = useMap();
  useEffect(() => {
    const obs = new ResizeObserver(() => map.invalidateSize());
    obs.observe(map.getContainer());
    return () => obs.disconnect();
  }, [map]);
  return null;
}

function MapController({
  userPosition,
  shouldCenter,
  onCentered,
  onMapMoved,
  selectedRoute,
}: {
  userPosition: [number, number] | null;
  shouldCenter: boolean;
  onCentered: () => void;
  onMapMoved: (lat: number, lng: number) => void;
  selectedRoute: GeneratedRoute | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (userPosition && shouldCenter) {
      map.setView(userPosition, 15, { animate: true });
      onCentered();
    }
  }, [userPosition, shouldCenter, map, onCentered]);

  useEffect(() => {
    if (!selectedRoute?.coords.length) return;
    const bounds = L.latLngBounds(selectedRoute.coords);
    map.fitBounds(bounds, { padding: [40, 40], animate: true, maxZoom: 16 });
  }, [selectedRoute, map]);

  useMapEvents({
    moveend: () => {
      const c = map.getCenter();
      onMapMoved(c.lat, c.lng);
    },
  });

  return null;
}

// ── Main component ────────────────────────────────────────────────────────────

interface RouteFinderMapProps {
  userPosition: [number, number] | null;
  paths: OsmPath[];
  routes: GeneratedRoute[];
  selectedRouteId: string | null;
  searchRadius: number;
  shouldCenter: boolean;
  onCentered: () => void;
  onMapMoved: (lat: number, lng: number) => void;
  animProgress: number | null; // null = no animation, 0-1 = animating
}

export default function RouteFinderMap({
  userPosition,
  paths,
  routes,
  selectedRouteId,
  searchRadius,
  shouldCenter,
  onCentered,
  onMapMoved,
  animProgress,
}: RouteFinderMapProps) {
  const defaultCenter: [number, number] = [48.8566, 2.3522];
  const initialCenter = userPosition ?? defaultCenter;
  const selectedRoute = routes.find((r) => r.id === selectedRouteId) ?? null;

  // Interpolate runner position
  const runnerState = useMemo(() => {
    if (animProgress === null || !selectedRoute?.coords.length) return null;
    return interpolateRoute(selectedRoute.coords, animProgress);
  }, [animProgress, selectedRoute]);

  // Precompute arrows for each route
  const routeArrows = useMemo(
    () => routes.map((r) => buildArrows(r.coords)),
    [routes]
  );

  return (
    <div style={{ height: '100%', width: '100%' }}>
      <MapContainer
        center={initialCenter}
        zoom={15}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapResizer />

        <MapController
          userPosition={userPosition}
          shouldCenter={shouldCenter}
          onCentered={onCentered}
          onMapMoved={onMapMoved}
          selectedRoute={selectedRoute}
        />

        {/* Search radius circle */}
        {userPosition && (
          <Circle
            center={userPosition}
            radius={searchRadius}
            pathOptions={{
              color: '#3b82f6',
              fillColor: '#3b82f6',
              fillOpacity: 0.04,
              weight: 1,
              dashArray: '6 4',
            }}
          />
        )}

        {/* OSM running paths */}
        {paths.map((path) => (
          <Polyline
            key={path.id}
            positions={path.coords}
            pathOptions={{
              color: path.color,
              weight: path.weight,
              opacity: 0.8,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        ))}

        {/* Generated routes — all visible, selected one highlighted */}
        {routes.map((route, i) => {
          const color = ROUTE_COLORS[i % ROUTE_COLORS.length];
          const isSelected = route.id === selectedRouteId;
          const arrows = routeArrows[i];
          const letter = String.fromCharCode(65 + i); // A, B, C…

          return (
            <span key={route.id}>
              {/* Unselected routes: visible but thinner, drawn first (below) */}
              {!isSelected && (
                <Polyline
                  positions={route.coords}
                  pathOptions={{
                    color,
                    weight: 3.5,
                    opacity: 0.65,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />
              )}

              {/* Selected route: thick + on top */}
              {isSelected && (
                <Polyline
                  positions={route.coords}
                  pathOptions={{
                    color,
                    weight: 6,
                    opacity: 1,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />
              )}

              {/* Direction arrows — only on selected route */}
              {isSelected &&
                arrows.map((a, j) => (
                  <Marker
                    key={`arrow-${j}`}
                    position={a.pos}
                    icon={arrowIcon(a.bear, color)}
                    interactive={false}
                  />
                ))}

              {/* Start marker on ALL routes, hidden during animation */}
              {route.coords.length > 0 && animProgress === null && (
                <Marker
                  position={route.coords[0]}
                  icon={startIcon(color, letter, isSelected)}
                  interactive={false}
                />
              )}
            </span>
          );
        })}

        {/* Animated runner */}
        {runnerState && (
          <Marker
            position={runnerState.pos}
            icon={runnerIcon(runnerState.bear)}
            interactive={false}
          />
        )}

        {/* User position */}
        {userPosition && (
          <Marker position={userPosition} icon={UserPositionIcon} />
        )}
      </MapContainer>
    </div>
  );
}

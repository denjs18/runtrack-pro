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

function startIcon(color: string) {
  return L.divIcon({
    className: '',
    html: `<div style="display:flex;flex-direction:column;align-items:center;gap:2px">
      <div style="
        background:${color};color:white;border-radius:50%;
        width:34px;height:34px;
        display:flex;align-items:center;justify-content:center;
        font-size:15px;
        border:3px solid white;box-shadow:0 3px 10px rgba(0,0,0,0.4);
      ">▶</div>
      <div style="
        background:${color};color:white;
        font-size:9px;font-weight:700;letter-spacing:0.05em;
        padding:1px 5px;border-radius:4px;
        box-shadow:0 1px 4px rgba(0,0,0,0.3);
        white-space:nowrap;
      ">DÉPART</div>
    </div>`,
    iconSize: [50, 52],
    iconAnchor: [25, 10],
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
}: RouteFinderMapProps) {
  const defaultCenter: [number, number] = [48.8566, 2.3522];
  const initialCenter = userPosition ?? defaultCenter;
  const selectedRoute = routes.find((r) => r.id === selectedRouteId) ?? null;

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

        {/* Generated routes */}
        {routes.map((route, i) => {
          const color = ROUTE_COLORS[i % ROUTE_COLORS.length];
          const isSelected = route.id === selectedRouteId;
          const arrows = routeArrows[i];

          return (
            <span key={route.id}>
              {/* Polyline */}
              <Polyline
                positions={route.coords}
                pathOptions={{
                  color,
                  weight: isSelected ? 6 : 2.5,
                  opacity: isSelected ? 1 : 0.45,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />

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

              {/* Start marker — only on selected route */}
              {isSelected && route.coords.length > 0 && (
                <Marker
                  position={route.coords[0]}
                  icon={startIcon(color)}
                  interactive={false}
                />
              )}
            </span>
          );
        })}

        {/* User position */}
        {userPosition && (
          <Marker position={userPosition} icon={UserPositionIcon} />
        )}
      </MapContainer>
    </div>
  );
}

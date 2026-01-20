'use client';

import { useEffect, useRef, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { GPSPoint } from '@/types';
import { getSpeedColor, throttle } from '@/lib/utils';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet with webpack
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const CurrentPositionIcon = L.divIcon({
  className: 'current-position-marker',
  html: `
    <div class="relative">
      <div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg"></div>
      <div class="absolute inset-0 w-4 h-4 bg-blue-500 rounded-full animate-ping opacity-75"></div>
    </div>
  `,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapComponentProps {
  points: GPSPoint[];
  currentPosition?: GPSPoint | null;
  isTracking?: boolean;
  height?: string;
  showSpeedGradient?: boolean;
}

// Component to handle map view updates
function MapUpdater({
  points,
  currentPosition,
  isTracking,
}: {
  points: GPSPoint[];
  currentPosition?: GPSPoint | null;
  isTracking?: boolean;
}) {
  const map = useMap();
  const lastUpdateRef = useRef<number>(0);

  const throttledSetView = useCallback(
    throttle((lat: number, lng: number) => {
      map.setView([lat, lng], map.getZoom(), { animate: true });
    }, 1000), // Max 1 update per second for battery saving
    [map]
  );

  useEffect(() => {
    if (!isTracking) return;

    if (currentPosition) {
      const now = Date.now();
      if (now - lastUpdateRef.current > 1000) {
        throttledSetView(currentPosition.lat, currentPosition.lng);
        lastUpdateRef.current = now;
      }
    }
  }, [currentPosition, isTracking, throttledSetView]);

  // Fit bounds when viewing completed track
  useEffect(() => {
    if (!isTracking && points.length > 1) {
      const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [points, isTracking, map]);

  return null;
}

export default function MapComponent({
  points,
  currentPosition,
  isTracking = false,
  height = '300px',
  showSpeedGradient = true,
}: MapComponentProps) {
  // Memoize polyline segments with colors based on speed
  const polylineSegments = useMemo(() => {
    if (!showSpeedGradient || points.length < 2) {
      return null;
    }

    // Find min and max speed for normalization
    const speeds = points.map((p) => p.speed ?? 0).filter((s) => s > 0);
    const minSpeed = speeds.length > 0 ? Math.min(...speeds) : 0;
    const maxSpeed = speeds.length > 0 ? Math.max(...speeds) : 15;

    const segments: { positions: [number, number][]; color: string }[] = [];

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const speed = p2.speed ?? p1.speed ?? 0;
      const color = getSpeedColor(speed, minSpeed, maxSpeed);

      segments.push({
        positions: [
          [p1.lat, p1.lng],
          [p2.lat, p2.lng],
        ],
        color,
      });
    }

    return segments;
  }, [points, showSpeedGradient]);

  // Default center (Paris)
  const defaultCenter: [number, number] = [48.8566, 2.3522];

  // Calculate initial center
  const center = useMemo((): [number, number] => {
    if (currentPosition) {
      return [currentPosition.lat, currentPosition.lng];
    }
    if (points.length > 0) {
      return [points[0].lat, points[0].lng];
    }
    return defaultCenter;
  }, [currentPosition, points]);

  return (
    <div className="relative rounded-2xl overflow-hidden shadow-lg" style={{ height }}>
      <MapContainer
        center={center}
        zoom={16}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapUpdater
          points={points}
          currentPosition={currentPosition}
          isTracking={isTracking}
        />

        {/* Polyline with speed gradient */}
        {polylineSegments
          ? polylineSegments.map((segment, index) => (
              <Polyline
                key={index}
                positions={segment.positions}
                pathOptions={{
                  color: segment.color,
                  weight: 4,
                  opacity: 0.9,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
            ))
          : points.length > 1 && (
              <Polyline
                positions={points.map((p) => [p.lat, p.lng])}
                pathOptions={{
                  color: '#3B82F6',
                  weight: 4,
                  opacity: 0.9,
                }}
              />
            )}

        {/* Start marker */}
        {points.length > 0 && (
          <Marker position={[points[0].lat, points[0].lng]} icon={DefaultIcon} />
        )}

        {/* Current position marker */}
        {isTracking && currentPosition && (
          <Marker
            position={[currentPosition.lat, currentPosition.lng]}
            icon={CurrentPositionIcon}
          />
        )}
      </MapContainer>

      {/* Legend for speed gradient */}
      {showSpeedGradient && points.length > 1 && (
        <div className="absolute bottom-4 left-4 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-md z-[1000]">
          <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Vitesse
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500">Lent</span>
            <div
              className="w-20 h-2 rounded-full"
              style={{
                background: 'linear-gradient(to right, #ef4444, #eab308, #22c55e)',
              }}
            />
            <span className="text-xs text-gray-500">Rapide</span>
          </div>
        </div>
      )}
    </div>
  );
}

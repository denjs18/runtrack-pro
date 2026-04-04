'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { OsmPath, GeneratedRoute } from './types';

const UserPositionIcon = L.divIcon({
  className: 'user-position-marker',
  html: `
    <div class="relative" style="width:20px;height:20px">
      <div style="width:16px;height:16px;background:#3b82f6;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);position:absolute;top:2px;left:2px"></div>
      <div style="width:16px;height:16px;background:#3b82f6;border-radius:50%;position:absolute;top:2px;left:2px;animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;opacity:0.5"></div>
    </div>
  `,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function MapController({
  userPosition,
  shouldCenter,
  onCentered,
  onMapMoved,
}: {
  userPosition: [number, number] | null;
  shouldCenter: boolean;
  onCentered: () => void;
  onMapMoved: (lat: number, lng: number) => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (userPosition && shouldCenter) {
      map.setView(userPosition, 15, { animate: true });
      onCentered();
    }
  }, [userPosition, shouldCenter, map, onCentered]);

  useMapEvents({
    moveend: () => {
      const center = map.getCenter();
      onMapMoved(center.lat, center.lng);
    },
  });

  return null;
}

interface RouteFinderMapProps {
  userPosition: [number, number] | null;
  paths: OsmPath[];
  generatedRoute: GeneratedRoute | null;
  searchRadius: number;
  shouldCenter: boolean;
  onCentered: () => void;
  onMapMoved: (lat: number, lng: number) => void;
}

export default function RouteFinderMap({
  userPosition,
  paths,
  generatedRoute,
  searchRadius,
  shouldCenter,
  onCentered,
  onMapMoved,
}: RouteFinderMapProps) {
  const defaultCenter: [number, number] = [48.8566, 2.3522];
  const initialCenter = userPosition ?? defaultCenter;

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

        <MapController
          userPosition={userPosition}
          shouldCenter={shouldCenter}
          onCentered={onCentered}
          onMapMoved={onMapMoved}
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
              opacity: 0.85,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          >
          </Polyline>
        ))}

        {/* Generated circular route */}
        {generatedRoute && (
          <Polyline
            positions={generatedRoute.coords}
            pathOptions={{
              color: '#6366f1',
              weight: 5,
              opacity: 0.95,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        )}

        {/* User position marker */}
        {userPosition && (
          <Marker position={userPosition} icon={UserPositionIcon} />
        )}
      </MapContainer>
    </div>
  );
}

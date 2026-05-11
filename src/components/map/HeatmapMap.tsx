'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { HeatmapPoint } from '@/types/records';

// Import leaflet.heat
// Note: This needs to be imported dynamically or via script tag
// For simplicity, we'll implement a basic canvas-based heatmap

interface HeatmapMapProps {
  points: HeatmapPoint[];
  center: { lat: number; lng: number };
  zoom: number;
}

export default function HeatmapMap({ points, center, zoom }: HeatmapMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const heatLayerRef = useRef<L.Layer | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    // Initialize map if not already done
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current, {
        center: [center.lat, center.lng],
        zoom,
        zoomControl: true,
      });

      // Add tile layer (dark mode compatible)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(mapInstanceRef.current);
    }

    // Update view
    mapInstanceRef.current.setView([center.lat, center.lng], zoom);

    // Remove old heat layer
    if (heatLayerRef.current) {
      mapInstanceRef.current.removeLayer(heatLayerRef.current);
    }

    // Create simple heatmap using circle markers
    // For a real heatmap, you'd use leaflet.heat plugin
    const heatGroup = L.layerGroup();

    // Sort by intensity (draw high intensity last)
    const sortedPoints = [...points].sort((a, b) => a.intensity - b.intensity);

    // Sample for performance
    const maxMarkers = 5000;
    const step = Math.max(1, Math.floor(sortedPoints.length / maxMarkers));
    const sampledPoints = sortedPoints.filter((_, i) => i % step === 0);

    for (const point of sampledPoints) {
      // Color based on intensity
      const hue = (1 - point.intensity) * 240; // Blue to Red
      const color = `hsl(${hue}, 100%, 50%)`;

      const circle = L.circleMarker([point.lat, point.lng], {
        radius: 3 + point.intensity * 5,
        fillColor: color,
        fillOpacity: 0.3 + point.intensity * 0.4,
        stroke: false,
      });

      heatGroup.addLayer(circle);
    }

    heatGroup.addTo(mapInstanceRef.current);
    heatLayerRef.current = heatGroup;

    return () => {
      // Cleanup on unmount
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [points, center, zoom]);

  return <div ref={mapRef} className="w-full h-full" />;
}

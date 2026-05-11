'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Activity } from '@/types/unified';
import type { HeatmapPoint } from '@/types/records';
import {
  processActivitiesForHeatmap,
  getHeatmapBounds,
  calculateZoom,
  samplePoints,
} from '@/lib/heatmap/processor';
import { formatDistance } from '@/lib/converters/units';
import { Map, Layers, Activity as ActivityIcon } from 'lucide-react';

// Dynamically import the map component to avoid SSR issues
const HeatmapMap = dynamic(() => import('./HeatmapMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
    </div>
  ),
});

interface HeatmapViewProps {
  activities: Activity[];
}

export default function HeatmapView({ activities }: HeatmapViewProps) {
  // Process activities into heatmap data
  const heatmapPoints = useMemo(() => {
    const points = processActivitiesForHeatmap(activities);
    return samplePoints(points, 15000);
  }, [activities]);

  // Calculate bounds and zoom
  const { center, zoom } = useMemo(() => {
    if (heatmapPoints.length === 0) {
      return {
        center: { lat: 48.8566, lng: 2.3522 }, // Default to Paris
        zoom: 12,
      };
    }

    const b = getHeatmapBounds(heatmapPoints);
    const z = calculateZoom(b.north, b.south, b.east, b.west);

    return {
      center: b.center,
      zoom: Math.max(z, 10),
    };
  }, [heatmapPoints]);

  // Calculate stats
  const totalDistance = activities.reduce(
    (sum, a) => sum + a.stats.distanceMeters,
    0
  );

  return (
    <div className="h-full flex flex-col">
      {/* Stats bar */}
      <div className="flex-shrink-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <ActivityIcon className="w-4 h-4 text-blue-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {activities.length} activité{activities.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Map className="w-4 h-4 text-green-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {formatDistance(totalDistance)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {heatmapPoints.length.toLocaleString()} points
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        {heatmapPoints.length > 0 ? (
          <HeatmapMap
            points={heatmapPoints}
            center={center}
            zoom={zoom}
          />
        ) : (
          <div className="h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800">
            <div className="text-center">
              <Map className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500">Pas de données GPS disponibles</p>
              <p className="text-sm text-gray-400 mt-1">
                Importez des activités pour voir votre heatmap
              </p>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-white dark:bg-gray-900 rounded-lg shadow-lg p-3">
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            Intensité
          </p>
          <div className="flex items-center gap-1">
            <div className="w-8 h-3 rounded-sm bg-gradient-to-r from-blue-300 via-lime-400 via-yellow-400 to-red-500" />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Faible</span>
            <span>Élevée</span>
          </div>
        </div>
      </div>
    </div>
  );
}

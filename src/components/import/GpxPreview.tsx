'use client';

import { useMemo } from 'react';
import { Activity } from '@/types/unified';
import { formatPace, formatDuration, formatDistance } from '@/lib/converters/units';
import { MapPin, Clock, Zap, Mountain, Calendar } from 'lucide-react';

interface GpxPreviewProps {
  activity: Activity;
}

export default function GpxPreview({ activity }: GpxPreviewProps) {
  const formattedDate = useMemo(() => {
    return new Date(activity.startTime).toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, [activity.startTime]);

  const stats = [
    {
      icon: MapPin,
      label: 'Distance',
      value: formatDistance(activity.stats.distanceMeters),
    },
    {
      icon: Clock,
      label: 'Durée',
      value: formatDuration(activity.stats.durationSeconds),
    },
    {
      icon: Zap,
      label: 'Allure moy.',
      value: `${formatPace(activity.stats.avgPaceSecPerKm)}/km`,
    },
    {
      icon: Mountain,
      label: 'Dénivelé',
      value: `+${Math.round(activity.stats.elevationGain)}m`,
    },
  ];

  // Generate a simple SVG route preview
  const routeSvg = useMemo(() => {
    if (activity.points.length < 2) return null;

    const points = activity.points;
    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const padding = 10;
    const width = 200;
    const height = 150;

    const scaleX = (maxLng - minLng) > 0 ? (width - 2 * padding) / (maxLng - minLng) : 1;
    const scaleY = (maxLat - minLat) > 0 ? (height - 2 * padding) / (maxLat - minLat) : 1;
    const scale = Math.min(scaleX, scaleY);

    // Sample points for performance
    const sampleRate = Math.max(1, Math.floor(points.length / 200));
    const sampledPoints = points.filter((_, i) => i % sampleRate === 0);

    const pathData = sampledPoints
      .map((p, i) => {
        const x = padding + (p.lng - minLng) * scale;
        const y = height - padding - (p.lat - minLat) * scale;
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        <path
          d={pathData}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-blue-500"
        />
        {/* Start marker */}
        <circle
          cx={padding + (sampledPoints[0].lng - minLng) * scale}
          cy={height - padding - (sampledPoints[0].lat - minLat) * scale}
          r="4"
          className="fill-green-500"
        />
        {/* End marker */}
        <circle
          cx={padding + (sampledPoints[sampledPoints.length - 1].lng - minLng) * scale}
          cy={height - padding - (sampledPoints[sampledPoints.length - 1].lat - minLat) * scale}
          r="4"
          className="fill-red-500"
        />
      </svg>
    );
  }, [activity.points]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white truncate">
          {activity.name}
        </h3>
        <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
          <Calendar className="w-4 h-4" />
          <span className="capitalize">{formattedDate}</span>
        </div>
      </div>

      {/* Route preview */}
      <div className="p-4 bg-gray-50 dark:bg-gray-900/50">
        {routeSvg}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 p-4">
        {stats.map((stat) => (
          <div key={stat.label} className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <stat.icon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500">{stat.label}</p>
              <p className="font-semibold text-gray-900 dark:text-white">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Splits preview */}
      {activity.splits.length > 0 && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-500 mb-2">
            Splits ({activity.splits.length} km)
          </p>
          <div className="flex gap-1 overflow-x-auto pb-2">
            {activity.splits.slice(0, 10).map((split) => (
              <div
                key={split.km}
                className="flex-shrink-0 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs"
              >
                <span className="text-gray-500">Km {split.km}:</span>{' '}
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatPace(split.paceSecPerKm)}
                </span>
              </div>
            ))}
            {activity.splits.length > 10 && (
              <div className="flex-shrink-0 px-2 py-1 text-xs text-gray-500">
                +{activity.splits.length - 10}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Best efforts preview */}
      {activity.bestEfforts.length > 0 && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-500 mb-2">
            Meilleures performances
          </p>
          <div className="flex flex-wrap gap-2">
            {activity.bestEfforts.slice(0, 5).map((effort) => (
              <div
                key={effort.distance}
                className="px-2 py-1 bg-blue-50 dark:bg-blue-900/20 rounded text-xs"
              >
                <span className="text-blue-600 dark:text-blue-400 font-medium">
                  {effort.distanceLabel}
                </span>
                <span className="text-gray-500 ml-1">
                  {formatDuration(effort.timeSeconds)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

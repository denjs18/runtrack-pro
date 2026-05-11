'use client';

import { WeeklyStats as WeeklyStatsType } from '@/types/records';
import { formatPace, formatDuration, formatDistance } from '@/lib/converters/units';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface WeeklyStatsProps {
  stats: WeeklyStatsType[];
  limit?: number;
}

export default function WeeklyStats({ stats, limit = 8 }: WeeklyStatsProps) {
  const displayStats = stats.slice(0, limit);

  // Calculate trends
  const getTrend = (current: number, previous: number): 'up' | 'down' | 'same' => {
    if (current > previous * 1.05) return 'up';
    if (current < previous * 0.95) return 'down';
    return 'same';
  };

  // Find max distance for bar scaling
  const maxDistance = Math.max(...displayStats.map((s) => s.totalDistanceMeters), 1);

  return (
    <div className="space-y-3">
      {displayStats.map((week, idx) => {
        const prevWeek = displayStats[idx + 1];
        const distanceTrend = prevWeek
          ? getTrend(week.totalDistanceMeters, prevWeek.totalDistanceMeters)
          : 'same';

        const barWidth = (week.totalDistanceMeters / maxDistance) * 100;

        return (
          <div
            key={`${week.year}-${week.weekNumber}`}
            className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm text-gray-500">
                  Semaine {week.weekNumber}, {week.year}
                </p>
                <p className="text-xs text-gray-400">
                  {new Date(week.weekStart).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'short',
                  })}{' '}
                  -{' '}
                  {new Date(week.weekEnd).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {distanceTrend === 'up' && (
                  <TrendingUp className="w-4 h-4 text-green-500" />
                )}
                {distanceTrend === 'down' && (
                  <TrendingDown className="w-4 h-4 text-red-500" />
                )}
                {distanceTrend === 'same' && (
                  <Minus className="w-4 h-4 text-gray-400" />
                )}
              </div>
            </div>

            {/* Distance bar */}
            <div className="mb-3">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="font-semibold text-gray-900 dark:text-white">
                  {formatDistance(week.totalDistanceMeters)}
                </span>
                <span className="text-gray-500">
                  {week.activities} activité{week.activities !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>

            {/* Stats grid */}
            {week.activities > 0 && (
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div>
                  <p className="text-gray-500">Durée</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {formatDuration(week.totalDurationSeconds)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Allure moy.</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {week.avgPaceSecPerKm > 0
                      ? `${formatPace(week.avgPaceSecPerKm)}/km`
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Plus longue</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {formatDistance(week.longestRunMeters)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">D+</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {Math.round(week.totalElevation)}m
                  </p>
                </div>
              </div>
            )}

            {week.activities === 0 && (
              <p className="text-sm text-gray-400 text-center">Pas d&apos;activité</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

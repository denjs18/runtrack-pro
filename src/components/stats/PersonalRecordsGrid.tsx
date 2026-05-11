'use client';

import { PersonalRecord } from '@/types/records';
import { formatDuration, formatPace } from '@/lib/converters/units';
import { Trophy, Calendar, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface PersonalRecordsGridProps {
  records: PersonalRecord[];
  showAll?: boolean;
}

export default function PersonalRecordsGrid({
  records,
  showAll = false,
}: PersonalRecordsGridProps) {
  // Sort by distance
  const sortedRecords = [...records].sort((a, b) => a.distance - b.distance);
  const displayRecords = showAll ? sortedRecords : sortedRecords.slice(0, 8);

  if (records.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Trophy className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>Pas encore de records personnels</p>
        <p className="text-sm mt-1">
          Importez des activités GPX pour voir vos performances
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {displayRecords.map((record) => (
        <div
          key={`${record.distance}-${record.rank}`}
          className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 hover:border-yellow-300 dark:hover:border-yellow-700 transition-colors"
        >
          {/* Distance label */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-500">
              {record.distanceLabel}
            </span>
            {record.rank === 1 && (
              <Trophy className="w-4 h-4 text-yellow-500" />
            )}
          </div>

          {/* Time */}
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatDuration(record.timeSeconds)}
          </p>

          {/* Pace */}
          <p className="text-sm text-gray-500 mb-3">
            {formatPace(record.paceSecPerKm)}/km
          </p>

          {/* Date and activity */}
          <div className="flex items-center justify-between text-xs text-gray-400">
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>
                {new Date(record.date).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>
            <Link
              href={`/activities/${record.activityId}`}
              className="hover:text-blue-500"
            >
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}

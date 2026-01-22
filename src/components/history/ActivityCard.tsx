'use client';

import Link from 'next/link';
import { Calendar, Clock, Route, Gauge, Trash2 } from 'lucide-react';
import { Activity } from '@/types';
import { formatDate, formatTime, formatDistance, formatDuration, formatPace } from '@/lib/utils';
import DynamicMap from '@/components/tracking/DynamicMap';

interface ActivityCardProps {
  activity: Activity;
  onDelete?: (id: string) => void;
}

export default function ActivityCard({ activity, onDelete }: ActivityCardProps) {
  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onDelete && activity.id) {
      onDelete(activity.id);
    }
  };

  return (
    <Link href={`/activities/${activity.id}`}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-700 group">
        {/* Mini Map */}
        <div className="h-32 relative">
          <DynamicMap
            points={activity.points}
            height="128px"
            showSpeedGradient={false}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-500 transition-colors">
                {activity.name}
              </h3>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mt-1">
                <Calendar className="w-4 h-4" />
                <span>{formatDate(activity.startTime)}</span>
                <span>-</span>
                <Clock className="w-4 h-4" />
                <span>{formatTime(activity.startTime)}</span>
              </div>
            </div>

            {onDelete && (
              <button
                onClick={handleDelete}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                aria-label="Supprimer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <Route className="w-4 h-4 mx-auto text-blue-500 mb-1" />
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                {formatDistance(activity.stats.distance)}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Distance</div>
            </div>

            <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <Clock className="w-4 h-4 mx-auto text-green-500 mb-1" />
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                {formatDuration(activity.stats.duration)}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Durée</div>
            </div>

            <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <Gauge className="w-4 h-4 mx-auto text-orange-500 mb-1" />
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                {formatPace(activity.stats.avgPace)}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Allure</div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

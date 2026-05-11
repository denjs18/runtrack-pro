'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Calendar } from 'lucide-react';
import { getAllActivities } from '@/lib/storage/indexed-db';
import { Activity } from '@/types/unified';
import HeatmapView from '@/components/map/HeatmapView';

// TODO: Replace with actual user ID from auth
const TEMP_USER_ID = 'demo-user';

type TimeFilter = 'all' | 'year' | 'month' | 'week';

export default function HeatmapPage() {
  const router = useRouter();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');

  useEffect(() => {
    async function loadActivities() {
      try {
        const allActivities = await getAllActivities(TEMP_USER_ID);
        // Only include activities with GPS points
        const withGps = allActivities.filter((a) => a.points && a.points.length > 0);
        setActivities(withGps);
        setFilteredActivities(withGps);
      } catch (error) {
        console.error('Failed to load activities:', error);
      } finally {
        setLoading(false);
      }
    }

    loadActivities();
  }, []);

  // Apply time filter
  useEffect(() => {
    if (timeFilter === 'all') {
      setFilteredActivities(activities);
      return;
    }

    const now = Date.now();
    let cutoff: number;

    switch (timeFilter) {
      case 'year':
        cutoff = now - 365 * 24 * 60 * 60 * 1000;
        break;
      case 'month':
        cutoff = now - 30 * 24 * 60 * 60 * 1000;
        break;
      case 'week':
        cutoff = now - 7 * 24 * 60 * 60 * 1000;
        break;
      default:
        cutoff = 0;
    }

    setFilteredActivities(activities.filter((a) => a.startTime >= cutoff));
  }, [timeFilter, activities]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="flex-shrink-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                Heatmap
              </h1>
            </div>

            {/* Time filter */}
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
                className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="all">Toutes les activités</option>
                <option value="year">Cette année</option>
                <option value="month">Ce mois</option>
                <option value="week">Cette semaine</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* Map container */}
      <main className="flex-1 relative">
        <HeatmapView activities={filteredActivities} />
      </main>
    </div>
  );
}

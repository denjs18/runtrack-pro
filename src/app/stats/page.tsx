'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  Calendar,
  Trophy,
  Activity,
  ChevronRight,
  Target,
} from 'lucide-react';
import { getAllActivities } from '@/lib/storage/indexed-db';
import {
  calculateTrainingLoad,
  calculateWeeklyStats,
  getCurrentFitnessStatus,
} from '@/lib/stats/training-load';
import { Activity as ActivityType } from '@/types/unified';
import { TrainingLoad, WeeklyStats as WeeklyStatsType } from '@/types/records';
import FitnessChart from '@/components/stats/FitnessChart';
import WeeklyStats from '@/components/stats/WeeklyStats';
import { formatDistance, formatDuration } from '@/lib/converters/units';

// TODO: Replace with actual user ID from auth
const TEMP_USER_ID = 'demo-user';

export default function StatsPage() {
  const [activities, setActivities] = useState<ActivityType[]>([]);
  const [trainingLoad, setTrainingLoad] = useState<TrainingLoad[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStatsType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const allActivities = await getAllActivities(TEMP_USER_ID);
        setActivities(allActivities);

        const load = calculateTrainingLoad(allActivities);
        setTrainingLoad(load);

        const weekly = calculateWeeklyStats(allActivities, 12);
        setWeeklyStats(weekly);
      } catch (error) {
        console.error('Failed to load stats:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const fitnessStatus = getCurrentFitnessStatus(trainingLoad);

  // Calculate totals
  const totalDistance = activities.reduce(
    (sum, a) => sum + a.stats.distanceMeters,
    0
  );
  const totalDuration = activities.reduce(
    (sum, a) => sum + a.stats.durationSeconds,
    0
  );
  const totalElevation = activities.reduce(
    (sum, a) => sum + a.stats.elevationGain,
    0
  );

  // Risk color
  const riskColors: Record<string, string> = {
    low: 'text-gray-500 bg-gray-100 dark:bg-gray-800',
    optimal: 'text-green-600 bg-green-100 dark:bg-green-900/30',
    high: 'text-orange-600 bg-orange-100 dark:bg-orange-900/30',
    'very-high': 'text-red-600 bg-red-100 dark:bg-red-900/30',
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-24">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Statistiques
          </h1>
          <p className="text-gray-500 mt-1">
            {activities.length} activités enregistrées
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
            <p className="text-sm text-gray-500 mb-1">Distance totale</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatDistance(totalDistance)}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
            <p className="text-sm text-gray-500 mb-1">Temps total</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatDuration(totalDuration)}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
            <p className="text-sm text-gray-500 mb-1">Dénivelé total</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {Math.round(totalElevation)}m
            </p>
          </div>
        </div>

        {/* Fitness status */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-500" />
              État de forme
            </h2>
            <Link
              href="/stats/fitness"
              className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1"
            >
              Détails
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <p className="text-sm text-gray-500 mb-1">Fitness (CTL)</p>
              <p className="text-2xl font-bold text-blue-500">
                {fitnessStatus.ctl}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500 mb-1">Fatigue (ATL)</p>
              <p className="text-2xl font-bold text-red-500">
                {fitnessStatus.atl}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500 mb-1">Forme (TSB)</p>
              <p
                className={`text-2xl font-bold ${
                  fitnessStatus.tsb >= 0 ? 'text-green-500' : 'text-orange-500'
                }`}
              >
                {fitnessStatus.tsb > 0 ? '+' : ''}
                {fitnessStatus.tsb}
              </p>
            </div>
          </div>

          <div
            className={`p-3 rounded-xl text-sm ${riskColors[fitnessStatus.risk]}`}
          >
            {fitnessStatus.recommendation}
          </div>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-4">
          <Link
            href="/stats/records"
            className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 flex items-center gap-4 hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
          >
            <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl">
              <Trophy className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">
                Records personnels
              </p>
              <p className="text-sm text-gray-500">Vos meilleures performances</p>
            </div>
          </Link>

          <Link
            href="/stats/predictions"
            className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 flex items-center gap-4 hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
          >
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
              <Target className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">
                Prédictions
              </p>
              <p className="text-sm text-gray-500">Temps estimés par distance</p>
            </div>
          </Link>
        </div>

        {/* Fitness chart */}
        {trainingLoad.length > 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              Évolution de la forme
            </h2>
            <FitnessChart data={trainingLoad} />
          </div>
        )}

        {/* Weekly stats */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-500" />
            Statistiques hebdomadaires
          </h2>
          <WeeklyStats stats={weeklyStats} />
        </div>
      </main>
    </div>
  );
}

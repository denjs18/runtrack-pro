'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Calendar, TrendingUp, Target, ChevronRight } from 'lucide-react';
import { TrainingPlan } from '@/types/training';
import { getAllTrainingPlans, getActiveTrainingPlan } from '@/lib/storage/indexed-db';
import PlanCalendar from '@/components/training/PlanCalendar';
import WorkoutCard from '@/components/training/WorkoutCard';

// TODO: Replace with actual user ID from auth
const TEMP_USER_ID = 'demo-user';

export default function TrainingPage() {
  const [activePlan, setActivePlan] = useState<TrainingPlan | null>(null);
  const [allPlans, setAllPlans] = useState<TrainingPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPlans() {
      try {
        const plans = await getAllTrainingPlans(TEMP_USER_ID);
        setAllPlans(plans);

        const active = await getActiveTrainingPlan(TEMP_USER_ID);
        setActivePlan(active || null);
      } catch (error) {
        console.error('Failed to load training plans:', error);
      } finally {
        setLoading(false);
      }
    }

    loadPlans();
  }, []);

  // Get today's workout if there's an active plan
  const getTodaysWorkout = () => {
    if (!activePlan) return null;

    const today = new Date();
    const dayOfWeek = today.getDay() || 7; // Convert Sunday (0) to 7

    const currentWeek = activePlan.weeks[activePlan.currentWeekIndex];
    if (!currentWeek) return null;

    return currentWeek.sessions.find(
      (s) => s.dayOfWeek === dayOfWeek && s.type !== 'rest' && s.status === 'pending'
    );
  };

  const todaysWorkout = getTodaysWorkout();

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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Entraînement
              </h1>
              <p className="text-gray-500 mt-1">
                {activePlan
                  ? `Plan actif : ${activePlan.name}`
                  : 'Créez votre premier plan'}
              </p>
            </div>
            <Link
              href="/training/plans/new"
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-colors"
            >
              <Plus className="w-5 h-5" />
              Nouveau plan
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {!activePlan ? (
          /* No active plan */
          <div className="text-center py-12">
            <div className="w-20 h-20 mx-auto mb-6 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
              <Calendar className="w-10 h-10 text-blue-500" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Pas de plan actif
            </h2>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Créez un plan d&apos;entraînement personnalisé pour atteindre vos objectifs de course.
            </p>
            <Link
              href="/training/plans/new"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-colors"
            >
              <Plus className="w-5 h-5" />
              Créer un plan
            </Link>
          </div>
        ) : (
          /* Active plan dashboard */
          <div className="space-y-6">
            {/* Today's workout */}
            {todaysWorkout && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Target className="w-5 h-5 text-blue-500" />
                  Séance du jour
                </h2>
                <WorkoutCard session={todaysWorkout} />
              </div>
            )}

            {/* Plan calendar */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-500" />
                  Calendrier
                </h2>
                <Link
                  href={`/training/plans/${activePlan.id}`}
                  className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1"
                >
                  Voir le plan complet
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
              <PlanCalendar plan={activePlan} />
            </div>

            {/* Progress summary */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-500" />
                Progression
              </h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    {activePlan.completedSessions.length}
                  </p>
                  <p className="text-sm text-gray-500">Séances complétées</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    {activePlan.currentWeekIndex + 1}/{activePlan.weeks.length}
                  </p>
                  <p className="text-sm text-gray-500">Semaines</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    {activePlan.projectedProgress.confidenceLevel === 'high'
                      ? '90%'
                      : activePlan.projectedProgress.confidenceLevel === 'medium'
                        ? '75%'
                        : '50%'}
                  </p>
                  <p className="text-sm text-gray-500">Confiance</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Past plans */}
        {allPlans.filter((p) => !p.isActive).length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              Plans précédents
            </h2>
            <div className="space-y-2">
              {allPlans
                .filter((p) => !p.isActive)
                .map((plan) => (
                  <Link
                    key={plan.id}
                    href={`/training/plans/${plan.id}`}
                    className="block p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {plan.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {new Date(plan.startDate).toLocaleDateString('fr-FR')} -{' '}
                          {new Date(plan.endDate).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </Link>
                ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, Target, TrendingUp, Trash2 } from 'lucide-react';
import { TrainingPlan } from '@/types/training';
import { getTrainingPlan, saveTrainingPlan, deleteTrainingPlan } from '@/lib/storage/indexed-db';
import PlanCalendar from '@/components/training/PlanCalendar';
import WorkoutCard from '@/components/training/WorkoutCard';
import { formatPace } from '@/lib/converters/units';

export default function PlanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const planId = params.id as string;

  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'calendar' | 'all-sessions' | 'projection'>('calendar');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    async function loadPlan() {
      try {
        const loadedPlan = await getTrainingPlan(planId);
        setPlan(loadedPlan || null);
      } catch (error) {
        console.error('Failed to load plan:', error);
      } finally {
        setLoading(false);
      }
    }

    if (planId) {
      loadPlan();
    }
  }, [planId]);

  const handleSessionComplete = async (sessionId: string) => {
    if (!plan) return;

    // Update the session status
    const updatedWeeks = plan.weeks.map((week) => ({
      ...week,
      sessions: week.sessions.map((session) =>
        session.id === sessionId
          ? { ...session, status: 'completed' as const }
          : session
      ),
    }));

    const updatedPlan = {
      ...plan,
      weeks: updatedWeeks,
      updatedAt: Date.now(),
    };

    await saveTrainingPlan(updatedPlan);
    setPlan(updatedPlan);
  };

  const handleSessionSkip = async (sessionId: string) => {
    if (!plan) return;

    const updatedWeeks = plan.weeks.map((week) => ({
      ...week,
      sessions: week.sessions.map((session) =>
        session.id === sessionId
          ? { ...session, status: 'skipped' as const }
          : session
      ),
    }));

    const updatedPlan = {
      ...plan,
      weeks: updatedWeeks,
      updatedAt: Date.now(),
    };

    await saveTrainingPlan(updatedPlan);
    setPlan(updatedPlan);
  };

  const handleDelete = async () => {
    if (!plan) return;
    await deleteTrainingPlan(plan.id);
    router.push('/training');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Plan non trouvé</p>
          <button
            onClick={() => router.push('/training')}
            className="text-blue-500 hover:text-blue-600"
          >
            Retour aux plans
          </button>
        </div>
      </div>
    );
  }

  const phaseColors: Record<string, string> = {
    base: 'bg-green-500',
    build: 'bg-blue-500',
    peak: 'bg-orange-500',
    taper: 'bg-purple-500',
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-24">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {plan.name}
                </h1>
                <p className="text-sm text-gray-500">
                  {new Date(plan.startDate).toLocaleDateString('fr-FR')} -{' '}
                  {new Date(plan.endDate).toLocaleDateString('fr-FR')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {plan.isActive && (
                <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs font-medium rounded-full">
                  Actif
                </span>
              )}
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-red-500"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex gap-4 border-t border-gray-200 dark:border-gray-800">
            {[
              { key: 'calendar', label: 'Calendrier', icon: Calendar },
              { key: 'all-sessions', label: 'Toutes les séances', icon: Target },
              { key: 'projection', label: 'Projection', icon: TrendingUp },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 -mb-px transition-colors ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-500'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {activeTab === 'calendar' && (
          <PlanCalendar
            plan={plan}
            onSessionComplete={handleSessionComplete}
            onSessionSkip={handleSessionSkip}
          />
        )}

        {activeTab === 'all-sessions' && (
          <div className="space-y-6">
            {plan.weeks.map((week) => (
              <div key={week.weekNumber}>
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    Semaine {week.weekNumber}
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium text-white ${phaseColors[week.phase]}`}
                  >
                    {week.phase.charAt(0).toUpperCase() + week.phase.slice(1)}
                  </span>
                  <span className="text-sm text-gray-500">
                    {week.targetDistance} km
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {week.sessions
                    .filter((s) => s.type !== 'rest')
                    .map((session) => (
                      <WorkoutCard
                        key={session.id}
                        session={session}
                        onComplete={() => handleSessionComplete(session.id)}
                        onSkip={() => handleSessionSkip(session.id)}
                      />
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'projection' && (
          <div className="space-y-6">
            {/* Goal summary */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                Objectif
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Type</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {plan.goal.type === 'race' ? 'Course' : 'Fitness'}
                  </p>
                </div>
                {plan.goal.raceDistance && (
                  <div>
                    <p className="text-sm text-gray-500">Distance</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {(plan.goal.raceDistance / 1000).toFixed(1)} km
                    </p>
                  </div>
                )}
                {plan.goal.targetTime && (
                  <div>
                    <p className="text-sm text-gray-500">Temps cible</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {Math.floor(plan.goal.targetTime / 60)}:
                      {(plan.goal.targetTime % 60).toString().padStart(2, '0')}
                    </p>
                  </div>
                )}
                {plan.goal.raceDate && (
                  <div>
                    <p className="text-sm text-gray-500">Date</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {new Date(plan.goal.raceDate).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Confidence */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                Niveau de confiance
              </h3>
              <div className="flex items-center gap-4">
                <div
                  className={`w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold ${
                    plan.projectedProgress.confidenceLevel === 'high'
                      ? 'bg-green-500'
                      : plan.projectedProgress.confidenceLevel === 'medium'
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                  }`}
                >
                  {plan.projectedProgress.confidenceLevel === 'high'
                    ? '90%'
                    : plan.projectedProgress.confidenceLevel === 'medium'
                      ? '75%'
                      : '50%'}
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {plan.projectedProgress.onTrack
                      ? 'Vous êtes en bonne voie'
                      : 'Objectif ambitieux'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {plan.projectedProgress.confidenceLevel === 'high'
                      ? 'Continuez comme ça !'
                      : plan.projectedProgress.confidenceLevel === 'medium'
                        ? 'Restez constant'
                        : 'Ajustez vos attentes ou augmentez le volume'}
                  </p>
                </div>
              </div>
            </div>

            {/* Weekly projection */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                Projection par semaine
              </h3>
              <div className="space-y-3">
                {plan.projectedProgress.weeks.map((week) => (
                  <div
                    key={week.weekNumber}
                    className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500">S{week.weekNumber}</span>
                      <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${week.projectedFitness}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      Allure: {formatPace(week.projectedPace)}/km
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Supprimer ce plan ?
            </h3>
            <p className="text-gray-500 mb-6">
              Cette action est irréversible. Toutes les données de ce plan seront perdues.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2 px-4 border border-gray-200 dark:border-gray-700 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2 px-4 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

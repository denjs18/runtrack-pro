'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Target, Zap } from 'lucide-react';
import { getPersonalRecords, getAllActivities, savePersonalRecords } from '@/lib/storage/indexed-db';
import { computeAllRecords, getAllPRs } from '@/lib/records/record-detector';
import { predictRaceTimes, calculateVDOT, getTrainingPaces } from '@/lib/predictions/predictor';
import { RacePrediction } from '@/types/records';
import RacePredictionsCard from '@/components/predictions/RacePredictionsCard';
import { formatPace } from '@/lib/converters/units';

// TODO: Replace with actual user ID from auth
const TEMP_USER_ID = 'demo-user';

export default function PredictionsPage() {
  const router = useRouter();
  const [predictions, setPredictions] = useState<RacePrediction[]>([]);
  const [vdot, setVdot] = useState<number | null>(null);
  const [trainingPaces, setTrainingPaces] = useState<ReturnType<typeof getTrainingPaces> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        let records = await getPersonalRecords(TEMP_USER_ID);

        // Compute records if none exist
        if (!records) {
          const activities = await getAllActivities(TEMP_USER_ID);
          if (activities.length > 0) {
            records = computeAllRecords(activities, TEMP_USER_ID);
            await savePersonalRecords(records);
          }
        }

        if (records) {
          const prs = getAllPRs(records);
          const racePredictions = predictRaceTimes(prs);
          setPredictions(racePredictions);

          // Calculate VDOT from best 5k or 10k
          const best5k = prs.find((r) => r.distance === 5000);
          const best10k = prs.find((r) => r.distance === 10000);

          let calculatedVdot = 35;
          if (best10k) {
            calculatedVdot = calculateVDOT(10000, best10k.timeSeconds);
          } else if (best5k) {
            calculatedVdot = calculateVDOT(5000, best5k.timeSeconds);
          } else if (prs.length > 0) {
            const longest = prs.sort((a, b) => b.distance - a.distance)[0];
            calculatedVdot = calculateVDOT(longest.distance, longest.timeSeconds);
          }

          setVdot(Math.round(calculatedVdot * 10) / 10);
          setTrainingPaces(getTrainingPaces(calculatedVdot));
        }
      } catch (error) {
        console.error('Failed to load predictions:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Determine level from VDOT
  const getLevel = (vdot: number): string => {
    if (vdot >= 60) return 'Elite';
    if (vdot >= 50) return 'Avancé';
    if (vdot >= 40) return 'Intermédiaire';
    return 'Débutant';
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
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              Prédictions de course
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* VDOT Card */}
        {vdot && (
          <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90 mb-1">Votre VDOT estimé</p>
                <p className="text-5xl font-bold">{vdot}</p>
                <p className="text-sm opacity-90 mt-2">
                  Niveau : {getLevel(vdot)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm opacity-75">
                  Le VDOT est une estimation de votre VO2max basée sur vos performances.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Training paces */}
        {trainingPaces && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-blue-500" />
              Allures d&apos;entraînement recommandées
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
                <p className="text-sm text-green-600 dark:text-green-400 mb-1">
                  Facile
                </p>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {formatPace(trainingPaces.easy.min)} - {formatPace(trainingPaces.easy.max)}/km
                </p>
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                <p className="text-sm text-blue-600 dark:text-blue-400 mb-1">
                  Marathon
                </p>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {formatPace(trainingPaces.marathon)}/km
                </p>
              </div>

              <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl">
                <p className="text-sm text-orange-600 dark:text-orange-400 mb-1">
                  Seuil
                </p>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {formatPace(trainingPaces.threshold)}/km
                </p>
              </div>

              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl">
                <p className="text-sm text-red-600 dark:text-red-400 mb-1">
                  Intervalles
                </p>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {formatPace(trainingPaces.interval)}/km
                </p>
              </div>

              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                <p className="text-sm text-purple-600 dark:text-purple-400 mb-1">
                  Répétitions
                </p>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {formatPace(trainingPaces.repetition)}/km
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Race predictions */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-500" />
            Temps de course estimés
          </h2>
          <RacePredictionsCard predictions={predictions} />
        </div>
      </main>
    </div>
  );
}

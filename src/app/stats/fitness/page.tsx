'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Activity, TrendingUp, AlertTriangle, Info } from 'lucide-react';
import { getAllActivities } from '@/lib/storage/indexed-db';
import {
  calculateTrainingLoad,
  getCurrentFitnessStatus,
} from '@/lib/stats/training-load';
import { TrainingLoad } from '@/types/records';
import FitnessChart from '@/components/stats/FitnessChart';

// TODO: Replace with actual user ID from auth
const TEMP_USER_ID = 'demo-user';

export default function FitnessPage() {
  const router = useRouter();
  const [trainingLoad, setTrainingLoad] = useState<TrainingLoad[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const allActivities = await getAllActivities(TEMP_USER_ID);
        const load = calculateTrainingLoad(allActivities);
        setTrainingLoad(load);
      } catch (error) {
        console.error('Failed to load training load:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const fitnessStatus = getCurrentFitnessStatus(trainingLoad);

  const riskInfo: Record<
    string,
    { label: string; color: string; bgColor: string }
  > = {
    low: {
      label: 'Faible',
      color: 'text-gray-600',
      bgColor: 'bg-gray-100 dark:bg-gray-800',
    },
    optimal: {
      label: 'Optimal',
      color: 'text-green-600',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
    },
    high: {
      label: 'Élevé',
      color: 'text-orange-600',
      bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    },
    'very-high': {
      label: 'Très élevé',
      color: 'text-red-600',
      bgColor: 'bg-red-100 dark:bg-red-900/30',
    },
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
              Suivi de forme (ATL/CTL/TSB)
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Current status */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-500" />
            État actuel
          </h2>

          <div className="grid grid-cols-3 gap-6 mb-6">
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
              <p className="text-sm text-blue-600 dark:text-blue-400 mb-1">
                Fitness (CTL)
              </p>
              <p className="text-4xl font-bold text-blue-600">
                {fitnessStatus.ctl}
              </p>
              <p className="text-xs text-blue-500 mt-1">
                Charge chronique (42j)
              </p>
            </div>

            <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-xl">
              <p className="text-sm text-red-600 dark:text-red-400 mb-1">
                Fatigue (ATL)
              </p>
              <p className="text-4xl font-bold text-red-600">
                {fitnessStatus.atl}
              </p>
              <p className="text-xs text-red-500 mt-1">Charge aiguë (7j)</p>
            </div>

            <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
              <p className="text-sm text-green-600 dark:text-green-400 mb-1">
                Forme (TSB)
              </p>
              <p className="text-4xl font-bold text-green-600">
                {fitnessStatus.tsb > 0 ? '+' : ''}
                {fitnessStatus.tsb}
              </p>
              <p className="text-xs text-green-500 mt-1">CTL - ATL</p>
            </div>
          </div>

          {/* Risk indicator */}
          <div
            className={`p-4 rounded-xl ${riskInfo[fitnessStatus.risk].bgColor}`}
          >
            <div className="flex items-center gap-3">
              {fitnessStatus.risk === 'very-high' && (
                <AlertTriangle className="w-6 h-6 text-red-500" />
              )}
              <div>
                <p
                  className={`font-semibold ${riskInfo[fitnessStatus.risk].color}`}
                >
                  Niveau de risque : {riskInfo[fitnessStatus.risk].label}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {fitnessStatus.recommendation}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            Évolution sur 90 jours
          </h2>
          <FitnessChart data={trainingLoad} />
        </div>

        {/* Explanation */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-6">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
            <Info className="w-5 h-5" />
            Comprendre les métriques
          </h3>

          <div className="space-y-4 text-sm text-blue-800 dark:text-blue-200">
            <div>
              <p className="font-medium">CTL (Chronic Training Load) - Fitness</p>
              <p className="opacity-75">
                Moyenne exponentielle de votre charge d&apos;entraînement sur 42 jours.
                Représente votre niveau de forme global.
              </p>
            </div>

            <div>
              <p className="font-medium">ATL (Acute Training Load) - Fatigue</p>
              <p className="opacity-75">
                Moyenne exponentielle de votre charge sur 7 jours. Représente
                votre fatigue récente.
              </p>
            </div>

            <div>
              <p className="font-medium">TSB (Training Stress Balance) - Forme</p>
              <p className="opacity-75">
                Différence entre CTL et ATL. Un TSB positif indique que vous êtes
                frais, négatif que vous êtes fatigué.
              </p>
            </div>

            <div className="pt-2 border-t border-blue-200 dark:border-blue-800">
              <p className="font-medium">Zones de risque (ratio ATL/CTL)</p>
              <ul className="mt-2 space-y-1 opacity-75">
                <li>• &lt; 0.8 : Charge faible - risque de désentraînement</li>
                <li>• 0.8 - 1.3 : Zone optimale - progression saine</li>
                <li>• 1.3 - 1.5 : Charge élevée - surveillez la récupération</li>
                <li>• &gt; 1.5 : Risque de surentraînement</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

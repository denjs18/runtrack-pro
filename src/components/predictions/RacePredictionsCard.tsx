'use client';

import { RacePrediction } from '@/types/records';
import { formatDuration, formatPace } from '@/lib/converters/units';
import { Target, Info } from 'lucide-react';

interface RacePredictionsCardProps {
  predictions: RacePrediction[];
}

export default function RacePredictionsCard({
  predictions,
}: RacePredictionsCardProps) {
  if (predictions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>Pas assez de données pour les prédictions</p>
        <p className="text-sm mt-1">
          Complétez au moins une course de 5km ou plus
        </p>
      </div>
    );
  }

  const confidenceColors: Record<string, string> = {
    high: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    low: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  };

  const confidenceLabels: Record<string, string> = {
    high: 'Élevée',
    medium: 'Moyenne',
    low: 'Faible',
  };

  return (
    <div className="space-y-4">
      {predictions.map((prediction) => (
        <div
          key={prediction.distance}
          className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {prediction.distanceLabel}
            </h3>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${confidenceColors[prediction.confidence]}`}
            >
              {confidenceLabels[prediction.confidence]}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500 mb-1">Temps prédit</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatDuration(prediction.predictedTimeSeconds)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Allure prédite</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatPace(prediction.predictedPaceSecPerKm)}/km
              </p>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500">
            Basé sur : {prediction.basedOn.distanceLabel} en{' '}
            {formatDuration(prediction.basedOn.timeSeconds)}
          </div>
        </div>
      ))}

      {/* Explanation */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-medium mb-1">Comment sont calculées les prédictions ?</p>
            <p className="opacity-75">
              Les temps sont estimés avec la formule de Riegel (T2 = T1 × (D2/D1)^1.06).
              La confiance dépend de l&apos;écart entre la distance de référence et la distance cible.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

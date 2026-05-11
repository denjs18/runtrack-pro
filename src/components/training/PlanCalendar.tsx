'use client';

import { useState } from 'react';
import { TrainingPlan, TrainingWeek } from '@/types/training';
import WorkoutCard from './WorkoutCard';
import { ChevronLeft, ChevronRight, Calendar, TrendingUp } from 'lucide-react';
import { formatDistance } from '@/lib/converters/units';

interface PlanCalendarProps {
  plan: TrainingPlan;
  onSessionComplete?: (sessionId: string) => void;
  onSessionSkip?: (sessionId: string) => void;
}

const phaseLabels: Record<string, { label: string; color: string }> = {
  base: { label: 'Base', color: 'bg-green-500' },
  build: { label: 'Construction', color: 'bg-blue-500' },
  peak: { label: 'Pic', color: 'bg-orange-500' },
  taper: { label: 'Affûtage', color: 'bg-purple-500' },
};

export default function PlanCalendar({
  plan,
  onSessionComplete,
  onSessionSkip,
}: PlanCalendarProps) {
  const [currentWeekIndex, setCurrentWeekIndex] = useState(plan.currentWeekIndex);
  const currentWeek = plan.weeks[currentWeekIndex];

  const goToPreviousWeek = () => {
    if (currentWeekIndex > 0) {
      setCurrentWeekIndex(currentWeekIndex - 1);
    }
  };

  const goToNextWeek = () => {
    if (currentWeekIndex < plan.weeks.length - 1) {
      setCurrentWeekIndex(currentWeekIndex + 1);
    }
  };

  const completedDistance = currentWeek.sessions
    .filter((s) => s.status === 'completed' && s.completedData)
    .reduce((sum, s) => sum + (s.completedData?.actualDistance || 0), 0);

  const totalTargetDistance = currentWeek.sessions
    .filter((s) => s.type !== 'rest')
    .reduce((sum, s) => sum + (s.targetDistance || 0), 0);

  const progress = totalTargetDistance > 0 ? (completedDistance / totalTargetDistance) * 100 : 0;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={goToPreviousWeek}
            disabled={currentWeekIndex === 0}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="text-center">
            <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
              Semaine {currentWeek.weekNumber}
            </h3>
            <div className="flex items-center justify-center gap-2 mt-1">
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium text-white ${phaseLabels[currentWeek.phase].color}`}
              >
                {phaseLabels[currentWeek.phase].label}
              </span>
              {currentWeek.notes && (
                <span className="text-xs text-gray-500">{currentWeek.notes}</span>
              )}
            </div>
          </div>

          <button
            onClick={goToNextWeek}
            disabled={currentWeekIndex === plan.weeks.length - 1}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Week progress */}
        <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-3">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-600 dark:text-gray-400">Progression</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {completedDistance.toFixed(1)} / {totalTargetDistance.toFixed(1)} km
            </span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Sessions grid */}
      <div className="p-4 grid grid-cols-7 gap-2">
        {currentWeek.sessions.map((session) => (
          <WorkoutCard
            key={session.id}
            session={session}
            compact
            onComplete={
              onSessionComplete ? () => onSessionComplete(session.id) : undefined
            }
            onSkip={onSessionSkip ? () => onSessionSkip(session.id) : undefined}
          />
        ))}
      </div>

      {/* Week overview */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-gray-500 mb-1">Volume cible</p>
            <p className="font-semibold text-gray-900 dark:text-white">
              {currentWeek.targetDistance} km
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Durée estimée</p>
            <p className="font-semibold text-gray-900 dark:text-white">
              {currentWeek.targetTime} min
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Séances</p>
            <p className="font-semibold text-gray-900 dark:text-white">
              {currentWeek.sessions.filter((s) => s.type !== 'rest').length}
            </p>
          </div>
        </div>
      </div>

      {/* Plan progress bar */}
      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
          <Calendar className="w-4 h-4" />
          <span>
            Semaine {currentWeekIndex + 1} sur {plan.weeks.length}
          </span>
        </div>
        <div className="flex gap-1">
          {plan.weeks.map((week, idx) => (
            <button
              key={week.weekNumber}
              onClick={() => setCurrentWeekIndex(idx)}
              className={`flex-1 h-2 rounded-full transition-colors ${
                idx < plan.currentWeekIndex
                  ? 'bg-green-500'
                  : idx === currentWeekIndex
                    ? 'bg-blue-500'
                    : 'bg-gray-200 dark:bg-gray-700'
              }`}
              title={`Semaine ${week.weekNumber} - ${phaseLabels[week.phase].label}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

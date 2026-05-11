'use client';

import { PlannedSession, SessionType } from '@/types/training';
import { formatPace } from '@/lib/converters/units';
import {
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  Zap,
  Coffee,
  Mountain,
  Timer,
  Trophy,
  Shuffle,
} from 'lucide-react';

interface WorkoutCardProps {
  session: PlannedSession;
  onComplete?: () => void;
  onSkip?: () => void;
  compact?: boolean;
}

const sessionIcons: Record<SessionType, React.ElementType> = {
  easy: Play,
  long: MapPin,
  tempo: Zap,
  intervals: Timer,
  fartlek: Shuffle,
  hills: Mountain,
  recovery: Coffee,
  rest: Coffee,
  race: Trophy,
  'time-trial': Trophy,
};

const sessionColors: Record<SessionType, string> = {
  easy: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800',
  long: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  tempo: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800',
  intervals: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800',
  fartlek: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800',
  hills: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  recovery: 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-800',
  rest: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700',
  race: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
  'time-trial': 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800',
};

const dayNames = ['', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export default function WorkoutCard({
  session,
  onComplete,
  onSkip,
  compact = false,
}: WorkoutCardProps) {
  const Icon = sessionIcons[session.type];
  const colorClasses = sessionColors[session.type];

  if (session.type === 'rest') {
    return (
      <div className={`p-3 rounded-xl border ${colorClasses} ${compact ? '' : 'min-h-[120px]'}`}>
        <div className="flex items-center gap-2">
          <Coffee className="w-4 h-4" />
          <span className="font-medium text-sm">{dayNames[session.dayOfWeek]}</span>
        </div>
        <p className="text-sm mt-1 opacity-75">Repos</p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`p-3 rounded-xl border ${colorClasses}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4" />
            <span className="font-medium text-sm">{dayNames[session.dayOfWeek]}</span>
          </div>
          {session.status === 'completed' && (
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          )}
          {session.status === 'skipped' && (
            <XCircle className="w-4 h-4 text-gray-400" />
          )}
        </div>
        <p className="text-sm font-semibold mt-1 truncate">{session.title}</p>
        {session.targetDistance && (
          <p className="text-xs opacity-75">{session.targetDistance} km</p>
        )}
      </div>
    );
  }

  return (
    <div className={`p-4 rounded-xl border ${colorClasses}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-white/50 dark:bg-black/20">
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <p className="font-semibold">{session.title}</p>
            <p className="text-xs opacity-75">
              {session.date
                ? new Date(session.date).toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'short',
                  })
                : dayNames[session.dayOfWeek]}
            </p>
          </div>
        </div>
        {session.status === 'completed' && (
          <CheckCircle2 className="w-6 h-6 text-green-500" />
        )}
        {session.status === 'skipped' && (
          <XCircle className="w-6 h-6 text-gray-400" />
        )}
      </div>

      {/* Description */}
      <p className="text-sm mb-3 opacity-90">{session.description}</p>

      {/* Stats */}
      <div className="flex flex-wrap gap-3 text-sm">
        {session.targetDistance && (
          <div className="flex items-center gap-1">
            <MapPin className="w-4 h-4 opacity-75" />
            <span>{session.targetDistance} km</span>
          </div>
        )}
        {session.targetDuration && (
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4 opacity-75" />
            <span>{session.targetDuration} min</span>
          </div>
        )}
        {session.targetPace && (
          <div className="flex items-center gap-1">
            <Zap className="w-4 h-4 opacity-75" />
            <span>
              {formatPace(session.targetPace.min)} - {formatPace(session.targetPace.max)}/km
            </span>
          </div>
        )}
      </div>

      {/* Intervals detail */}
      {session.intervals && (
        <div className="mt-3 p-2 rounded-lg bg-white/30 dark:bg-black/20 text-sm">
          <p className="font-medium">
            {session.intervals.reps} x {session.intervals.distance}m
          </p>
          <p className="opacity-75">
            Allure: {formatPace(session.intervals.targetPace)}/km • Récup:{' '}
            {session.intervals.recovery}s
          </p>
        </div>
      )}

      {/* Actions */}
      {session.status === 'pending' && (onComplete || onSkip) && (
        <div className="flex gap-2 mt-4">
          {onComplete && (
            <button
              onClick={onComplete}
              className="flex-1 py-2 px-3 bg-white/50 dark:bg-black/20 rounded-lg font-medium text-sm hover:bg-white/70 dark:hover:bg-black/30 transition-colors"
            >
              Marquer terminé
            </button>
          )}
          {onSkip && (
            <button
              onClick={onSkip}
              className="py-2 px-3 text-sm opacity-75 hover:opacity-100 transition-opacity"
            >
              Passer
            </button>
          )}
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { PersonalRecord } from '@/types/records';
import { formatDuration, formatPace } from '@/lib/converters/units';
import { Trophy, X, Sparkles } from 'lucide-react';

interface RecordBannerProps {
  record: PersonalRecord;
  previousTime?: number;
  onClose?: () => void;
  autoHide?: boolean;
}

export default function RecordBanner({
  record,
  previousTime,
  onClose,
  autoHide = true,
}: RecordBannerProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (autoHide) {
      const timer = setTimeout(() => {
        setVisible(false);
        onClose?.();
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [autoHide, onClose]);

  if (!visible) return null;

  const improvement = previousTime
    ? ((previousTime - record.timeSeconds) / previousTime) * 100
    : null;

  return (
    <div className="fixed top-4 left-4 right-4 z-50 animate-slide-down">
      <div className="max-w-md mx-auto bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 rounded-2xl shadow-2xl overflow-hidden">
        {/* Sparkle decorations */}
        <div className="absolute inset-0 overflow-hidden">
          <Sparkles className="absolute top-2 left-4 w-6 h-6 text-white/30 animate-pulse" />
          <Sparkles className="absolute top-4 right-8 w-4 h-4 text-white/40 animate-pulse delay-100" />
          <Sparkles className="absolute bottom-3 left-12 w-5 h-5 text-white/25 animate-pulse delay-200" />
        </div>

        <div className="relative p-6 text-white">
          {/* Close button */}
          {onClose && (
            <button
              onClick={() => {
                setVisible(false);
                onClose();
              }}
              className="absolute top-2 right-2 p-1 rounded-full hover:bg-white/20 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          {/* Trophy icon */}
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-white/20 rounded-full">
              <Trophy className="w-8 h-8" />
            </div>
            <div>
              <p className="text-sm font-medium opacity-90">Nouveau record !</p>
              <p className="text-2xl font-bold">{record.distanceLabel}</p>
            </div>
          </div>

          {/* Time */}
          <div className="flex items-end gap-4">
            <div>
              <p className="text-4xl font-bold">
                {formatDuration(record.timeSeconds)}
              </p>
              <p className="text-sm opacity-90">
                {formatPace(record.paceSecPerKm)}/km
              </p>
            </div>

            {improvement && improvement > 0 && (
              <div className="px-3 py-1 bg-white/20 rounded-full text-sm font-medium">
                -{improvement.toFixed(1)}%
              </div>
            )}
          </div>

          {/* Previous record */}
          {previousTime && (
            <p className="mt-3 text-sm opacity-75">
              Record précédent : {formatDuration(previousTime)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

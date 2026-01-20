'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Play,
  Pause,
  Square,
  Timer,
  Route,
  Gauge,
  Mountain,
  Activity,
  Save,
  AlertCircle,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import StatCard from './StatCard';
import DynamicMap from './DynamicMap';
import useGPS from '@/hooks/useGPS';
import useActivityStats from '@/hooks/useActivityStats';
import { useToast } from '@/components/ui/Toast';
import { formatDuration, formatDistance, formatPace, formatSpeed, generateActivityName } from '@/lib/utils';
import { GPSPoint, Activity as ActivityType } from '@/types';

const STORAGE_KEY = 'runtrack_pending_activity';

export default function TrackerInterface() {
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [pausedTime, setPausedTime] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [duration, setDuration] = useState(0);

  const pauseStartRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const { showToast } = useToast();

  const {
    currentPosition,
    points,
    error: gpsError,
    isWatching,
    startWatching,
    stopWatching,
    clearPoints,
  } = useGPS();

  const stats = useActivityStats(points, { startTime, pausedTime });

  // Duration timer
  useEffect(() => {
    if (isTracking && !isPaused && startTime) {
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTime - pausedTime) / 1000));
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isTracking, isPaused, startTime, pausedTime]);

  // Save to localStorage when tracking
  useEffect(() => {
    if (isTracking && points.length > 0) {
      const pendingData = {
        points,
        startTime,
        pausedTime,
        savedAt: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingData));
    }
  }, [isTracking, points, startTime, pausedTime]);

  const handleStart = useCallback(() => {
    setIsTracking(true);
    setIsPaused(false);
    setStartTime(Date.now());
    setPausedTime(0);
    setDuration(0);
    clearPoints();
    startWatching();
    showToast('Course démarrée', 'success');
  }, [clearPoints, startWatching, showToast]);

  const handlePause = useCallback(() => {
    if (isPaused) {
      // Resume
      if (pauseStartRef.current) {
        setPausedTime((prev) => prev + (Date.now() - pauseStartRef.current!));
        pauseStartRef.current = null;
      }
      setIsPaused(false);
      startWatching();
      showToast('Course reprise', 'info');
    } else {
      // Pause
      pauseStartRef.current = Date.now();
      setIsPaused(true);
      stopWatching();
      showToast('Course en pause', 'info');
    }
  }, [isPaused, startWatching, stopWatching, showToast]);

  const handleStop = useCallback(async () => {
    stopWatching();

    if (points.length < 2) {
      showToast('Course trop courte pour être enregistrée', 'warning');
      setIsTracking(false);
      setStartTime(null);
      clearPoints();
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    setIsSaving(true);

    const activity: Partial<ActivityType> = {
      userId: 'anonymous', // In production, use actual user ID
      name: generateActivityName(),
      startTime: new Date(startTime!),
      endTime: new Date(),
      points,
      stats: {
        ...stats,
        duration,
      },
    };

    try {
      const response = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activity),
      });

      if (!response.ok) {
        throw new Error('Failed to save activity');
      }

      localStorage.removeItem(STORAGE_KEY);
      showToast('Course enregistrée avec succès!', 'success');
    } catch {
      // Save to localStorage for later sync
      const pendingActivities = JSON.parse(
        localStorage.getItem('runtrack_offline_activities') || '[]'
      );
      pendingActivities.push(activity);
      localStorage.setItem('runtrack_offline_activities', JSON.stringify(pendingActivities));
      showToast('Course sauvegardée localement (hors ligne)', 'warning');
    } finally {
      setIsSaving(false);
      setIsTracking(false);
      setIsPaused(false);
      setStartTime(null);
      setPausedTime(0);
      setDuration(0);
      clearPoints();
    }
  }, [stopWatching, points, startTime, stats, duration, clearPoints, showToast]);

  return (
    <div className="space-y-6">
      {/* Map */}
      <DynamicMap
        points={points}
        currentPosition={currentPosition}
        isTracking={isTracking && !isPaused}
        height="40vh"
        showSpeedGradient={true}
      />

      {/* GPS Error */}
      {gpsError && (
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <p className="text-sm text-red-700 dark:text-red-300">{gpsError}</p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<Timer className="w-5 h-5" />}
          label="Durée"
          value={formatDuration(duration)}
          variant="highlight"
        />
        <StatCard
          icon={<Route className="w-5 h-5" />}
          label="Distance"
          value={formatDistance(stats.distance)}
          variant="primary"
        />
        <StatCard
          icon={<Activity className="w-5 h-5" />}
          label="Allure"
          value={formatPace(stats.currentPace)}
          subValue={`Moy: ${formatPace(stats.avgPace)}/km`}
        />
        <StatCard
          icon={<Gauge className="w-5 h-5" />}
          label="Vitesse"
          value={formatSpeed(stats.currentSpeed)}
          subValue={`Max: ${formatSpeed(stats.maxSpeed)}`}
        />
        <StatCard
          icon={<Mountain className="w-5 h-5" />}
          label="Dénivelé +"
          value={`${Math.round(stats.elevationGain)} m`}
        />
        <StatCard
          icon={<Route className="w-5 h-5" />}
          label="Points GPS"
          value={points.length.toString()}
          subValue={currentPosition ? `Précision: ${currentPosition.accuracy.toFixed(0)}m` : undefined}
        />
      </div>

      {/* Control Buttons */}
      <div className="flex justify-center gap-4 pt-4">
        {!isTracking ? (
          <Button
            variant="success"
            size="xl"
            onClick={handleStart}
            className="w-40 h-40 rounded-full flex-col gap-2"
          >
            <Play className="w-12 h-12" />
            <span className="text-lg">Démarrer</span>
          </Button>
        ) : (
          <>
            <Button
              variant="secondary"
              size="lg"
              onClick={handlePause}
              className="w-20 h-20 rounded-full"
              disabled={isSaving}
            >
              {isPaused ? (
                <Play className="w-8 h-8" />
              ) : (
                <Pause className="w-8 h-8" />
              )}
            </Button>
            <Button
              variant="danger"
              size="lg"
              onClick={handleStop}
              className="w-20 h-20 rounded-full"
              isLoading={isSaving}
              disabled={isSaving}
            >
              {isSaving ? (
                <Save className="w-8 h-8" />
              ) : (
                <Square className="w-8 h-8" />
              )}
            </Button>
          </>
        )}
      </div>

      {/* Status indicator */}
      {isTracking && (
        <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <span
            className={`w-2 h-2 rounded-full ${
              isPaused
                ? 'bg-yellow-500'
                : isWatching
                ? 'bg-green-500 animate-pulse'
                : 'bg-red-500'
            }`}
          />
          <span>
            {isPaused
              ? 'En pause'
              : isWatching
              ? 'Enregistrement en cours...'
              : 'En attente du GPS...'}
          </span>
        </div>
      )}
    </div>
  );
}

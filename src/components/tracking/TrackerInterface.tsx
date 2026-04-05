'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Play, Pause, Square, Timer, Route, Gauge, Mountain,
  Activity, Save, AlertCircle, Volume2, VolumeX,
  Lock, Unlock, Flag, MapPin,
} from 'lucide-react';
import StatCard from './StatCard';
import DynamicMap from './DynamicMap';
import useGPS from '@/hooks/useGPS';
import useActivityStats from '@/hooks/useActivityStats';
import { useToast } from '@/components/ui/Toast';
import { useWakeLock } from '@/hooks/useWakeLock';
import { useSelectedCircuit } from '@/hooks/useSelectedCircuit';
import { useAudioCues } from '@/hooks/useAudioCues';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { formatDuration, formatDistance, formatPace, formatSpeed, generateActivityName } from '@/lib/utils';
import type { Activity as ActivityType } from '@/types';

const STORAGE_KEY = 'runtrack_pending_activity';
const TRACKING_FLAG = 'runtrack_is_tracking';

// ── GPS quality ────────────────────────────────────────────────────────────────
function gpsQuality(accuracy: number | null): 'good' | 'fair' | 'poor' | 'unknown' {
  if (accuracy === null) return 'unknown';
  if (accuracy <= 10) return 'good';
  if (accuracy <= 25) return 'fair';
  return 'poor';
}
const GPS_COLORS = { good: '#22c55e', fair: '#eab308', poor: '#ef4444', unknown: '#9ca3af' };

// ── Hold-to-stop button ────────────────────────────────────────────────────────
function HoldToStop({ onStop, disabled }: { onStop: () => void; disabled: boolean }) {
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef(false);

  const start = useCallback((e: React.PointerEvent) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    startedRef.current = true;
    setProgress(0);
    const t0 = Date.now();
    intervalRef.current = setInterval(() => {
      const p = Math.min(100, ((Date.now() - t0) / 1500) * 100);
      setProgress(p);
      if (p >= 100) {
        clearInterval(intervalRef.current!);
        startedRef.current = false;
        onStop();
      }
    }, 30);
  }, [disabled, onStop]);

  const cancel = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    startedRef.current = false;
    setProgress(0);
  }, []);

  return (
    <button
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      disabled={disabled}
      className="relative flex-1 flex flex-col items-center justify-center gap-1 h-20 rounded-2xl bg-red-500 text-white disabled:opacity-50 overflow-hidden select-none touch-none"
    >
      {/* Fill progress bar */}
      <div
        className="absolute inset-0 bg-red-700 transition-none origin-left"
        style={{ transform: `scaleX(${progress / 100})` }}
      />
      <Square className="w-8 h-8 relative z-10" />
      <span className="text-sm font-semibold relative z-10">
        {progress > 5 ? 'Tenir...' : 'Arrêter'}
      </span>
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function TrackerInterface() {
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [pausedTime, setPausedTime] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [duration, setDuration] = useState(0);
  const [laps, setLaps] = useState<number[]>([]);
  const [isLockMode, setIsLockMode] = useState(false);

  const pauseStartRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { showToast } = useToast();
  const { requestLock, releaseLock } = useWakeLock();
  const { isEnabled: audioEnabled, toggleEnabled: toggleAudio, warmUp, checkDistance, reset: resetAudio } = useAudioCues();
  const { currentPosition, points, error: gpsError, isWatching, startWatching, stopWatching, clearPoints } = useGPS();
  const stats = useActivityStats(points, { startTime, pausedTime });
  const { circuit, circuitCoords, remainingDistance, clearCircuit } = useSelectedCircuit(
    isTracking ? currentPosition : null
  );

  // ── Swipe left=pause, right=resume ──────────────────────────────────────────
  const handleSwipePause = useCallback(() => { if (isTracking && !isPaused) handlePause(); }, [isTracking, isPaused]);
  const handleSwipeResume = useCallback(() => { if (isTracking && isPaused) handlePause(); }, [isTracking, isPaused]);
  const swipe = useSwipeGesture(handleSwipePause, handleSwipeResume);

  // ── Duration timer ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (isTracking && !isPaused && startTime) {
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTime - pausedTime) / 1000));
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isTracking, isPaused, startTime, pausedTime]);

  // ── Audio km cues ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (isTracking && !isPaused) checkDistance(stats.distance);
  }, [stats.distance, isTracking, isPaused, checkDistance]);

  // ── Broadcast tracking state to Navigation ─────────────────────────────────
  useEffect(() => {
    if (isTracking) {
      localStorage.setItem(TRACKING_FLAG, 'true');
    } else {
      localStorage.removeItem(TRACKING_FLAG);
    }
    window.dispatchEvent(new Event('trackingStateChange'));
  }, [isTracking]);

  // ── Auto-save pending activity ─────────────────────────────────────────────
  useEffect(() => {
    if (isTracking && points.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ points, startTime, pausedTime, savedAt: Date.now() }));
    }
  }, [isTracking, points, startTime, pausedTime]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleStart = useCallback(() => {
    warmUp(); // iOS Speech API warm-up (must be in user-gesture context)
    requestLock();
    setIsTracking(true);
    setIsPaused(false);
    setStartTime(Date.now());
    setPausedTime(0);
    setDuration(0);
    setLaps([]);
    clearPoints();
    startWatching();
    showToast('Course démarrée', 'success');
    resetAudio();
  }, [clearPoints, startWatching, showToast, requestLock, warmUp, resetAudio]);

  function handlePause() {
    if (isPaused) {
      if (pauseStartRef.current) {
        setPausedTime((prev) => prev + (Date.now() - pauseStartRef.current!));
        pauseStartRef.current = null;
      }
      setIsPaused(false);
      startWatching();
      showToast('Course reprise', 'info');
    } else {
      pauseStartRef.current = Date.now();
      setIsPaused(true);
      stopWatching();
      showToast('Course en pause', 'info');
    }
  }

  const handleStop = useCallback(async () => {
    releaseLock();
    stopWatching();
    setIsLockMode(false);

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
      userId: 'anonymous',
      name: generateActivityName(),
      startTime: new Date(startTime!),
      endTime: new Date(),
      points,
      stats: { ...stats, duration },
    };

    try {
      const response = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activity),
      });
      if (!response.ok) throw new Error('Failed to save activity');
      localStorage.removeItem(STORAGE_KEY);
      showToast('Course enregistrée avec succès !', 'success');
    } catch {
      const pending = JSON.parse(localStorage.getItem('runtrack_offline_activities') || '[]');
      pending.push(activity);
      localStorage.setItem('runtrack_offline_activities', JSON.stringify(pending));
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
  }, [stopWatching, points, startTime, stats, duration, clearPoints, showToast, releaseLock]);

  const handleLap = useCallback(() => {
    setLaps((prev) => [...prev, stats.distance]);
    showToast(`Tour ${laps.length + 1} — ${formatDistance(stats.distance)}`, 'info');
  }, [stats.distance, laps.length, showToast]);

  // ── Derived values ─────────────────────────────────────────────────────────
  const quality = gpsQuality(currentPosition?.accuracy ?? null);
  const lastLapDistance = laps.length > 0 ? stats.distance - laps[laps.length - 1] : null;
  const displayPace = stats.currentPace > 0 ? stats.currentPace : stats.avgPace;
  const displaySpeed = stats.currentSpeed > 0 ? stats.currentSpeed : stats.avgSpeed;

  // ── Lock mode (big stats, map hidden) ──────────────────────────────────────
  if (isLockMode && isTracking) {
    return (
      <div className="fixed inset-0 bg-gray-950 flex flex-col items-center justify-center gap-6 px-6">
        <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
          <div className="col-span-2 text-center">
            <div className="text-6xl font-bold text-white tabular-nums">{formatDuration(duration)}</div>
            <div className="text-gray-400 text-sm mt-1">Durée</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-blue-400 tabular-nums">{formatDistance(stats.distance)}</div>
            <div className="text-gray-400 text-sm mt-1">Distance</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-green-400 tabular-nums">{formatPace(displayPace)}</div>
            <div className="text-gray-400 text-sm mt-1">Allure</div>
          </div>
        </div>

        {/* GPS dot */}
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ background: GPS_COLORS[quality] }} />
          <span className="text-gray-400 text-sm">GPS {currentPosition?.accuracy?.toFixed(0) ?? '?'}m</span>
        </div>

        <div className="flex gap-4 mt-4">
          <button
            onClick={() => setIsLockMode(false)}
            className="flex items-center gap-2 px-6 py-3 bg-gray-800 text-white rounded-2xl text-sm font-medium"
          >
            <Unlock className="w-4 h-4" /> Déverrouiller
          </button>
          <button
            onClick={() => handlePause()}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-medium ${isPaused ? 'bg-green-600 text-white' : 'bg-yellow-500 text-white'}`}
          >
            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            {isPaused ? 'Reprendre' : 'Pause'}
          </button>
        </div>
      </div>
    );
  }

  // ── Normal view ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Map */}
      <div className="relative cursor-pointer" onClick={() => isTracking && setIsLockMode(true)}>
        <DynamicMap
          points={points}
          currentPosition={currentPosition}
          isTracking={isTracking && !isPaused}
          height="38vh"
          showSpeedGradient={true}
          circuitCoords={circuitCoords}
        />
        {isTracking && (
          <div className="absolute top-2 left-2 bg-black/50 text-white rounded-lg px-2 py-1 text-xs flex items-center gap-1 z-[1000]">
            <Lock className="w-3 h-3" /> Tap pour verrouiller
          </div>
        )}
      </div>

      {/* Circuit banner */}
      {circuit && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl">
          <Route className="w-4 h-4 text-indigo-500 flex-none" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">{circuit.label}</span>
            {isTracking && (
              <span className="text-xs text-indigo-500 ml-2">Restant : {formatDistance(remainingDistance)}</span>
            )}
          </div>
          <button onClick={clearCircuit} className="text-indigo-400 hover:text-indigo-600 text-lg leading-none">×</button>
        </div>
      )}

      {/* GPS Error */}
      {gpsError && (
        <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <AlertCircle className="w-5 h-5 text-red-500 flex-none" />
          <p className="text-sm text-red-700 dark:text-red-300">{gpsError}</p>
        </div>
      )}

      {/* Stats Grid */}
      <div
        className="grid grid-cols-2 gap-3 px-1"
        {...(isTracking ? swipe : {})}
      >
        <StatCard icon={<Timer className="w-5 h-5" />} label="Durée" value={formatDuration(duration)} variant="highlight" large={isTracking} />
        <StatCard icon={<Route className="w-5 h-5" />} label="Distance" value={formatDistance(stats.distance)} variant="primary" large={isTracking} />
        <StatCard
          icon={<Activity className="w-5 h-5" />}
          label="Allure"
          value={formatPace(displayPace)}
          subValue={`Moy: ${formatPace(stats.avgPace)}/km`}
          large={isTracking}
        />
        <StatCard
          icon={<Gauge className="w-5 h-5" />}
          label="Vitesse"
          value={formatSpeed(displaySpeed)}
          subValue={`Max: ${formatSpeed(stats.maxSpeed)}`}
          large={isTracking}
        />
        {!isTracking && (
          <>
            <StatCard icon={<Mountain className="w-5 h-5" />} label="Dénivelé +" value={`${Math.round(stats.elevationGain)} m`} />
            <StatCard
              icon={<MapPin className="w-5 h-5" />}
              label="GPS"
              value={currentPosition ? `${currentPosition.accuracy.toFixed(0)} m` : '—'}
              subValue={currentPosition ? `${points.length} points` : undefined}
            />
          </>
        )}
      </div>

      {/* Controls */}
      <div className="px-1">
        {!isTracking ? (
          /* Pre-start: big centered START button */
          <div className="flex justify-center py-4">
            <button
              onClick={handleStart}
              className="w-40 h-40 rounded-full bg-green-500 text-white flex flex-col items-center justify-center gap-2 shadow-xl active:scale-95 transition-transform"
            >
              <Play className="w-14 h-14" />
              <span className="text-lg font-bold">Démarrer</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* PAUSE + STOP row */}
            <div className="flex gap-3">
              <button
                onClick={handlePause}
                disabled={isSaving}
                className={`flex-1 flex flex-col items-center justify-center gap-1 h-20 rounded-2xl text-white font-semibold disabled:opacity-50 active:scale-95 transition-transform ${isPaused ? 'bg-green-500' : 'bg-yellow-500'}`}
              >
                {isPaused ? <Play className="w-8 h-8" /> : <Pause className="w-8 h-8" />}
                <span className="text-sm">{isPaused ? 'Reprendre' : 'Pause'}</span>
              </button>

              <HoldToStop onStop={handleStop} disabled={isSaving} />
            </div>

            {/* LAP + status row */}
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={handleLap}
                className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium active:scale-95 transition-transform"
              >
                <Flag className="w-4 h-4" />
                Tour {laps.length + 1}
                {lastLapDistance !== null && (
                  <span className="text-gray-500 text-xs">({formatDistance(lastLapDistance)})</span>
                )}
              </button>

              {/* GPS quality + status */}
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: GPS_COLORS[quality] }} />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {isPaused ? 'Pause' : isWatching ? `GPS ${currentPosition?.accuracy?.toFixed(0) ?? '?'}m` : 'Attente GPS...'}
                </span>

                {/* Audio toggle */}
                <button
                  onClick={toggleAudio}
                  className="ml-1 p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800"
                  title={audioEnabled ? 'Désactiver annonces vocales' : 'Activer annonces vocales'}
                >
                  {audioEnabled ? <Volume2 className="w-4 h-4 text-blue-500" /> : <VolumeX className="w-4 h-4 text-gray-400" />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pre-tracking info when GPS waiting */}
      {!isTracking && (
        <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400 pb-2">
          <div className="w-2 h-2 rounded-full" style={{ background: GPS_COLORS[quality] }} />
          <span>
            {currentPosition
              ? `GPS prêt — précision ${currentPosition.accuracy.toFixed(0)} m`
              : 'En attente du signal GPS...'}
          </span>
        </div>
      )}
    </div>
  );
}

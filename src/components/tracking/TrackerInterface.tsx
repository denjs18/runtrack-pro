'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Play, Pause, Square, MapIcon, BarChart2,
  Save, AlertCircle, Volume2, VolumeX,
  Flag, ChevronUp, ChevronDown, Navigation2, Route,
} from 'lucide-react';
import DynamicMap from './DynamicMap';
import useGPS from '@/hooks/useGPS';
import useActivityStats from '@/hooks/useActivityStats';
import { useToast } from '@/components/ui/Toast';
import { useWakeLock } from '@/hooks/useWakeLock';
import { useSelectedCircuit } from '@/hooks/useSelectedCircuit';
import { useAudioCues } from '@/hooks/useAudioCues';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { formatDuration, formatPace, formatDistance, generateActivityName } from '@/lib/utils';
import type { Activity as ActivityType } from '@/types';

const STORAGE_KEY = 'runtrack_pending_activity';
const TRACKING_FLAG = 'runtrack_is_tracking';

// ── GPS quality ───────────────────────────────────────────────────────────────
function gpsQuality(accuracy: number | null) {
  if (accuracy === null) return { label: 'Recherche GPS...', color: '#9ca3af', ok: false };
  if (accuracy <= 15) return { label: 'Signal GPS trouvé', color: '#22c55e', ok: true };
  if (accuracy <= 30) return { label: `GPS correct (±${Math.round(accuracy)}m)`, color: '#eab308', ok: true };
  return { label: `Signal GPS faible (±${Math.round(accuracy)}m)`, color: '#f97316', ok: false };
}

// ── Hold-to-stop ──────────────────────────────────────────────────────────────
function HoldToStop({ onStop, disabled }: { onStop: () => void; disabled: boolean }) {
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback((e: React.PointerEvent) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const t0 = Date.now();
    intervalRef.current = setInterval(() => {
      const p = Math.min(100, ((Date.now() - t0) / 1500) * 100);
      setProgress(p);
      if (p >= 100) { clearInterval(intervalRef.current!); onStop(); }
    }, 30);
  }, [disabled, onStop]);

  const cancel = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setProgress(0);
  }, []);

  return (
    <button
      onPointerDown={start} onPointerUp={cancel} onPointerCancel={cancel}
      disabled={disabled}
      className="relative w-14 h-14 rounded-full bg-red-500 text-white flex items-center justify-center overflow-hidden select-none touch-none disabled:opacity-40 flex-shrink-0"
    >
      <div className="absolute inset-0 bg-red-700 origin-left transition-none" style={{ transform: `scaleX(${progress / 100})` }} />
      <Square className="w-5 h-5 relative z-10" />
    </button>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function TrackerInterface() {
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [pausedTime, setPausedTime] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [duration, setDuration] = useState(0);
  const [laps, setLaps] = useState<number[]>([]);
  const [viewMode, setViewMode] = useState<'stats' | 'map'>('stats');

  const pauseStartRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { showToast } = useToast();
  const { requestLock, releaseLock } = useWakeLock();
  const { isEnabled: audioEnabled, toggleEnabled: toggleAudio, warmUp, checkDistance, reset: resetAudio } = useAudioCues();
  const { currentPosition, points, error: gpsError, isWatching, startWatching, stopWatching, clearPoints } = useGPS();
  const stats = useActivityStats(points, { startTime, pausedTime });
  const { circuit, circuitCoords, remainingDistance, clearCircuit } = useSelectedCircuit(isTracking ? currentPosition : null);

  const swipePause = useCallback(() => { if (!isPaused) handlePause(); }, [isPaused]);
  const swipeResume = useCallback(() => { if (isPaused) handlePause(); }, [isPaused]);
  const swipe = useSwipeGesture(swipePause, swipeResume);

  // Timer
  useEffect(() => {
    if (isTracking && !isPaused && startTime) {
      timerRef.current = setInterval(() => setDuration(Math.floor((Date.now() - startTime - pausedTime) / 1000)), 1000);
    } else if (timerRef.current) clearInterval(timerRef.current);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isTracking, isPaused, startTime, pausedTime]);

  // Audio km cues
  useEffect(() => {
    if (isTracking && !isPaused) checkDistance(stats.distance);
  }, [stats.distance, isTracking, isPaused, checkDistance]);

  // Broadcast tracking state
  useEffect(() => {
    if (isTracking) localStorage.setItem(TRACKING_FLAG, 'true');
    else localStorage.removeItem(TRACKING_FLAG);
    window.dispatchEvent(new Event('trackingStateChange'));
  }, [isTracking]);

  // Auto-save
  useEffect(() => {
    if (isTracking && points.length > 0)
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ points, startTime, pausedTime, savedAt: Date.now() }));
  }, [isTracking, points, startTime, pausedTime]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleStart = useCallback(() => {
    warmUp();
    requestLock();
    setIsTracking(true);
    setIsPaused(false);
    setStartTime(Date.now());
    setPausedTime(0);
    setDuration(0);
    setLaps([]);
    setViewMode('stats');
    clearPoints();
    startWatching();
    resetAudio();
    showToast('Course démarrée', 'success');
  }, [clearPoints, startWatching, showToast, requestLock, warmUp, resetAudio]);

  function handlePause() {
    if (isPaused) {
      if (pauseStartRef.current) { setPausedTime(p => p + Date.now() - pauseStartRef.current!); pauseStartRef.current = null; }
      setIsPaused(false); startWatching(); showToast('Course reprise', 'info');
    } else {
      pauseStartRef.current = Date.now(); setIsPaused(true); stopWatching(); showToast('Pause', 'info');
    }
  }

  const handleStop = useCallback(async () => {
    releaseLock(); stopWatching();
    if (points.length < 2) {
      showToast('Course trop courte', 'warning');
      setIsTracking(false); setStartTime(null); clearPoints(); localStorage.removeItem(STORAGE_KEY);
      return;
    }
    setIsSaving(true);
    const activity: Partial<ActivityType> = {
      userId: 'anonymous', name: generateActivityName(),
      startTime: new Date(startTime!), endTime: new Date(),
      points, stats: { ...stats, duration },
    };
    try {
      const r = await fetch('/api/activities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(activity) });
      if (!r.ok) throw new Error();
      localStorage.removeItem(STORAGE_KEY);
      showToast('Course enregistrée !', 'success');
    } catch {
      const pending = JSON.parse(localStorage.getItem('runtrack_offline_activities') || '[]');
      pending.push(activity);
      localStorage.setItem('runtrack_offline_activities', JSON.stringify(pending));
      showToast('Sauvegardée localement', 'warning');
    } finally {
      setIsSaving(false); setIsTracking(false); setIsPaused(false);
      setStartTime(null); setPausedTime(0); setDuration(0); clearPoints();
    }
  }, [stopWatching, points, startTime, stats, duration, clearPoints, showToast, releaseLock]);

  const handleLap = useCallback(() => {
    setLaps(prev => [...prev, stats.distance]);
    showToast(`Tour ${laps.length + 1} — ${formatDistance(stats.distance)}`, 'info');
  }, [stats.distance, laps.length, showToast]);

  // ── Derived ──────────────────────────────────────────────────────────────
  const gps = gpsQuality(currentPosition?.accuracy ?? null);
  const distanceKm = (stats.distance / 1000).toFixed(2).replace('.', ',');
  const displayPace = stats.currentPace > 0 ? stats.currentPace : stats.avgPace;
  const lastLapDist = laps.length > 0 ? stats.distance - laps[laps.length - 1] : null;

  // ═══════════════════════════════════════════════════════════════════════════
  // DURING TRACKING — STATS MODE (full-screen white, like Komoot)
  // ═══════════════════════════════════════════════════════════════════════════
  if (isTracking && viewMode === 'stats') {
    return (
      <div className="fixed inset-0 bg-white dark:bg-gray-950 flex flex-col" {...swipe}>
        {/* Timer row */}
        <div className="flex items-center justify-between px-6 pt-10 pb-2">
          <span className="text-4xl font-black tabular-nums text-gray-900 dark:text-white tracking-tight">
            {formatDuration(duration)}
          </span>
          <button
            onClick={() => setViewMode('map')}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800"
          >
            <MapIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Distance — hero stat */}
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <span className="text-8xl font-black tabular-nums text-gray-900 dark:text-white leading-none">
            {distanceKm}
          </span>
          <span className="text-gray-400 text-base mt-2">Distance (km)</span>
        </div>

        {/* Secondary stats */}
        <div className="px-8 pb-6 grid grid-cols-2 gap-6 text-center">
          <div>
            <p className="text-4xl font-bold text-gray-900 dark:text-white tabular-nums">{Math.round(stats.elevationGain)}</p>
            <p className="text-gray-400 text-sm mt-1">Dénivelé positif (m)</p>
          </div>
          <div>
            <p className="text-4xl font-bold text-gray-900 dark:text-white tabular-nums">
              {displayPace > 0 ? formatPace(displayPace) : '--:--'}
            </p>
            <p className="text-gray-400 text-sm mt-1">Allure moy. (/km)</p>
          </div>
          {laps.length > 0 && lastLapDist !== null && (
            <div className="col-span-2">
              <p className="text-2xl font-bold text-orange-500 tabular-nums">{formatDistance(lastLapDist)}</p>
              <p className="text-gray-400 text-sm mt-1">Dernier tour</p>
            </div>
          )}
        </div>

        {/* GPS + audio strip */}
        <div className="flex items-center justify-between px-6 py-2 border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: gps.color }} />
            <span className="text-xs text-gray-400">{isPaused ? 'En pause' : gps.label}</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleLap} className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-full">
              <Flag className="w-3.5 h-3.5" /> Tour {laps.length + 1}
            </button>
            <button onClick={toggleAudio} className="p-1.5 rounded-full bg-gray-100 dark:bg-gray-800">
              {audioEnabled ? <Volume2 className="w-4 h-4 text-orange-500" /> : <VolumeX className="w-4 h-4 text-gray-400" />}
            </button>
          </div>
        </div>

        {/* Circuit banner */}
        {circuit && (
          <div className="mx-4 mb-2 flex items-center gap-2 px-3 py-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
            <Route className="w-4 h-4 text-indigo-500 flex-none" />
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex-1">{circuit.label}</span>
            <span className="text-xs text-indigo-400">Restant : {formatDistance(remainingDistance)}</span>
            <button onClick={clearCircuit} className="text-indigo-300 text-base leading-none">×</button>
          </div>
        )}

        {/* Pause button — full width orange pill */}
        <div className="px-4 pb-6">
          <div className="flex gap-3 items-center">
            <button
              onClick={handlePause}
              className={`flex-1 flex items-center justify-center gap-3 py-5 rounded-full text-white text-lg font-bold transition-colors ${isPaused ? 'bg-green-500' : 'bg-orange-500'}`}
            >
              {isPaused ? <Play className="w-6 h-6 fill-white" /> : <Pause className="w-6 h-6 fill-white" />}
              {isPaused ? 'Reprendre' : 'Pause'}
            </button>
            <HoldToStop onStop={handleStop} disabled={isSaving} />
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DURING TRACKING — MAP MODE
  // ═══════════════════════════════════════════════════════════════════════════
  if (isTracking && viewMode === 'map') {
    return (
      <div className="fixed inset-0 flex flex-col">
        {/* Map */}
        <div className="flex-1 relative">
          <DynamicMap
            points={points} currentPosition={currentPosition}
            isTracking={!isPaused} height="100%" showSpeedGradient
            circuitCoords={circuitCoords}
          />
          {/* Duration overlay */}
          <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm text-white rounded-full px-4 py-2 text-sm font-bold tabular-nums z-[1000]">
            {formatDuration(duration)}
          </div>
          {/* Toggle to stats */}
          <button
            onClick={() => setViewMode('stats')}
            className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-full px-3 py-2 flex items-center gap-1.5 text-sm font-medium text-gray-700 z-[1000] shadow"
          >
            <BarChart2 className="w-4 h-4" /> Stats
          </button>
        </div>

        {/* Slim stat strip */}
        <div className="bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 px-6 py-3 flex justify-around">
          <div className="text-center">
            <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">{distanceKm}</p>
            <p className="text-xs text-gray-400">km</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">{displayPace > 0 ? formatPace(displayPace) : '--:--'}</p>
            <p className="text-xs text-gray-400">allure</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">{Math.round(stats.elevationGain)}</p>
            <p className="text-xs text-gray-400">m D+</p>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white dark:bg-gray-900 px-4 pb-6 pt-2 flex gap-3 items-center">
          <button onClick={handleLap} className="flex items-center gap-1.5 px-4 py-3 bg-gray-100 dark:bg-gray-800 rounded-full text-sm font-medium text-gray-700 dark:text-gray-300">
            <Flag className="w-4 h-4" /> Tour
          </button>
          <button
            onClick={handlePause}
            className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-full text-white font-bold ${isPaused ? 'bg-green-500' : 'bg-orange-500'}`}
          >
            {isPaused ? <Play className="w-5 h-5 fill-white" /> : <Pause className="w-5 h-5 fill-white" />}
            {isPaused ? 'Reprendre' : 'Pause'}
          </button>
          <HoldToStop onStop={handleStop} disabled={isSaving} />
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRE-TRACKING — Map-first with bottom panel (like Komoot screen 1)
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="fixed inset-0 flex flex-col">
      {/* Map */}
      <div className="flex-1 relative min-h-0">
        <DynamicMap
          points={[]} currentPosition={currentPosition}
          isTracking={false} height="100%"
          circuitCoords={circuitCoords}
        />
        {/* Circuit label overlay */}
        {circuit && (
          <div className="absolute top-4 left-4 right-4 flex items-center gap-2 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-xl px-3 py-2 shadow z-[1000]">
            <Route className="w-4 h-4 text-indigo-500 flex-none" />
            <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300 flex-1 truncate">{circuit.label} · {formatDistance(circuit.distance)}</span>
            <button onClick={clearCircuit} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
          </div>
        )}
      </div>

      {/* Bottom panel */}
      <div className="bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl flex-shrink-0">
        {/* GPS status banner */}
        <div
          className="mx-4 mt-4 mb-3 rounded-2xl px-4 py-3 flex items-center justify-between"
          style={{ background: `${gps.color}18` }}
        >
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: gps.color }} />
            <span className="text-sm font-semibold" style={{ color: gps.color }}>{gps.label}</span>
          </div>
          <Navigation2 className="w-4 h-4" style={{ color: gps.color }} />
        </div>

        {/* GPS error */}
        {gpsError && (
          <div className="mx-4 mb-3 flex items-center gap-2 px-3 py-2.5 bg-red-50 dark:bg-red-900/20 rounded-xl">
            <AlertCircle className="w-4 h-4 text-red-500 flex-none" />
            <p className="text-xs text-red-600 dark:text-red-400">{gpsError}</p>
          </div>
        )}

        {/* Stats row */}
        <div className="flex justify-around px-4 py-2 border-b border-gray-100 dark:border-gray-800">
          <div className="text-center">
            <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">00:00</p>
            <p className="text-xs text-gray-400 mt-0.5">Temps</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">0,00</p>
            <p className="text-xs text-gray-400 mt-0.5">Distance (km)</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">0</p>
            <p className="text-xs text-gray-400 mt-0.5">Déniv. positif (m)</p>
          </div>
        </div>

        {/* Controls row — pb-24 clears the fixed nav bar (80px) */}
        <div className="flex items-center justify-around px-6 py-4 pb-24">
          {/* Audio toggle (left slot) */}
          <button
            onClick={toggleAudio}
            className="flex flex-col items-center gap-1 w-16"
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${audioEnabled ? 'bg-orange-100' : 'bg-gray-100'}`}>
              {audioEnabled
                ? <Volume2 className="w-5 h-5 text-orange-500" />
                : <VolumeX className="w-5 h-5 text-gray-400" />}
            </div>
            <span className="text-xs text-gray-500">{audioEnabled ? 'Audio ON' : 'Audio OFF'}</span>
          </button>

          {/* START button — large orange circle */}
          <button
            onClick={handleStart}
            className="w-20 h-20 rounded-full bg-orange-500 text-white flex flex-col items-center justify-center shadow-xl active:scale-95 transition-transform"
          >
            <Play className="w-9 h-9 fill-white" />
            <span className="text-xs font-bold mt-0.5">Démarrer</span>
          </button>

          {/* Circuit button (right slot) */}
          <button
            onClick={() => window.location.href = '/route-finder'}
            className="flex flex-col items-center gap-1 w-16"
          >
            <div className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 relative">
              <Route className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              {circuit && <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-indigo-500 rounded-full" />}
            </div>
            <span className="text-xs text-gray-500">{circuit ? 'Circuit ✓' : 'Itinéraire'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

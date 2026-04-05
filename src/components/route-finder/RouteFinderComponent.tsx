'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2, Navigation, RefreshCw, Route, Filter,
  Play, Square, ChevronUp, ChevronDown, X,
} from 'lucide-react';
import type { OsmPath, GeneratedRoute } from './types';
import { fetchRunningPaths, generateMultipleRoutes } from './routeUtils';
import { saveCircuit } from '@/hooks/useSelectedCircuit';

const RouteFinderMap = dynamic(() => import('./RouteFinderMap'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-800">
      <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
    </div>
  ),
});

const DISTANCE_OPTIONS = [
  { label: '3 km',  value: 3 },
  { label: '5 km',  value: 5 },
  { label: '8 km',  value: 8 },
  { label: '10 km', value: 10 },
  { label: '15 km', value: 15 },
];

const RADIUS_OPTIONS = [
  { label: '1 km', value: 1000 },
  { label: '2 km', value: 2000 },
  { label: '5 km', value: 5000 },
  { label: '10 km', value: 10000 },
];

// Must match ROUTE_COLORS in RouteFinderMap.tsx
const ROUTE_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#06b6d4', '#8b5cf6'];

function formatDistance(meters: number) {
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${m.toString().padStart(2, '0')}`;
  return `${m} min`;
}

function distanceDeviation(actual: number, targetKm: number) {
  return Math.round(((actual / 1000 - targetKm) / targetKm) * 100);
}

export default function RouteFinderComponent() {
  const [userPosition, setUserPosition]     = useState<[number, number] | null>(null);
  const [mapCenter, setMapCenter]           = useState<[number, number] | null>(null);
  const [paths, setPaths]                   = useState<OsmPath[]>([]);
  const [routes, setRoutes]                 = useState<GeneratedRoute[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [isLoadingPaths, setIsLoadingPaths] = useState(false);
  const [isGenerating, setIsGenerating]     = useState(false);
  const [genProgress, setGenProgress]       = useState({ done: 0, total: 0 });
  const [isLocating, setIsLocating]         = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [searchRadius, setSearchRadius]     = useState(2000);
  const [selectedDistance, setSelectedDistance] = useState(5);
  const [runningOnly, setRunningOnly]       = useState(true);
  const [shouldCenter, setShouldCenter]     = useState(false);
  const [sheetOpen, setSheetOpen]           = useState(false);
  const [showFilters, setShowFilters]       = useState(false);
  const [animProgress, setAnimProgress]     = useState(0); // 0-1
  const [isAnimating, setIsAnimating]       = useState(false);

  const lastFetchRef  = useRef<{ lat: number; lng: number; radius: number; runningOnly: boolean } | null>(null);
  const animFrameRef  = useRef<number | null>(null);
  const animStartRef  = useRef<number>(0);

  const locateUser = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Géolocalisation non supportée par votre navigateur.');
      return;
    }
    setIsLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const position: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserPosition(position);
        setMapCenter(position);
        setShouldCenter(true);
        setIsLocating(false);
      },
      (err) => {
        setError(
          err.code === 1
            ? 'Accès à la position refusé. Vérifiez les permissions.'
            : "Impossible d'obtenir votre position."
        );
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }, []);

  // Auto-locate on mount
  useEffect(() => { locateUser(); }, [locateUser]);

  const loadPaths = useCallback(async () => {
    const center = mapCenter ?? userPosition;
    if (!center) { setError("Localisez-vous d'abord."); return; }
    const [lat, lng] = center;

    const last = lastFetchRef.current;
    if (
      last &&
      Math.abs(last.lat - lat) < 0.0005 &&
      Math.abs(last.lng - lng) < 0.0005 &&
      last.radius === searchRadius &&
      last.runningOnly === runningOnly
    ) return;

    setIsLoadingPaths(true);
    setError(null);
    try {
      const result = await fetchRunningPaths(lat, lng, searchRadius, runningOnly);
      setPaths(result);
      setRoutes([]);
      setSelectedRouteId(null);
      lastFetchRef.current = { lat, lng, radius: searchRadius, runningOnly };
    } catch (e) {
      setError((e as Error).message || 'Erreur lors du chargement des chemins. Réessayez.');
    } finally {
      setIsLoadingPaths(false);
    }
  }, [mapCenter, userPosition, searchRadius, runningOnly]);

  const handleGenerateRoutes = useCallback(async () => {
    if (!userPosition) { setError("Localisez-vous d'abord."); return; }
    setIsGenerating(true);
    setError(null);
    setRoutes([]);
    setSelectedRouteId(null);
    setGenProgress({ done: 0, total: 5 });
    setSheetOpen(true);
    try {
      const generated = await generateMultipleRoutes(
        userPosition[0], userPosition[1], selectedDistance,
        (done, total) => setGenProgress({ done, total })
      );
      if (!generated.length) throw new Error('Aucun circuit trouvé.');
      setRoutes(generated);
      setSelectedRouteId(generated[0].id);
    } catch (e) {
      setError((e as Error).message || 'Impossible de générer les circuits. Essayez une autre distance.');
    } finally {
      setIsGenerating(false);
    }
  }, [userPosition, selectedDistance]);

  const selectedRoute = routes.find((r) => r.id === selectedRouteId) ?? null;
  const router = useRouter();

  // ── Animation ───────────────────────────────────────────────────────────────

  const stopAnimation = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setIsAnimating(false);
    setAnimProgress(0);
  }, []);

  const handlePreview = useCallback((route: GeneratedRoute) => {
    // Select + close sheet first
    setSelectedRouteId(route.id);
    setSheetOpen(false);
    // Stop any previous animation
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    // 25 s animation for any route length
    const DURATION = 25000;
    animStartRef.current = performance.now();
    setAnimProgress(0);
    setIsAnimating(true);

    const tick = (now: number) => {
      const progress = Math.min((now - animStartRef.current) / DURATION, 1);
      setAnimProgress(progress);
      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(tick);
      } else {
        setIsAnimating(false);
      }
    };
    animFrameRef.current = requestAnimationFrame(tick);
  }, []);

  // Clean up on unmount
  useEffect(() => () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); }, []);

  const handleRunCircuit = useCallback(() => {
    if (!selectedRoute) return;
    saveCircuit({
      id: selectedRoute.id,
      coords: selectedRoute.coords,
      distance: selectedRoute.distance,
      duration: selectedRoute.duration,
      label: selectedRoute.label,
    });
    router.push('/');
  }, [selectedRoute, router]);

  return (
    <div className="relative h-full overflow-hidden">
      {/* ── Full-screen map ── */}
      <div className="absolute inset-0">
        <RouteFinderMap
          userPosition={userPosition}
          paths={paths}
          routes={routes}
          selectedRouteId={selectedRouteId}
          searchRadius={searchRadius}
          shouldCenter={shouldCenter}
          onCentered={() => setShouldCenter(false)}
          onMapMoved={(lat, lng) => setMapCenter([lat, lng])}
          animProgress={isAnimating ? animProgress : null}
        />
      </div>

      {/* ── Top bar: distance chips + actions ── */}
      {/* top offset: safe-area-inset-top (status bar) + 8px breathing room */}
      <div
        className="absolute left-0 right-0 px-3 z-[1000] flex flex-col gap-2 pointer-events-none"
        style={{ top: 'calc(env(safe-area-inset-top) + 8px)' }}
      >
        {/* Row 1: action buttons right-aligned */}
        <div className="flex justify-end gap-2 pointer-events-auto">
          {/* Locate me */}
          <button
            onClick={locateUser}
            disabled={isLocating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow bg-white/95 text-orange-500 dark:bg-gray-800/95 disabled:opacity-50 active:scale-95 text-xs font-semibold"
          >
            {isLocating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
            {isLocating ? 'GPS…' : 'Localiser'}
          </button>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full shadow transition-colors pointer-events-auto text-xs font-semibold ${
              showFilters ? 'bg-orange-500 text-white' : 'bg-white/95 text-gray-600 dark:bg-gray-800/95 dark:text-gray-300'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Filtres
          </button>
        </div>

        {/* Row 2: distance chips — full width, scrollable */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pointer-events-auto pb-0.5">
          {DISTANCE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSelectedDistance(opt.value)}
              className={`flex-none px-4 py-2 rounded-full text-sm font-semibold shadow transition-colors ${
                selectedDistance === opt.value
                  ? 'bg-orange-500 text-white shadow-orange-200'
                  : 'bg-white/95 text-gray-700 dark:bg-gray-800/95 dark:text-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Expanded filter panel */}
        {showFilters && (
          <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm rounded-2xl px-4 py-3 shadow-lg pointer-events-auto space-y-3">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Rayon de recherche</p>
              <div className="flex gap-2">
                {RADIUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSearchRadius(opt.value)}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                      searchRadius === opt.value
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setRunningOnly((v) => !v)}
                className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors ${
                  runningOnly
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                }`}
              >
                {runningOnly ? '✓ Chemins piétons uniquement' : 'Tous les chemins'}
              </button>
              <button
                onClick={loadPaths}
                disabled={isLoadingPaths}
                className="flex items-center gap-1.5 px-4 py-2 bg-green-500 text-white rounded-xl text-xs font-semibold disabled:opacity-50"
              >
                {isLoadingPaths ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Charger
              </button>
            </div>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-2 bg-red-50/95 border border-red-200 rounded-xl px-3 py-2.5 pointer-events-auto">
            <p className="text-xs text-red-600 flex-1">{error}</p>
            <button onClick={() => setError(null)}>
              <X className="w-3.5 h-3.5 text-red-400" />
            </button>
          </div>
        )}
      </div>

      {/* ── Bottom sheet ── */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl z-[1000] transition-all duration-300 ${
          sheetOpen ? 'translate-y-0' : 'translate-y-[calc(100%-90px)]'
        }`}
      >
        {/* Drag handle + header */}
        <button
          onClick={() => setSheetOpen((v) => !v)}
          className="w-full flex flex-col items-center pt-3 pb-2"
        >
          <div className="w-10 h-1 bg-gray-200 dark:bg-gray-700 rounded-full mb-3" />
          <div className="flex items-center justify-between w-full px-5">
            <div className="flex items-center gap-2">
              <Route className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                {routes.length > 0
                  ? `${routes.length} circuit${routes.length > 1 ? 's' : ''} · ${selectedDistance} km`
                  : isGenerating
                  ? 'Génération en cours...'
                  : 'Trouver un circuit'}
              </span>
            </div>
            {sheetOpen ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            )}
          </div>
        </button>

        {/* Sheet content */}
        <div className="px-4 pb-6 max-h-[60vh] overflow-y-auto">
          {/* Generate button when no routes */}
          {!isGenerating && routes.length === 0 && (
            <button
              onClick={handleGenerateRoutes}
              disabled={!userPosition}
              className="w-full py-4 bg-orange-500 text-white rounded-2xl text-base font-bold flex items-center justify-center gap-2 shadow-md active:scale-95 transition-transform disabled:opacity-40 mb-4"
            >
              <Route className="w-5 h-5" />
              Générer des circuits ({selectedDistance} km)
            </button>
          )}

          {!userPosition && routes.length === 0 && (
            <p className="text-center text-sm text-gray-400 pb-2">
              Utilisez le bouton <Navigation className="w-3.5 h-3.5 inline" /> pour vous localiser d&apos;abord
            </p>
          )}

          {/* Progress bar */}
          {isGenerating && (
            <div className="py-6 space-y-4">
              {/* Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Calcul des circuits {selectedDistance} km…</span>
                  <span className="font-semibold tabular-nums text-orange-500">
                    {genProgress.done}/{genProgress.total}
                  </span>
                </div>
                <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-orange-500 rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: genProgress.total > 0
                        ? `${(genProgress.done / genProgress.total) * 100}%`
                        : '0%',
                    }}
                  />
                </div>
              </div>
              {/* Individual step dots */}
              <div className="flex justify-center gap-2">
                {Array.from({ length: genProgress.total || 5 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      i < genProgress.done
                        ? 'bg-orange-500 scale-110'
                        : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs text-center text-gray-400">
                {genProgress.done === 0
                  ? 'Connexion au serveur de routage…'
                  : genProgress.done < (genProgress.total || 5)
                  ? `Circuit ${genProgress.done} calculé, encore ${(genProgress.total || 5) - genProgress.done}…`
                  : 'Tri des meilleurs circuits…'}
              </p>
            </div>
          )}

          {/* Route cards */}
          {routes.length > 0 && !isGenerating && (
            <div className="space-y-2 mt-1">
              <p className="text-xs text-gray-400 text-center pb-1">
                Tous les circuits sont visibles sur la carte · appuyez sur ▶ pour l&apos;aperçu animé
              </p>
              {routes.map((route, i) => {
                const dev = distanceDeviation(route.distance, selectedDistance);
                const isSelected = route.id === selectedRouteId;
                const color = ROUTE_COLORS[i % ROUTE_COLORS.length];
                const letter = String.fromCharCode(65 + i);
                return (
                  <div
                    key={route.id}
                    className={`flex items-center gap-2 px-3 py-3 rounded-2xl border-2 transition-all ${
                      isSelected
                        ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/10'
                        : 'border-transparent bg-gray-50 dark:bg-gray-800/50'
                    }`}
                  >
                    {/* Letter badge */}
                    <div
                      className="flex-none w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                      style={{ background: color }}
                    >
                      {letter}
                    </div>

                    {/* Info (tap to select + highlight on map) */}
                    <button
                      className="flex-1 min-w-0 text-left"
                      onClick={() => setSelectedRouteId(route.id)}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-gray-900 dark:text-white">
                          {route.label}
                        </span>
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                          {formatDistance(route.distance)}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                          Math.abs(dev) <= 8
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                            : Math.abs(dev) <= 20
                            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                        }`}>
                          {dev > 0 ? '+' : ''}{dev}%
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        ≈ {formatDuration(route.duration)} · Boucle
                      </p>
                    </button>

                    {/* Play button — animated preview */}
                    <button
                      onClick={() => handlePreview(route)}
                      className={`flex-none w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90 ${
                        isSelected && isAnimating
                          ? 'bg-orange-500 text-white shadow-md shadow-orange-200 animate-pulse'
                          : isSelected
                          ? 'bg-orange-500 text-white shadow-md'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                      }`}
                      title="Aperçu animé"
                    >
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Regenerate */}
          {routes.length > 0 && !isGenerating && (
            <button
              onClick={handleGenerateRoutes}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 mt-3 rounded-xl text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Régénérer
            </button>
          )}

          {/* Paths info */}
          {paths.length > 0 && (
            <p className="text-xs text-gray-300 dark:text-gray-600 text-center mt-2">
              {paths.length} segments chargés · {paths.filter((p) => p.score >= 0.7).length} idéaux pour courir
            </p>
          )}
        </div>
      </div>

      {/* ── Bottom CTA: animation progress OR run button ── */}
      {selectedRoute && !sheetOpen && (
        <div className="absolute left-0 right-0 z-[1001] px-4 pb-4" style={{ bottom: '0px' }}>
          {isAnimating ? (
            /* Animation controls */
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl px-4 pt-3 pb-4 space-y-3">
              {/* Runner emoji progress */}
              <div className="relative h-6">
                <div className="absolute inset-y-0 left-0 right-0 flex items-center">
                  <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-500 rounded-full transition-none"
                      style={{ width: `${animProgress * 100}%` }}
                    />
                  </div>
                </div>
                {/* Runner dot sliding along */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 text-xl leading-none transition-none"
                  style={{ left: `calc(${animProgress * 100}% - 12px)` }}
                >
                  🏃
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-xs text-gray-400">Aperçu du circuit · {formatDistance(selectedRoute.distance)}</p>
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 tabular-nums">
                    {Math.round(animProgress * selectedRoute.distance / 1000 * 10) / 10} km parcourus
                  </p>
                </div>
                <button
                  onClick={stopAnimation}
                  className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-300"
                >
                  <Square className="w-3.5 h-3.5 fill-current" /> Stop
                </button>
                <button
                  onClick={() => { stopAnimation(); handleRunCircuit(); }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-bold"
                >
                  <Play className="w-3.5 h-3.5 fill-white" /> Courir
                </button>
              </div>
            </div>
          ) : (
            /* Normal run button */
            <button
              onClick={handleRunCircuit}
              className="w-full flex items-center justify-center gap-2 py-4 bg-orange-500 text-white rounded-2xl text-base font-bold shadow-xl active:scale-95 transition-all"
            >
              <Play className="w-5 h-5 fill-white" />
              Courir ce circuit · {formatDistance(selectedRoute.distance)}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

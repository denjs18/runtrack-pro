'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2, Navigation, RefreshCw, Route, Filter,
  CheckCircle2, Play, ChevronUp, ChevronDown, X,
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
  { label: '3 km', value: 3000 },
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
  const [isLocating, setIsLocating]         = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [searchRadius, setSearchRadius]     = useState(2000);
  const [selectedDistance, setSelectedDistance] = useState(5);
  const [runningOnly, setRunningOnly]       = useState(true);
  const [shouldCenter, setShouldCenter]     = useState(false);
  const [sheetOpen, setSheetOpen]           = useState(false);
  const [showFilters, setShowFilters]       = useState(false);

  const lastFetchRef = useRef<{ lat: number; lng: number; radius: number; runningOnly: boolean } | null>(null);

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
    } catch {
      setError('Erreur lors du chargement des chemins. Réessayez.');
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
    setSheetOpen(true);
    try {
      const generated = await generateMultipleRoutes(userPosition[0], userPosition[1], selectedDistance);
      if (!generated.length) throw new Error('Aucun circuit trouvé.');
      setRoutes(generated);
      setSelectedRouteId(generated[0].id);
    } catch {
      setError('Impossible de générer les circuits. Essayez une autre distance.');
    } finally {
      setIsGenerating(false);
    }
  }, [userPosition, selectedDistance]);

  const selectedRoute = routes.find((r) => r.id === selectedRouteId) ?? null;
  const router = useRouter();

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
        />
      </div>

      {/* ── Top bar: distance chips + actions ── */}
      <div className="absolute top-3 left-0 right-0 px-3 z-[1000] flex flex-col gap-2 pointer-events-none">
        {/* Distance chips */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar flex-1">
            {DISTANCE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSelectedDistance(opt.value)}
                className={`flex-none px-3 py-1.5 rounded-full text-sm font-semibold shadow transition-colors ${
                  selectedDistance === opt.value
                    ? 'bg-orange-500 text-white shadow-orange-200'
                    : 'bg-white/95 text-gray-700 dark:bg-gray-800/95 dark:text-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`flex-none p-2 rounded-full shadow transition-colors pointer-events-auto ${
              showFilters ? 'bg-orange-500 text-white' : 'bg-white/95 text-gray-600 dark:bg-gray-800/95 dark:text-gray-300'
            }`}
          >
            <Filter className="w-4 h-4" />
          </button>
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

      {/* ── Floating action buttons (right side) ── */}
      <div className="absolute right-3 bottom-48 z-[1000] flex flex-col gap-3">
        {/* Locate me */}
        <button
          onClick={locateUser}
          disabled={isLocating}
          className="w-12 h-12 bg-white dark:bg-gray-800 rounded-full shadow-lg flex items-center justify-center text-orange-500 disabled:opacity-50 active:scale-95 transition-transform"
        >
          {isLocating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Navigation className="w-5 h-5" />}
        </button>
      </div>

      {/* ── Bottom sheet ── */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl z-[1000] transition-all duration-300 ${
          sheetOpen ? 'translate-y-0' : 'translate-y-[calc(100%-80px)]'
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

          {/* Loading spinner */}
          {isGenerating && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
              <p className="text-sm text-gray-500">Calcul des circuits {selectedDistance} km...</p>
            </div>
          )}

          {/* Route cards */}
          {routes.length > 0 && !isGenerating && (
            <div className="space-y-2 mt-1">
              {routes.map((route, i) => {
                const dev = distanceDeviation(route.distance, selectedDistance);
                const isSelected = route.id === selectedRouteId;
                const color = ROUTE_COLORS[i % ROUTE_COLORS.length];
                return (
                  <button
                    key={route.id}
                    onClick={() => { setSelectedRouteId(route.id); setSheetOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all text-left ${
                      isSelected
                        ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/10'
                        : 'border-transparent bg-gray-50 dark:bg-gray-800/50'
                    }`}
                  >
                    <div className="w-3.5 h-3.5 rounded-full flex-none" style={{ background: color }} />

                    <div className="flex-1 min-w-0">
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
                      <p className="text-xs text-gray-400 mt-0.5">≈ {formatDuration(route.duration)}</p>
                    </div>

                    {isSelected && <CheckCircle2 className="w-5 h-5 text-orange-500 flex-none" />}
                  </button>
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

      {/* ── "Run this circuit" sticky CTA ── */}
      {selectedRoute && (
        <div className="absolute bottom-0 left-0 right-0 z-[1001] px-4 pb-4 pointer-events-none" style={{ bottom: sheetOpen ? '60vh' : '80px' }}>
          <button
            onClick={handleRunCircuit}
            className="w-full flex items-center justify-center gap-2 py-4 bg-orange-500 text-white rounded-2xl text-base font-bold shadow-xl active:scale-95 transition-all pointer-events-auto"
          >
            <Play className="w-5 h-5 fill-white" />
            Courir ce circuit · {formatDistance(selectedRoute.distance)}
          </button>
        </div>
      )}
    </div>
  );
}

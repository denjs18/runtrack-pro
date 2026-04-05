'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Navigation, RefreshCw, Route, MapPin, Filter, ChevronDown, ChevronUp, CheckCircle2, Play } from 'lucide-react';
import type { OsmPath, GeneratedRoute } from './types';
import { fetchRunningPaths, generateMultipleRoutes } from './routeUtils';
import { saveCircuit } from '@/hooks/useSelectedCircuit';

const RouteFinderMap = dynamic(() => import('./RouteFinderMap'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-800">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        <span className="text-sm text-gray-500">Chargement de la carte...</span>
      </div>
    </div>
  ),
});

const RADIUS_OPTIONS = [
  { label: '500 m', value: 500 },
  { label: '1 km',  value: 1000 },
  { label: '2 km',  value: 2000 },
  { label: '3 km',  value: 3000 },
];

const DISTANCE_OPTIONS = [
  { label: '3 km',  value: 3 },
  { label: '5 km',  value: 5 },
  { label: '8 km',  value: 8 },
  { label: '10 km', value: 10 },
  { label: '15 km', value: 15 },
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

const LEGEND = [
  { color: '#16a34a', label: 'Idéal (sentier, chemin piéton)' },
  { color: '#84cc16', label: 'Bon (piste cyclable, zone calme)' },
  { color: '#ca8a04', label: 'Acceptable (rue résidentielle)' },
  { color: '#dc2626', label: 'À éviter (grande route)' },
];

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
  const [showPanel, setShowPanel]           = useState(true);

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
      setError('Erreur lors du chargement des chemins. Réessayez dans quelques secondes.');
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
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex-none px-4 pt-4 pb-2 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-500 rounded-xl flex items-center justify-center">
              <Route className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900 dark:text-white">Chercher des circuits</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Chemins adaptés à la course</p>
            </div>
          </div>
          <button
            onClick={locateUser}
            disabled={isLocating}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-medium disabled:opacity-50"
          >
            {isLocating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
            {isLocating ? 'Localisation...' : 'Me localiser'}
          </button>
        </div>
        {error && (
          <div className="mt-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-xs text-red-600 dark:text-red-400">
            {error}
          </div>
        )}
      </div>

      {/* Map */}
      <div className="flex-1 relative min-h-0">
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

        {/* Floating legend */}
        <div className="absolute top-3 right-3 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm rounded-xl px-3 py-2 shadow-lg z-[1000] text-xs">
          <div className="font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Légende</div>
          {LEGEND.map((item) => (
            <div key={item.color} className="flex items-center gap-2 mb-1">
              <div className="w-8 h-2 rounded-full flex-none" style={{ background: item.color }} />
              <span className="text-gray-600 dark:text-gray-400 leading-tight">{item.label}</span>
            </div>
          ))}
          {routes.length > 0 && (
            <div className="mt-1 pt-1 border-t border-gray-200 dark:border-gray-700 space-y-1">
              {routes.map((r, i) => (
                <div key={r.id} className="flex items-center gap-2">
                  <div className="w-8 h-2 rounded-full flex-none" style={{ background: ROUTE_COLORS[i % ROUTE_COLORS.length] }} />
                  <span className="text-gray-600 dark:text-gray-400">{r.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected route badge */}
        {selectedRoute && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white rounded-full px-4 py-2 shadow-lg z-[1000] flex items-center gap-3 text-sm font-medium whitespace-nowrap">
            <Route className="w-4 h-4 flex-none" />
            <span>{selectedRoute.label}</span>
            <span className="opacity-75">·</span>
            <span>{formatDistance(selectedRoute.distance)}</span>
            <span className="opacity-75">·</span>
            <span>{formatDuration(selectedRoute.duration)}</span>
          </div>
        )}
      </div>

      {/* Bottom panel */}
      <div className="flex-none bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
        <button
          onClick={() => setShowPanel((v) => !v)}
          className="w-full flex items-center justify-center py-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          {showPanel ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>

        {showPanel && (
          <div className="px-4 pb-4 space-y-4">
            {/* Radius + filter */}
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> Rayon de recherche
                </label>
                <div className="flex gap-1.5">
                  {RADIUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setSearchRadius(opt.value)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        searchRadius === opt.value
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Filter + load paths */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setRunningOnly((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  runningOnly
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                {runningOnly ? 'Course uniquement' : 'Tous les chemins'}
              </button>
              <button
                onClick={loadPaths}
                disabled={isLoadingPaths}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-green-500 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                {isLoadingPaths ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {isLoadingPaths ? 'Chargement...' : 'Charger les chemins'}
              </button>
            </div>

            {/* Circuit generator */}
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 flex items-center gap-1">
                <Route className="w-3.5 h-3.5" /> Générer des circuits en boucle
              </label>
              <div className="flex gap-2">
                <div className="flex gap-1.5 flex-1">
                  {DISTANCE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setSelectedDistance(opt.value)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        selectedDistance === opt.value
                          ? 'bg-indigo-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleGenerateRoutes}
                  disabled={isGenerating || !userPosition}
                  className="px-4 py-1.5 bg-indigo-500 text-white rounded-lg text-sm font-semibold disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Route className="w-4 h-4" />}
                  {isGenerating ? '...' : 'Go'}
                </button>
              </div>
              {!userPosition && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Localisez-vous pour générer des circuits
                </p>
              )}
            </div>

            {/* Generated routes list */}
            {isGenerating && (
              <div className="flex items-center justify-center gap-2 py-3 text-sm text-gray-500 dark:text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                Calcul de {DISTANCE_OPTIONS.find(d => d.value === selectedDistance)?.label} circuits...
              </div>
            )}

            {routes.length > 0 && !isGenerating && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                  {routes.length} circuit{routes.length > 1 ? 's' : ''} trouvé{routes.length > 1 ? 's' : ''}
                  {' '}pour {selectedDistance} km
                </div>
                {routes.map((route, i) => {
                  const dev = distanceDeviation(route.distance, selectedDistance);
                  const isSelected = route.id === selectedRouteId;
                  const color = ROUTE_COLORS[i % ROUTE_COLORS.length];
                  return (
                    <button
                      key={route.id}
                      onClick={() => { setSelectedRouteId(route.id); setShowPanel(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors text-left ${
                        isSelected
                          ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20'
                          : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
                      }`}
                    >
                      {/* Color swatch */}
                      <div className="w-3 h-3 rounded-full flex-none" style={{ background: color }} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                            {route.label}
                          </span>
                          <span className="text-sm font-bold text-gray-900 dark:text-white">
                            {formatDistance(route.distance)}
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                            Math.abs(dev) <= 8
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                              : Math.abs(dev) <= 20
                              ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                          }`}>
                            {dev > 0 ? '+' : ''}{dev}%
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          ≈ {formatDuration(route.duration)} · allure 6 min/km estimée
                        </div>
                      </div>

                      {isSelected ? (
                        <CheckCircle2 className="w-4 h-4 text-indigo-500 flex-none" />
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500 flex-none">Voir ↑</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Run selected circuit */}
            {selectedRoute && (
              <button
                onClick={handleRunCircuit}
                className="w-full flex items-center justify-center gap-2 py-3 bg-green-500 hover:bg-green-600 active:scale-95 text-white rounded-xl text-base font-bold transition-all shadow-md"
              >
                <Play className="w-5 h-5 fill-white" />
                Courir ce circuit ({formatDistance(selectedRoute.distance)})
              </button>
            )}

            {/* Path count */}
            {paths.length > 0 && (
              <div className="text-xs text-gray-400 dark:text-gray-500 text-center">
                {paths.length} segments chargés · {paths.filter((p) => p.score >= 0.7).length} idéaux pour courir
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

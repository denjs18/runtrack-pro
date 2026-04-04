'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback, useRef } from 'react';
import { Loader2, Navigation, RefreshCw, Route, MapPin, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import type { OsmPath, GeneratedRoute } from './types';
import { fetchRunningPaths, generateCircularRoute } from './routeUtils';

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
  { label: '1 km', value: 1000 },
  { label: '2 km', value: 2000 },
  { label: '3 km', value: 3000 },
];

const DISTANCE_OPTIONS = [
  { label: '3 km', value: 3 },
  { label: '5 km', value: 5 },
  { label: '8 km', value: 8 },
  { label: '10 km', value: 10 },
  { label: '15 km', value: 15 },
];

function formatDistance(meters: number) {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${m.toString().padStart(2, '0')}`;
  return `${m} min`;
}

const LEGEND = [
  { color: '#16a34a', label: 'Idéal (chemin piéton, sentier)' },
  { color: '#84cc16', label: 'Bon (piste cyclable, zone calme)' },
  { color: '#ca8a04', label: 'Acceptable (rue résidentielle)' },
  { color: '#dc2626', label: 'À éviter (grande route)' },
];

export default function RouteFinderComponent() {
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const [paths, setPaths] = useState<OsmPath[]>([]);
  const [generatedRoute, setGeneratedRoute] = useState<GeneratedRoute | null>(null);
  const [isLoadingPaths, setIsLoadingPaths] = useState(false);
  const [isGeneratingRoute, setIsGeneratingRoute] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchRadius, setSearchRadius] = useState(2000);
  const [selectedDistance, setSelectedDistance] = useState(5);
  const [runningOnly, setRunningOnly] = useState(true);
  const [shouldCenter, setShouldCenter] = useState(false);
  const [showPanel, setShowPanel] = useState(true);

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
        const { latitude, longitude } = pos.coords;
        const position: [number, number] = [latitude, longitude];
        setUserPosition(position);
        setMapCenter(position);
        setShouldCenter(true);
        setIsLocating(false);
      },
      (err) => {
        setError(
          err.code === 1
            ? 'Accès à la position refusé. Vérifiez les permissions.'
            : 'Impossible d\'obtenir votre position.'
        );
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }, []);

  const loadPaths = useCallback(async () => {
    const center = mapCenter ?? userPosition;
    if (!center) {
      setError('Localisez-vous d\'abord pour charger les chemins.');
      return;
    }
    const [lat, lng] = center;

    // Avoid redundant fetches
    const last = lastFetchRef.current;
    if (
      last &&
      Math.abs(last.lat - lat) < 0.0005 &&
      Math.abs(last.lng - lng) < 0.0005 &&
      last.radius === searchRadius &&
      last.runningOnly === runningOnly
    ) {
      return;
    }

    setIsLoadingPaths(true);
    setError(null);
    try {
      const result = await fetchRunningPaths(lat, lng, searchRadius, runningOnly);
      setPaths(result);
      setGeneratedRoute(null);
      lastFetchRef.current = { lat, lng, radius: searchRadius, runningOnly };
    } catch {
      setError('Erreur lors du chargement des chemins. Réessayez dans quelques secondes.');
    } finally {
      setIsLoadingPaths(false);
    }
  }, [mapCenter, userPosition, searchRadius, runningOnly]);

  const handleGenerateRoute = useCallback(async () => {
    const start = userPosition;
    if (!start) {
      setError('Localisez-vous d\'abord pour générer un circuit.');
      return;
    }
    setIsGeneratingRoute(true);
    setError(null);
    try {
      const route = await generateCircularRoute(start[0], start[1], selectedDistance);
      if (!route) throw new Error('Aucun itinéraire trouvé.');
      setGeneratedRoute(route);
    } catch {
      setError('Impossible de générer le circuit. Essayez une autre distance.');
    } finally {
      setIsGeneratingRoute(false);
    }
  }, [userPosition, selectedDistance]);

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
          <div className="flex items-center gap-2">
            <button
              onClick={locateUser}
              disabled={isLocating}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-medium disabled:opacity-50"
            >
              {isLocating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Navigation className="w-3.5 h-3.5" />
              )}
              {isLocating ? 'Localisation...' : 'Me localiser'}
            </button>
          </div>
        </div>

        {/* Error */}
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
          generatedRoute={generatedRoute}
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
          {generatedRoute && (
            <div className="flex items-center gap-2 mt-1 pt-1 border-t border-gray-200 dark:border-gray-700">
              <div className="w-8 h-2 rounded-full flex-none bg-indigo-500" />
              <span className="text-gray-600 dark:text-gray-400">Circuit généré</span>
            </div>
          )}
        </div>

        {/* Generated route info */}
        {generatedRoute && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white rounded-full px-4 py-2 shadow-lg z-[1000] flex items-center gap-3 text-sm font-medium">
            <Route className="w-4 h-4" />
            <span>{formatDistance(generatedRoute.distance)}</span>
            <span className="opacity-75">·</span>
            <span>{formatDuration(generatedRoute.duration)}</span>
            <button
              onClick={() => setGeneratedRoute(null)}
              className="ml-1 opacity-70 hover:opacity-100 text-xs"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Bottom panel */}
      <div className="flex-none bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
        {/* Panel toggle */}
        <button
          onClick={() => setShowPanel((v) => !v)}
          className="w-full flex items-center justify-center py-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          {showPanel ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>

        {showPanel && (
          <div className="px-4 pb-4 space-y-4">
            {/* Search radius + filter toggle */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  Rayon de recherche
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

            {/* Running-only filter + load button */}
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
                {isLoadingPaths ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                {isLoadingPaths ? 'Chargement...' : 'Charger les chemins'}
              </button>
            </div>

            {/* Circuit generator */}
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 flex items-center gap-1">
                <Route className="w-3.5 h-3.5" />
                Générer un circuit en boucle
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
                  onClick={handleGenerateRoute}
                  disabled={isGeneratingRoute || !userPosition}
                  className="px-4 py-1.5 bg-indigo-500 text-white rounded-lg text-sm font-semibold disabled:opacity-50 whitespace-nowrap flex items-center gap-1.5"
                >
                  {isGeneratingRoute ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Route className="w-4 h-4" />
                  )}
                  {isGeneratingRoute ? '...' : 'Go'}
                </button>
              </div>
              {!userPosition && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Localisez-vous pour générer un circuit
                </p>
              )}
            </div>

            {/* Path count */}
            {paths.length > 0 && (
              <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                {paths.length} segment{paths.length > 1 ? 's' : ''} chargé{paths.length > 1 ? 's' : ''}
                {' · '}
                {paths.filter((p) => p.score >= 0.7).length} idéaux pour courir
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { GPSPoint } from '@/types';

interface UseGPSOptions {
  accuracyThreshold?: number;
  minDistanceFilter?: number;
}

interface UseGPSReturn {
  currentPosition: GPSPoint | null;
  points: GPSPoint[];
  error: string | null;
  isWatching: boolean;
  startWatching: () => void;
  stopWatching: () => void;
  clearPoints: () => void;
}

const DEFAULT_ACCURACY_THRESHOLD = 30; // Ignore points with accuracy > 30m
const DEFAULT_MIN_DISTANCE = 3; // Minimum distance in meters between points

export function useGPS(options: UseGPSOptions = {}): UseGPSReturn {
  const {
    accuracyThreshold = DEFAULT_ACCURACY_THRESHOLD,
    minDistanceFilter = DEFAULT_MIN_DISTANCE,
  } = options;

  const [currentPosition, setCurrentPosition] = useState<GPSPoint | null>(null);
  const [points, setPoints] = useState<GPSPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isWatching, setIsWatching] = useState(false);

  const watchIdRef = useRef<number | null>(null);
  const lastPointRef = useRef<GPSPoint | null>(null);

  const calculateDistance = useCallback((p1: GPSPoint, p2: GPSPoint): number => {
    const R = 6371000;
    const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
    const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((p1.lat * Math.PI) / 180) *
        Math.cos((p2.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  const handlePosition = useCallback(
    (position: GeolocationPosition) => {
      const { latitude, longitude, altitude, speed, accuracy } = position.coords;
      const timestamp = position.timestamp;

      // Filter out inaccurate points
      if (accuracy > accuracyThreshold) {
        console.log(`Point ignored: accuracy ${accuracy.toFixed(1)}m > ${accuracyThreshold}m`);
        return;
      }

      const newPoint: GPSPoint = {
        lat: latitude,
        lng: longitude,
        alt: altitude,
        speed: speed ? speed * 3.6 : null, // Convert m/s to km/h
        accuracy,
        timestamp,
      };

      // Check minimum distance from last point
      if (lastPointRef.current) {
        const distance = calculateDistance(lastPointRef.current, newPoint);
        if (distance < minDistanceFilter) {
          // Still update current position for UI, but don't add to track
          setCurrentPosition(newPoint);
          return;
        }
      }

      lastPointRef.current = newPoint;
      setCurrentPosition(newPoint);
      setPoints((prev) => [...prev, newPoint]);
      setError(null);
    },
    [accuracyThreshold, minDistanceFilter, calculateDistance]
  );

  const handleError = useCallback((err: GeolocationPositionError) => {
    let errorMessage: string;

    switch (err.code) {
      case err.PERMISSION_DENIED:
        errorMessage = 'Permission de géolocalisation refusée';
        break;
      case err.POSITION_UNAVAILABLE:
        errorMessage = 'Position indisponible';
        break;
      case err.TIMEOUT:
        errorMessage = 'Délai de géolocalisation dépassé';
        break;
      default:
        errorMessage = 'Erreur de géolocalisation inconnue';
    }

    setError(errorMessage);
    console.error('GPS Error:', errorMessage);
  }, []);

  const startWatching = useCallback(() => {
    if (!navigator.geolocation) {
      setError('La géolocalisation n\'est pas supportée par ce navigateur');
      return;
    }

    if (watchIdRef.current !== null) {
      return; // Already watching
    }

    setIsWatching(true);
    setError(null);

    const watchOptions: PositionOptions = {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10000,
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePosition,
      handleError,
      watchOptions
    );
  }, [handlePosition, handleError]);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsWatching(false);
  }, []);

  const clearPoints = useCallback(() => {
    setPoints([]);
    lastPointRef.current = null;
    setCurrentPosition(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return {
    currentPosition,
    points,
    error,
    isWatching,
    startWatching,
    stopWatching,
    clearPoints,
  };
}

export default useGPS;

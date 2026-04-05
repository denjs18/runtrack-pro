'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import type { GPSPoint } from '@/types';

export interface StoredCircuit {
  id: string;
  coords: [number, number][]; // [lat, lng]
  distance: number;           // metres
  duration: number;           // seconds
  label: string;
  savedAt: number;            // Date.now()
}

const KEY = 'runtrack_selected_circuit';
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function haversineDist(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function saveCircuit(circuit: Omit<StoredCircuit, 'savedAt'>) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...circuit, savedAt: Date.now() }));
  } catch {}
}

export function useSelectedCircuit(currentPosition: GPSPoint | null) {
  const [circuit, setCircuit] = useState<StoredCircuit | null>(null);
  const [remainingDistance, setRemainingDistance] = useState(0);
  const lastCalcRef = useRef(0);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const parsed: StoredCircuit = JSON.parse(raw);
      if (Date.now() - parsed.savedAt > TTL_MS) {
        localStorage.removeItem(KEY);
        return;
      }
      setCircuit(parsed);
      setRemainingDistance(parsed.distance);
    } catch {
      localStorage.removeItem(KEY);
    }
  }, []);

  // Compute remaining distance — throttled to max once every 2s
  useEffect(() => {
    if (!circuit || !currentPosition) return;
    const now = Date.now();
    if (now - lastCalcRef.current < 2000) return;
    lastCalcRef.current = now;

    const coords = circuit.coords;
    let closestIdx = 0;
    let minDist = Infinity;
    for (let i = 0; i < coords.length; i++) {
      const d = haversineDist(currentPosition.lat, currentPosition.lng, coords[i][0], coords[i][1]);
      if (d < minDist) { minDist = d; closestIdx = i; }
    }

    let remaining = 0;
    for (let i = closestIdx; i < coords.length - 1; i++) {
      remaining += haversineDist(coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1]);
    }
    setRemainingDistance(remaining);
  }, [circuit, currentPosition]);

  const clearCircuit = () => {
    localStorage.removeItem(KEY);
    setCircuit(null);
    setRemainingDistance(0);
  };

  // Memoize coords to avoid unnecessary Leaflet re-renders
  const circuitCoords = useMemo(() => circuit?.coords ?? null, [circuit]);

  return { circuit, circuitCoords, remainingDistance, clearCircuit };
}

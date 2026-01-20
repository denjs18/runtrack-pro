'use client';

import dynamic from 'next/dynamic';
import { GPSPoint } from '@/types';

// Dynamically import MapComponent with no SSR
const MapComponent = dynamic(() => import('./MapComponent'), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse flex items-center justify-center" style={{ height: '300px' }}>
      <div className="text-gray-400 dark:text-gray-500">Chargement de la carte...</div>
    </div>
  ),
});

interface DynamicMapProps {
  points: GPSPoint[];
  currentPosition?: GPSPoint | null;
  isTracking?: boolean;
  height?: string;
  showSpeedGradient?: boolean;
}

export default function DynamicMap(props: DynamicMapProps) {
  return <MapComponent {...props} />;
}

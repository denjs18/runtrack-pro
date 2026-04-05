'use client';

import { useMemo, useRef } from 'react';
import { GPSPoint, ActivityStats } from '@/types';
import { calculateTotalDistance, calculateElevationGain } from '@/lib/utils';

interface UseActivityStatsOptions {
  startTime: number | null;
  pausedTime?: number;
}

export function useActivityStats(
  points: GPSPoint[],
  options: UseActivityStatsOptions
): ActivityStats {
  const { startTime, pausedTime = 0 } = options;

  // Exponential moving average for pace smoothing — survives across memoized recalcs
  const emaPaceRef = useRef(0);

  return useMemo(() => {
    const distance = calculateTotalDistance(points);

    let duration = 0;
    if (startTime) {
      duration = Math.floor((Date.now() - startTime - pausedTime) / 1000);
    } else if (points.length >= 2) {
      duration = Math.floor(
        (points[points.length - 1].timestamp - points[0].timestamp) / 1000
      );
    }

    const avgSpeed = duration > 0 ? (distance / 1000) / (duration / 3600) : 0;
    const avgPace = distance > 0 ? duration / (distance / 1000) : 0;

    let maxSpeed = 0;
    for (const point of points) {
      if (point.speed !== null && point.speed > maxSpeed) maxSpeed = point.speed;
    }

    // Use last 10 points (was 5) for a smoother current speed/pace
    let currentSpeed = 0;
    let currentPace = 0;

    if (points.length >= 2) {
      const recentPoints = points.slice(-10);
      if (recentPoints.length >= 2) {
        const recentDistance = calculateTotalDistance(recentPoints);
        const recentTime =
          (recentPoints[recentPoints.length - 1].timestamp - recentPoints[0].timestamp) / 1000;

        if (recentTime > 0) {
          currentSpeed = (recentDistance / 1000) / (recentTime / 3600);
          currentPace = recentDistance > 0 ? recentTime / (recentDistance / 1000) : 0;
        }
      }

      // Blend with GPS-reported speed for stability
      const lastPoint = points[points.length - 1];
      if (lastPoint.speed !== null && lastPoint.speed > 0) {
        currentSpeed = (currentSpeed + lastPoint.speed) / 2;
        if (currentSpeed > 0) currentPace = 3600 / currentSpeed;
      }

      // Apply EMA (α=0.25) to pace for extra smoothness
      if (currentPace > 0) {
        emaPaceRef.current =
          emaPaceRef.current === 0
            ? currentPace
            : 0.25 * currentPace + 0.75 * emaPaceRef.current;
        currentPace = emaPaceRef.current;
        currentSpeed = currentSpeed > 0 ? 3600 / currentPace : 0;
      } else if (avgPace > 0) {
        // Fallback to average pace while not enough points
        currentPace = avgPace;
        currentSpeed = avgSpeed;
      }
    }

    const elevationGain = calculateElevationGain(points);

    return { distance, duration, avgPace, avgSpeed, maxSpeed, elevationGain, currentPace, currentSpeed };
  }, [points, startTime, pausedTime]);
}

export default useActivityStats;

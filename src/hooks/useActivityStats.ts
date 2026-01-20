'use client';

import { useMemo } from 'react';
import { GPSPoint, ActivityStats } from '@/types';
import {
  calculateTotalDistance,
  calculateElevationGain,
} from '@/lib/utils';

interface UseActivityStatsOptions {
  startTime: number | null;
  pausedTime?: number;
}

export function useActivityStats(
  points: GPSPoint[],
  options: UseActivityStatsOptions
): ActivityStats {
  const { startTime, pausedTime = 0 } = options;

  return useMemo(() => {
    // Calculate distance
    const distance = calculateTotalDistance(points);

    // Calculate duration
    let duration = 0;
    if (startTime) {
      duration = Math.floor((Date.now() - startTime - pausedTime) / 1000);
    } else if (points.length >= 2) {
      // Calculate from points timestamps
      duration = Math.floor(
        (points[points.length - 1].timestamp - points[0].timestamp) / 1000
      );
    }

    // Calculate average speed (km/h)
    const avgSpeed = duration > 0 ? (distance / 1000) / (duration / 3600) : 0;

    // Calculate average pace (seconds per km)
    const avgPace = distance > 0 ? duration / (distance / 1000) : 0;

    // Calculate max speed from GPS data
    let maxSpeed = 0;
    for (const point of points) {
      if (point.speed !== null && point.speed > maxSpeed) {
        maxSpeed = point.speed;
      }
    }

    // Calculate current speed and pace (from last few points)
    let currentSpeed = 0;
    let currentPace = 0;

    if (points.length >= 2) {
      // Use last 5 points or less for smoothing
      const recentPoints = points.slice(-5);
      if (recentPoints.length >= 2) {
        const recentDistance = calculateTotalDistance(recentPoints);
        const recentTime =
          (recentPoints[recentPoints.length - 1].timestamp - recentPoints[0].timestamp) /
          1000;

        if (recentTime > 0) {
          currentSpeed = (recentDistance / 1000) / (recentTime / 3600);
          currentPace = recentDistance > 0 ? recentTime / (recentDistance / 1000) : 0;
        }
      }

      // Also consider GPS reported speed if available
      const lastPoint = points[points.length - 1];
      if (lastPoint.speed !== null && lastPoint.speed > 0) {
        // Blend GPS speed with calculated speed for stability
        currentSpeed = (currentSpeed + lastPoint.speed) / 2;
        // Recalculate pace from blended speed
        if (currentSpeed > 0) {
          currentPace = 3600 / currentSpeed; // seconds per km
        }
      }
    }

    // Calculate elevation gain
    const elevationGain = calculateElevationGain(points);

    return {
      distance,
      duration,
      avgPace,
      avgSpeed,
      maxSpeed,
      elevationGain,
      currentPace,
      currentSpeed,
    };
  }, [points, startTime, pausedTime]);
}

export default useActivityStats;

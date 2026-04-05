'use client';

import { useRef, useCallback } from 'react';

export function useSwipeGesture(
  onSwipeLeft: () => void,
  onSwipeRight: () => void,
  threshold = 80
) {
  const startXRef = useRef<number | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (startXRef.current === null) return;
      const delta = e.changedTouches[0].clientX - startXRef.current;
      startXRef.current = null;
      if (delta < -threshold) onSwipeLeft();
      else if (delta > threshold) onSwipeRight();
    },
    [onSwipeLeft, onSwipeRight, threshold]
  );

  return { onTouchStart, onTouchEnd };
}

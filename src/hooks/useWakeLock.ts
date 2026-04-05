'use client';

import { useEffect, useRef, useState } from 'react';

declare global {
  interface Navigator {
    wakeLock?: {
      request(type: 'screen'): Promise<WakeLockSentinel>;
    };
  }
  interface WakeLockSentinel {
    released: boolean;
    release(): Promise<void>;
    addEventListener(type: string, listener: EventListener): void;
    removeEventListener(type: string, listener: EventListener): void;
  }
}

export function useWakeLock() {
  const [isLockActive, setIsLockActive] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  // Use a ref (not state) so visibilitychange handler never has stale closure
  const shouldHoldLockRef = useRef(false);

  const requestLock = async () => {
    if (!navigator.wakeLock) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      shouldHoldLockRef.current = true;
      setIsLockActive(true);
      wakeLockRef.current.addEventListener('release', () => {
        // OS released it (e.g. background) — will be re-acquired on visibilitychange
        if (!shouldHoldLockRef.current) setIsLockActive(false);
      });
    } catch {
      // Wake Lock not available or denied — fail silently
    }
  };

  const releaseLock = async () => {
    shouldHoldLockRef.current = false;
    if (wakeLockRef.current && !wakeLockRef.current.released) {
      await wakeLockRef.current.release();
    }
    wakeLockRef.current = null;
    setIsLockActive(false);
  };

  // Re-acquire when app comes back to foreground during an active run
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && shouldHoldLockRef.current) {
        await requestLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return { isLockActive, requestLock, releaseLock };
}

'use client';

import { useEffect, useRef, useState } from 'react';

// Use unknown nav to avoid conflicts with the DOM lib's own WakeLock declarations
type AnyNav = Navigator & { wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinel> } };

export function useWakeLock() {
  const [isLockActive, setIsLockActive] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  // Use a ref (not state) so visibilitychange handler never has a stale closure
  const shouldHoldLockRef = useRef(false);

  const requestLock = async () => {
    const nav = navigator as AnyNav;
    if (!nav.wakeLock) return;
    try {
      wakeLockRef.current = await nav.wakeLock.request('screen');
      shouldHoldLockRef.current = true;
      setIsLockActive(true);
      wakeLockRef.current.addEventListener('release', () => {
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

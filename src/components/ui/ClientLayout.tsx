'use client';

import { ReactNode, useState, useEffect } from 'react';
import { ToastProvider } from './Toast';
import Navigation from './Navigation';
import InstallBanner from './InstallBanner';

const TRACKING_FLAG = 'runtrack_is_tracking';

interface ClientLayoutProps {
  children: ReactNode;
}

export default function ClientLayout({ children }: ClientLayoutProps) {
  const [isTracking, setIsTracking] = useState(false);

  useEffect(() => {
    const read = () => setIsTracking(localStorage.getItem(TRACKING_FLAG) === 'true');
    read();
    window.addEventListener('trackingStateChange', read);
    return () => window.removeEventListener('trackingStateChange', read);
  }, []);

  return (
    <ToastProvider>
      <div style={{ paddingBottom: isTracking ? 'calc(env(safe-area-inset-bottom) + 48px)' : 'calc(env(safe-area-inset-bottom) + 64px)' }}>
        {children}
      </div>
      <Navigation />
      <InstallBanner />
    </ToastProvider>
  );
}

'use client';

import { ReactNode, useState, useEffect } from 'react';
import { ToastProvider } from './Toast';
import Navigation from './Navigation';

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
      {/* Reduce bottom padding when tracking (pill is shorter than full nav) */}
      <div className={isTracking ? 'pb-12' : 'pb-20'}>
        {children}
      </div>
      <Navigation />
    </ToastProvider>
  );
}

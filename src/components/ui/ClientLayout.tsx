'use client';

import { ReactNode } from 'react';
import { ToastProvider } from './Toast';
import Navigation from './Navigation';

interface ClientLayoutProps {
  children: ReactNode;
}

export default function ClientLayout({ children }: ClientLayoutProps) {
  return (
    <ToastProvider>
      <div className="pb-20">
        {children}
      </div>
      <Navigation />
    </ToastProvider>
  );
}

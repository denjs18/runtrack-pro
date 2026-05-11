'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, History, User, Route, Circle, Calendar, BarChart3, Map } from 'lucide-react';
import { useState, useEffect } from 'react';

const navItems = [
  { href: '/', icon: Home, label: 'Accueil' },
  { href: '/activities', icon: History, label: 'Activités' },
  { href: '/training', icon: Calendar, label: 'Training' },
  { href: '/stats', icon: BarChart3, label: 'Stats' },
  { href: '/heatmap', icon: Map, label: 'Heatmap' },
];

const TRACKING_FLAG = 'runtrack_is_tracking';

export default function Navigation() {
  const pathname = usePathname();
  const [isTracking, setIsTracking] = useState(false);

  // Read initial state and listen for changes dispatched by TrackerInterface
  useEffect(() => {
    const read = () => setIsTracking(localStorage.getItem(TRACKING_FLAG) === 'true');
    read();
    window.addEventListener('trackingStateChange', read);
    return () => window.removeEventListener('trackingStateChange', read);
  }, []);

  // Hide on activity detail pages
  if (pathname.match(/^\/activities\/[^/]+$/)) return null;

  // During active tracking: show a compact status pill instead of the full nav
  if (isTracking) {
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900/95 backdrop-blur-lg border-t border-gray-700 safe-area-pb">
        <div className="max-w-lg mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Circle className="w-3 h-3 text-red-500 fill-red-500 animate-pulse" />
            <span className="text-sm font-semibold text-white">Course en cours</span>
          </div>
          <Link
            href="/"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-xs font-medium transition-colors"
          >
            <Home className="w-3.5 h-3.5" />
            Revenir
          </Link>
        </div>
      </nav>
    );
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 dark:bg-gray-900/90 backdrop-blur-lg border-t border-gray-200 dark:border-gray-800 safe-area-pb">
      <div className="max-w-lg mx-auto px-6">
        <div className="flex items-center justify-around py-2">
          {navItems.map((item) => {
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors ${
                  isActive
                    ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <item.icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px]' : ''}`} />
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

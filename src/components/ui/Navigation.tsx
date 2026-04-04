'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, History, User, Route } from 'lucide-react';

const navItems = [
  { href: '/', icon: Home, label: 'Accueil' },
  { href: '/activities', icon: History, label: 'Historique' },
  { href: '/route-finder', icon: Route, label: 'Circuits' },
  { href: '/profile', icon: User, label: 'Profil' },
];

export default function Navigation() {
  const pathname = usePathname();

  // Hide on activity detail pages
  if (pathname.match(/^\/activities\/[^/]+$/)) {
    return null;
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

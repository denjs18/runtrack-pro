'use client';

import TrackerInterface from '@/components/tracking/TrackerInterface';

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-lg mx-auto px-4 py-6">
        <TrackerInterface />
      </div>
    </main>
  );
}

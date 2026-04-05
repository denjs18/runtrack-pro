import TrackerInterface from '@/components/tracking/TrackerInterface';

export default function Home() {
  return (
    <main className="fixed inset-0" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 64px)' }}>
      <TrackerInterface />
    </main>
  );
}

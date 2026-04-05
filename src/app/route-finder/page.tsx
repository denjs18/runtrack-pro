import RouteFinderComponent from '@/components/route-finder/RouteFinderComponent';

export const metadata = {
  title: 'Circuits de course - RunTrack Pro',
  description: 'Trouvez les meilleurs chemins pour courir autour de vous',
};

export default function RouteFinderPage() {
  return (
    <main className="fixed inset-0" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 64px)' }}>
      <RouteFinderComponent />
    </main>
  );
}

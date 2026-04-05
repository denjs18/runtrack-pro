import type { IActivity } from '@/models/Activity';

function escapeXml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function generateGPX(activity: IActivity): string {
  const name = escapeXml(activity.name);
  const creator = 'RunTrack Pro';
  const startTime = new Date(activity.startTime).toISOString();

  const trackPoints = activity.points
    .map((p) => {
      const time = new Date(p.timestamp).toISOString();
      const ele = p.alt != null ? `\n        <ele>${p.alt.toFixed(1)}</ele>` : '';
      const speed = p.speed != null
        ? `\n        <extensions><speed>${(p.speed / 3.6).toFixed(2)}</speed></extensions>`
        : '';
      return `    <trkpt lat="${p.lat.toFixed(7)}" lon="${p.lng.toFixed(7)}">${ele}
        <time>${time}</time>${speed}
    </trkpt>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="${creator}"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${name}</name>
    <time>${startTime}</time>
  </metadata>
  <trk>
    <name>${name}</name>
    <trkseg>
${trackPoints}
    </trkseg>
  </trk>
</gpx>`;
}

export function downloadGPX(activity: IActivity) {
  const gpx = generateGPX(activity);
  const blob = new Blob([gpx], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${activity.name.replace(/[^a-z0-9]/gi, '_')}.gpx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

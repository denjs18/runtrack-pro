export interface OsmPath {
  id: number;
  coords: [number, number][];
  tags: Record<string, string>;
  score: number;
  color: string;
  label: string;
  weight: number;
}

export interface GeneratedRoute {
  id: string;
  coords: [number, number][];
  distance: number; // meters
  duration: number; // seconds
  label: string;    // e.g. "Circuit A"
}

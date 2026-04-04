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
  coords: [number, number][];
  distance: number; // meters
  duration: number; // seconds
}

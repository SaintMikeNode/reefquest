// The four island groups of the Bay Islands department (Islas de la Bahía). Hard scope limit:
// nothing outside BAY_ISLANDS_BBOX is loaded or shown.
//
// Centers are rough placeholders for the 2D menu. Phase 0 replaces them with per-island boxes
// and land masks derived from OpenStreetMap coastlines.

export const BAY_ISLANDS_BBOX = { south: 15.8, north: 16.6, west: -87.1, east: -85.7 } as const;

export type IslandId = "roatan" | "utila" | "guanaja" | "cayos-cochinos";

export interface Island {
  id: IslandId;
  name: string; // Same in Spanish and English.
  center: { lat: number; lon: number };
  available: boolean; // false → "coming soon" in the menu.
}

export const ISLANDS: Island[] = [
  { id: "utila", name: "Utila", center: { lat: 16.1, lon: -86.92 }, available: false },
  { id: "roatan", name: "Roatán", center: { lat: 16.35, lon: -86.48 }, available: true },
  { id: "guanaja", name: "Guanaja", center: { lat: 16.47, lon: -85.88 }, available: false },
  { id: "cayos-cochinos", name: "Cayos Cochinos", center: { lat: 15.96, lon: -86.49 }, available: false },
];

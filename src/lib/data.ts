// Data loaders. Everything comes from our own precomputed static files under /data (made by the
// Python scripts in pipeline/), never from third-party servers at runtime.

export interface IslandStatus {
  name: string;
  dhw: number;
  dhw_max: number;
  sst: number;
  dhw_7d_ago: number;
  recent_dhw: number[]; // last 120 days, DHW × 10
  year_max_dhw: number[];
}
export interface Latest {
  date: string;
  years: number[];
  islands: Record<string, IslandStatus>;
  grid: number[]; // last day, DHW × 10, 255 = no data
}
export interface HeatIndex {
  rows: number;
  cols: number;
  lat: [number, number];
  lon: [number, number];
  cell_deg: number;
  first: string;
  last: string;
  years: { year: number; first: string; days: number }[];
}
export interface IslandSeries {
  first: string;
  last: string;
  scale: number;
  islands: Record<string, { cells: number; dhw_mean: number[]; dhw_max: number[]; sst_mean: number[] }>;
}
export interface SceneMeta {
  island: string;
  name: string;
  cell_m: number;
  size_m: [number, number];
  terrain: { file: string; width: number; height: number; min_m: number; max_m: number };
  habitat: { file: string; width: number; height: number };
  bathymetry_source: string;
  geo: { lonlat_to_uv: number[][]; uv_to_lonlat: number[][]; fit_error_m: number };
  bounds_lonlat: { south: number; north: number; west: number; east: number };
}

const cache = new Map<string, Promise<unknown>>();

function get<T>(url: string, kind: "json" | "bin" = "json"): Promise<T> {
  if (!cache.has(url)) {
    const p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`${url}: ${r.status}`);
      return kind === "json" ? r.json() : r.arrayBuffer().then((b) => new Uint8Array(b));
    });
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return cache.get(url) as Promise<T>;
}

export const loadLatest = () => get<Latest>("/data/heat/latest.json");
export const loadHeatIndex = () => get<HeatIndex>("/data/heat/index.json");
export const loadSeries = () => get<IslandSeries>("/data/heat/islands.json");
export const loadYearGrid = (year: number) => get<Uint8Array>(`/data/heat/grid/${year}.bin`, "bin");
export const loadIslandShapes = () => get<GeoJSON>("/data/islands.geojson");
export interface Region {
  source: string;
  bbox: { south: number; north: number; west: number; east: number };
  levels: number[];
  contours: Record<string, number[][][]>;
  mainland: number[][][];
  /** Coarse elevation grid (land and seafloor), rows north to south: see loadRelief(). */
  relief?: { file: string; w: number; h: number; west: number; north: number; step: number };
}
export const loadRegion = () => get<Region>("/data/region.json");
/** Elevation in meters (int16) for the grid described by Region.relief. */
export const loadRelief = () => get<Uint8Array>("/data/relief.bin", "bin").then((b) => new Int16Array(b.buffer, b.byteOffset, b.byteLength >> 1));
export const loadSceneMeta = (id: string) => get<SceneMeta>(`/data/${id}/meta.json`);

export interface GeoJSON {
  features: { properties: { id: string; name: string }; geometry: { type: "MultiPolygon"; coordinates: number[][][][] } }[];
}

/** Date string (YYYY-MM-DD) for a day offset from a start date. */
export function addDays(start: string, days: number): string {
  const d = new Date(start + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 864e5);
}

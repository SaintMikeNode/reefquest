import type { HeatIndex } from "../lib/data";
import { heatRef } from "./sceneStore";

/** DHW (°C-weeks) of the NOAA 5 km cell containing lon/lat on day `day` of the loaded year. */
export function dhwAt(index: HeatIndex, lon: number, lat: number, day: number): number | null {
  const g = heatRef.grid;
  if (!g) return null;
  const col = Math.round((lon - index.lon[0]) / index.cell_deg);
  const row = Math.round((index.lat[0] - lat) / index.cell_deg);
  if (col < 0 || row < 0 || col >= index.cols || row >= index.rows) return null;
  const n = index.cols * index.rows;
  const v = g[Math.min(day, g.length / n - 1) * n + row * index.cols + col];
  return v === 255 ? null : v / 10;
}

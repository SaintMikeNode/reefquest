// NOAA Coral Reef Watch Bleaching Alert Area scale, extended in 2023 with Alert Levels 3–5.
// The gridded ERDDAP product only encodes levels up to Alert 2, so ReefQuest derives the level from
// degree heating weeks (DHW). Watch/Warning depend on the daily HotSpot, which our summary files
// don't keep, so below 4 °C-weeks we only say "heat stress building" when DHW > 0.
// Thresholds: CRW methodology (coralreefwatch.noaa.gov/product/5km/methodology.php).

export interface AlertLevel {
  id: number; // 0..7
  min: number; // DHW lower bound, °C-weeks
  color: string;
  key: "none" | "building" | "a1" | "a2" | "a3" | "a4" | "a5";
}

export const LEVELS: AlertLevel[] = [
  { id: 0, min: 0, color: "#3a9bb5", key: "none" },
  { id: 1, min: 0.01, color: "#f7a51c", key: "building" },
  { id: 3, min: 4, color: "#ef3b2c", key: "a1" },
  { id: 4, min: 8, color: "#a50f15", key: "a2" },
  { id: 5, min: 12, color: "#d4199a", key: "a3" },
  { id: 6, min: 16, color: "#8b1fc9", key: "a4" },
  { id: 7, min: 20, color: "#5b1fb0", key: "a5" },
];

export function levelFor(dhw: number): AlertLevel {
  let lv = LEVELS[0];
  for (const l of LEVELS) if (dhw >= l.min) lv = l;
  return lv;
}

/** Continuous color ramp for DHW (0 → 24 °C-weeks), as [r, g, b] 0..255. */
const STOPS: [number, [number, number, number]][] = [
  [0, [20, 70, 100]],
  [1, [58, 155, 181]],
  [2.5, [242, 225, 75]],
  [4, [247, 165, 28]],
  [6, [239, 59, 44]],
  [8, [165, 15, 21]],
  [12, [212, 25, 154]],
  [16, [139, 31, 201]],
  [20, [75, 20, 153]],
  [24, [40, 8, 90]],
];

export function rampRGB(dhw: number): [number, number, number] {
  if (dhw <= STOPS[0][0]) return STOPS[0][1];
  for (let i = 1; i < STOPS.length; i++) {
    const [x1, c1] = STOPS[i];
    if (dhw <= x1) {
      const [x0, c0] = STOPS[i - 1];
      const t = (dhw - x0) / (x1 - x0);
      return [0, 1, 2].map((k) => Math.round(c0[k] + (c1[k] - c0[k]) * t)) as [number, number, number];
    }
  }
  return STOPS[STOPS.length - 1][1];
}

export const rampCSS = (dhw: number) => `rgb(${rampRGB(dhw).join(",")})`;

/** 256×1 RGBA lookup (index = DHW × 10, capped at 25.5) for shaders. */
export function rampTable(): Uint8Array {
  const t = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    const [r, g, b] = rampRGB(i / 10);
    t.set([r, g, b, 255], i * 4);
  }
  return t;
}

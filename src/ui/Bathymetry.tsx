import { useEffect, useState } from "react";
import { loadRegion, type Region } from "../lib/data";

// GEBCO 2023 depth contours of the Bay Islands region as SVG paths, in a caller-supplied projection.
// Used as real seafloor relief behind the home title and as chart contours in Figure 1.

export function useRegion() {
  const [region, setRegion] = useState<Region | null>(null);
  useEffect(() => {
    loadRegion().then(setRegion).catch(() => {});
  }, []);
  return region;
}

const path = (line: number[][], px: (lon: number) => number, py: (lat: number) => number) =>
  "M" + line.map(([lo, la]) => `${px(lo).toFixed(1)},${py(la).toFixed(1)}`).join("L");

/** Contour lines, heavier every 1,000 m. */
export function ContourLines({ region, px, py, opacity = 1, color = "#7fd6df" }: { region: Region; px: (lon: number) => number; py: (lat: number) => number; opacity?: number; color?: string }) {
  return (
    <g fill="none" stroke={color} strokeLinejoin="round" vectorEffect="non-scaling-stroke">
      {region.levels.map((lv) => {
        const major = lv % 1000 === 0;
        const shallow = lv > -100;
        return (
          <path
            key={lv}
            d={region.contours[String(lv)].map((l) => path(l, px, py)).join("")}
            strokeWidth={major ? 1.1 : 0.7}
            strokeOpacity={opacity * (major ? 0.5 : shallow ? 0.42 : 0.28)}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </g>
  );
}

export function Mainland({ region, px, py, fill = "#163447" }: { region: Region; px: (lon: number) => number; py: (lat: number) => number; fill?: string }) {
  return <path d={region.mainland.map((ring) => path(ring, px, py) + "Z").join("")} fill={fill} stroke="#ffffff" strokeOpacity={0.35} strokeWidth={0.8} vectorEffect="non-scaling-stroke" />;
}

/** Full-bleed relief for a dark band: contours fitted to cover the box. */
export function HeroRelief() {
  const region = useRegion();
  if (!region) return null;
  const b = region.bbox;
  const cos = Math.cos((16.2 * Math.PI) / 180);
  const K = 1000;
  const W = (b.east - b.west) * cos * K, H = (b.north - b.south) * K;
  const px = (lon: number) => (lon - b.west) * cos * K;
  const py = (lat: number) => (b.north - lat) * K;
  return (
    <svg className="relief" viewBox={`0 0 ${W.toFixed(0)} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <ContourLines region={region} px={px} py={py} opacity={0.55} />
      <Mainland region={region} px={px} py={py} fill="rgba(255,255,255,0.03)" />
    </svg>
  );
}

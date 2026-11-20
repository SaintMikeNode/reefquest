import { useEffect, useMemo, useState } from "react";
import { fmtNum, useLang, useT } from "../i18n";
import { rampCSS } from "../lib/alert";
import { SCENE_ISLANDS as AVAILABLE } from "../lib/islands";
import { loadHeatIndex, loadIslandShapes, type GeoJSON, type HeatIndex, type Latest } from "../lib/data";
import { href } from "../lib/router";
import { ContourLines, Mainland, useRegion } from "./Bathymetry";

// Figure 1: the archipelago with real OpenStreetMap coastlines and today's NOAA 5 km heat cells.
// Plain SVG in the style of a printed figure: pale sea, paper land, ink coastlines, a graticule.
const VIEW = { west: -87.1, east: -85.7, south: 15.82, north: 16.62 };
const K = 1000;
const COS = Math.cos((16.2 * Math.PI) / 180);
const W = (VIEW.east - VIEW.west) * COS * K;
const H = (VIEW.north - VIEW.south) * K;
const px = (lon: number) => (lon - VIEW.west) * COS * K;
const py = (lat: number) => (VIEW.north - lat) * K;

export function ArchipelagoMap({ latest }: { latest: Latest | null }) {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const [shapes, setShapes] = useState<GeoJSON | null>(null);
  const [grid, setGrid] = useState<HeatIndex | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const region = useRegion();

  useEffect(() => {
    loadIslandShapes().then(setShapes).catch(() => {});
    loadHeatIndex().then(setGrid).catch(() => {});
  }, []);

  const paths = useMemo(() => {
    if (!shapes) return [];
    return shapes.features.map((f) => {
      const d = f.geometry.coordinates
        .map((poly) => poly.map((ring) => "M" + ring.map(([lo, la]) => `${px(lo).toFixed(1)},${py(la).toFixed(1)}`).join("L") + "Z").join(""))
        .join("");
      let best: number[][] = [];
      for (const poly of f.geometry.coordinates) if (poly[0].length > best.length) best = poly[0];
      const xs = best.map((p) => p[0]);
      const ys = best.map((p) => p[1]);
      const minLo = Math.min(...xs), maxLo = Math.max(...xs), maxLa = Math.max(...ys), minLa = Math.min(...ys);
      return { id: f.properties.id, name: f.properties.name, d, cx: px((minLo + maxLo) / 2), top: py(maxLa), bottom: py(minLa) };
    });
  }, [shapes]);

  const cells = useMemo(() => {
    if (!grid || !latest?.grid) return [];
    const out: { x: number; y: number; w: number; h: number; v: number; land?: boolean }[] = [];
    const w = grid.cell_deg * COS * K;
    const h = grid.cell_deg * K;
    for (let r = 0; r < grid.rows; r++)
      for (let c = 0; c < grid.cols; c++) {
        const v = latest.grid[r * grid.cols + c];
        const lat = grid.lat[0] - r * grid.cell_deg;
        const lon = grid.lon[0] + c * grid.cell_deg;
        out.push({ x: px(lon - grid.cell_deg / 2), y: py(lat + grid.cell_deg / 2), w, h, v: v / 10, land: v === 255 });
      }
    return out;
  }, [grid, latest]);

  const lonTicks = [-87.0, -86.8, -86.6, -86.4, -86.2, -86.0, -85.8];
  const latTicks = [15.9, 16.1, 16.3, 16.5];
  const km10 = (10 / 111.32) * K;
  const hovered = hover && latest?.islands[hover];
  const W_ = lang === "es" ? "O" : "W";

  return (
    <div className="map-figure" style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W.toFixed(0)} ${H}`} role="img" aria-label={t("home.mapLabel")}>
        {/* Sea: a soft depth gradient from the open ocean (north) to the shelf (south). */}
        <defs>
          <linearGradient id="seaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#06304d" />
            <stop offset="1" stopColor="#0b4a69" />
          </linearGradient>
        </defs>
        <rect width={W} height={H} fill="url(#seaGrad)" />
        {/* Each NOAA 5 km cell drawn as the square it is, colored by degree heating weeks (a hairline
            gap keeps the grid legible); GEBCO depth contours on top; the mainland coast from GEBCO. */}
        <g>
          {cells.map((c, i) =>
            c.land ? null : <rect key={i} x={c.x + 0.6} y={c.y + 0.6} width={c.w - 1.2} height={c.h - 1.2} fill={rampCSS(c.v)} fillOpacity={0.78} />,
          )}
        </g>
        {region && <ContourLines region={region} px={px} py={py} color="#04182a" opacity={0.9} />}
        {region && <Mainland region={region} px={px} py={py} />}
        <g stroke="#ffffff" strokeOpacity=".14" strokeWidth="1" strokeDasharray="2 4">
          {lonTicks.map((lo) => (
            <line key={lo} x1={px(lo)} x2={px(lo)} y1={0} y2={H} />
          ))}
          {latTicks.map((la) => (
            <line key={la} x1={0} x2={W} y1={py(la)} y2={py(la)} />
          ))}
        </g>
        {paths.map((p) => {
          const ok = AVAILABLE.has(p.id);
          const go = () => (location.hash = ok ? href.island(p.id) : href.heat);
          const s = latest?.islands[p.id];
          return (
            <g
              key={p.id}
              role="link"
              tabIndex={0}
              aria-label={p.name}
              style={{ cursor: "pointer" }}
              onClick={go}
              onKeyDown={(e) => e.key === "Enter" && go()}
              onMouseEnter={() => setHover(p.id)}
              onMouseLeave={() => setHover(null)}
            >
              <path d={p.d} fill={hover === p.id ? "#ffffff" : "#e9e4d4"} stroke="#ffffff" strokeWidth="0.8" strokeOpacity="0.6" vectorEffect="non-scaling-stroke" />
              <text x={p.cx} y={p.top - 12} textAnchor="middle" fill="#ffffff" fontSize="21" fontWeight="650" fontFamily="var(--sans)">
                {p.name}
              </text>
              {s && (
                <text x={p.cx} y={p.bottom + 25} textAnchor="middle" fill="#c6d8e3" fontSize="15" fontFamily="var(--sans)" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {fmtNum(s.dhw, lang)} {t("unit.dhw")}
                </text>
              )}
            </g>
          );
        })}
        <g fill="#8ea8b9" fontSize="12.5" fontFamily="var(--sans)" style={{ fontVariantNumeric: "tabular-nums" }}>
          {lonTicks.map((lo) => (
            <text key={lo} x={px(lo) + 4} y={H - 8}>
              {Math.abs(lo).toFixed(1)}° {W_}
            </text>
          ))}
          {latTicks.map((la) => (
            <text key={la} x={6} y={py(la) - 5}>
              {la.toFixed(1)}° N
            </text>
          ))}
        </g>
        <g transform={`translate(${W - km10 - 28}, ${H - 34})`} fontFamily="var(--sans)" fontSize="12.5" fill="#ffffff">
          <rect x="0" y="0" width={km10 / 2} height="5" fill="#ffffff" />
          <rect x={km10 / 2} y="0" width={km10 / 2} height="5" fill="none" stroke="#ffffff" strokeWidth="1" />
          <text x="0" y="-6">0</text>
          <text x={km10} y="-6" textAnchor="end">
            10 km
          </text>
        </g>
        <g transform={`translate(${W - 30}, 34)`} fill="#ffffff" fontFamily="var(--sans)" fontSize="12.5">
          <path d="M0 -14 L6 6 L0 2 L-6 6 Z" />
          <text y="22" textAnchor="middle">N</text>
        </g>
        <text x={px(-86.02)} y={H - 18} fill="#9fb6c6" fontSize="13" fontFamily="var(--serif)" fontStyle="italic">
          {t("home.mainland")}
        </text>
      </svg>
      {hovered && (
        <div className="tip" style={{ position: "absolute", left: 12, top: 12 }}>
          {hovered.name}: {fmtNum(hovered.dhw, lang)} {t("unit.dhw")} · {fmtNum(hovered.sst, lang)} °C
        </div>
      )}
    </div>
  );
}

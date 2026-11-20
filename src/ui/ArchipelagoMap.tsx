import { useEffect, useMemo, useState } from "react";
import { fmtDate, fmtNum, useLang, useT } from "../i18n";
import { rampCSS } from "../lib/alert";
import { loadHeatIndex, loadIslandShapes, type GeoJSON, type HeatIndex, type Latest } from "../lib/data";
import { SCENE_ISLANDS as AVAILABLE } from "../lib/islands";
import { href } from "../lib/router";

// Live map of the archipelago: real OpenStreetMap coastlines, today's NOAA 5 km heat cells, a
// graticule and instrument marks. Plain SVG: no 3D engine on the first screen.
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
      // Label anchor: bounding box center of the largest ring.
      let best: number[][] = [];
      for (const poly of f.geometry.coordinates) if (poly[0].length > best.length) best = poly[0];
      const xs = best.map((p) => p[0]);
      const ys = best.map((p) => p[1]);
      const minLo = Math.min(...xs), maxLo = Math.max(...xs), minLa = Math.min(...ys), maxLa = Math.max(...ys);
      return { id: f.properties.id, name: f.properties.name, d, cx: px((minLo + maxLo) / 2), cy: py((minLa + maxLa) / 2), top: py(maxLa), bottom: py(minLa) };
    });
  }, [shapes]);

  const cells = useMemo(() => {
    if (!grid || !latest?.grid) return [];
    const out: { x: number; y: number; w: number; h: number; v: number }[] = [];
    const w = grid.cell_deg * COS * K;
    const h = grid.cell_deg * K;
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        const v = latest.grid[r * grid.cols + c];
        if (v === 255) continue;
        const lat = grid.lat[0] - r * grid.cell_deg;
        const lon = grid.lon[0] + c * grid.cell_deg;
        out.push({ x: px(lon - grid.cell_deg / 2), y: py(lat + grid.cell_deg / 2), w, h, v: v / 10 });
      }
    }
    return out;
  }, [grid, latest]);

  const graticule = [];
  for (let lo = -87.0; lo <= -85.75; lo += 0.1) graticule.push(<line key={`x${lo}`} x1={px(lo)} x2={px(lo)} y1={0} y2={H} />);
  for (let la = 15.9; la <= 16.6; la += 0.1) graticule.push(<line key={`y${la}`} x1={0} x2={W} y1={py(la)} y2={py(la)} />);
  const lonTicks = [-87.0, -86.8, -86.6, -86.4, -86.2, -86.0, -85.8];
  const latTicks = [15.9, 16.1, 16.3, 16.5];
  const kmPx = (10 / (111.32 * COS)) * COS * K; // 10 km in map units

  const hovered = hover && latest?.islands[hover];

  return (
    <figure className="mapwrap panel" style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W.toFixed(0)} ${H}`} role="img" aria-label={t("home.mapLabel")}>
        <defs>
          <radialGradient id="seaGlow" cx="55%" cy="40%" r="75%">
            <stop offset="0" stopColor="#06324a" />
            <stop offset="1" stopColor="#020d16" />
          </radialGradient>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect width={W} height={H} fill="url(#seaGlow)" />
        <g opacity=".9">
          {cells.map((c, i) => (
            <rect key={i} x={c.x + 1} y={c.y + 1} width={c.w - 2} height={c.h - 2} fill={rampCSS(c.v)} fillOpacity={0.12 + Math.min(c.v / 16, 1) * 0.5} />
          ))}
        </g>
        <g stroke="#5ff2ff" strokeOpacity=".08" strokeWidth="1">{graticule}</g>
        <g className="label" fill="#5b7f94" fontSize="13" fontFamily="var(--mono)">
          {lonTicks.map((lo) => (
            <text key={lo} x={px(lo) + 4} y={H - 8}>
              {Math.abs(lo).toFixed(1)}°W
            </text>
          ))}
          {latTicks.map((la) => (
            <text key={la} x={6} y={py(la) - 4}>
              {la.toFixed(1)}°N
            </text>
          ))}
        </g>
        {paths.map((p) => {
          const ok = AVAILABLE.has(p.id);
          const go = () => (location.hash = ok ? href.island(p.id) : href.heat);
          return (
            <g
              key={p.id}
              className={ok ? "island-shape" : "island-shape soon"}
              role="link"
              tabIndex={0}
              aria-label={p.name}
              onClick={go}
              onKeyDown={(e) => e.key === "Enter" && go()}
              onMouseEnter={() => setHover(p.id)}
              onMouseLeave={() => setHover(null)}
            >
              <path d={p.d} filter={ok ? "url(#glow)" : undefined} />
              <text x={p.cx} y={p.top - 14} textAnchor="middle" fill="#e6f6ff" fontSize="22" fontWeight="600" fontFamily="var(--font)" style={{ pointerEvents: "none" }}>
                {p.name}
              </text>
              {latest?.islands[p.id] && (
                <text x={p.cx} y={p.bottom + 26} textAnchor="middle" fill={rampCSS(Math.max(latest.islands[p.id].dhw, 2))} fontSize="15" fontFamily="var(--mono)" style={{ pointerEvents: "none" }}>
                  {fmtNum(latest.islands[p.id].dhw, lang)} DHW
                </text>
              )}
            </g>
          );
        })}
        {/* Scale bar and north mark */}
        <g transform={`translate(${W - kmPx - 30}, ${H - 40})`} stroke="#8fb3c7" fill="#8fb3c7" fontFamily="var(--mono)" fontSize="12">
          <line x1="0" x2={kmPx} y1="0" y2="0" />
          <line x1="0" x2="0" y1="-5" y2="5" />
          <line x1={kmPx} x2={kmPx} y1="-5" y2="5" />
          <text x={kmPx / 2} y="-9" textAnchor="middle" stroke="none">
            10 km
          </text>
        </g>
        <g transform={`translate(${W - 34}, 40)`} fill="none" stroke="#8fb3c7">
          <path d="M0 -16 L7 8 L0 3 L-7 8 Z" fill="#8fb3c7" fillOpacity=".3" />
          <text y="26" textAnchor="middle" fill="#8fb3c7" stroke="none" fontSize="12" fontFamily="var(--mono)">
            N
          </text>
        </g>
        <text x={px(-86.05)} y={H - 34} fill="#5b7f94" fontSize="13" fontFamily="var(--mono)" letterSpacing="2">
          {t("home.mainland").toUpperCase()} ↓
        </text>
      </svg>
      <div className="sweep" />
      <div className="map-hud top">
        <span className="label">{latest ? `NOAA CRW · ${fmtDate(latest.date, lang)}` : "NOAA CRW"}</span>
        {hovered && (
          <span className="label" style={{ color: "var(--ink)" }}>
            {hovered.name} · {fmtNum(hovered.dhw, lang)} DHW · {fmtNum(hovered.sst, lang)} °C
          </span>
        )}
      </div>
      <figcaption className="map-hud bottom">
        <span className="label">{t("home.mapNote")}</span>
      </figcaption>
    </figure>
  );
}

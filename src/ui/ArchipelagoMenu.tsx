import { BAY_ISLANDS_BBOX as B, ISLANDS, type IslandId } from "../data/islands";
import { useT } from "../i18n";

// Schematic 2D map of the four island groups inside the project bounding box. Islands are dots
// for now; Phase 0 brings real OpenStreetMap coastlines.
const W = 840;
const H = 500;
const x = (lon: number) => ((lon - B.west) / (B.east - B.west)) * W;
const y = (lat: number) => ((B.north - lat) / (B.north - B.south)) * H;

export function ArchipelagoMenu({ onOpen }: { onOpen: (id: IslandId) => void }) {
  const t = useT();
  return (
    <figure className="map">
      <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Islas de la Bahía">
        <rect width={W} height={H} rx="18" className="sea" />
        <text x={W - 24} y={H - 18} className="mainland">
          {t("menu.mainland")} ↓
        </text>
        {ISLANDS.map((isl) => {
          const cx = x(isl.center.lon);
          const cy = y(isl.center.lat);
          const open = () => isl.available && onOpen(isl.id);
          return (
            <g
              key={isl.id}
              className={isl.available ? "island" : "island soon"}
              role="button"
              tabIndex={isl.available ? 0 : -1}
              aria-disabled={!isl.available}
              onClick={open}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && open()}
            >
              <circle cx={cx} cy={cy} r="34" className="halo" />
              <circle cx={cx} cy={cy} r="12" className="dot" />
              <text x={cx} y={cy + 56} className="name">
                {isl.name}
              </text>
              {!isl.available && (
                <text x={cx} y={cy + 80} className="badge">
                  {t("menu.comingSoon")}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption>{t("menu.mapNote")}</figcaption>
    </figure>
  );
}

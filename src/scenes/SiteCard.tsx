import type { ReactNode } from "react";
import type { Site } from "../content/sites";
import { useL, useT } from "../i18n";

const fmtLat = (v: number) => `${Math.abs(v).toFixed(4)}°${v >= 0 ? "N" : "S"}`;
const fmtLon = (v: number) => `${Math.abs(v).toFixed(4)}°${v >= 0 ? "E" : "W"}`;
export { fmtLat, fmtLon };

/** Story / dive-site card shared by the island view and the boat. */
export function SiteCard({ site, onClose, actions }: { site: Site; onClose: () => void; actions?: ReactNode }) {
  const t = useT();
  const L = useL();
  return (
    <aside className="hud site-card panel" aria-live="polite">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
        <span className="label">
          {site.name}
          {site.depth_m ? ` · ${site.depth_m} m` : ""}
        </span>
        <button className="btn ghost" onClick={onClose} aria-label={t("scene.close")}>
          ✕
        </button>
      </div>
      {site.title && <h2>{L(site.title)}</h2>}
      {site.body && L(site.body).map((p, i) => <p key={i}>{p}</p>)}
      {actions && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "4px 0 10px" }}>{actions}</div>}
      <p className="mono faint" style={{ fontSize: 11.5 }}>
        {fmtLat(site.lat)} · {fmtLon(site.lon)}
        {site.approx ? ` · ${t("scene.approx")}` : ""}
      </p>
      <div className="label" style={{ marginTop: 8 }}>{t("scene.sources")}</div>
      <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12.5, lineHeight: 1.5 }}>
        {site.sources.map((s) => (
          <li key={s.url}>
            <a href={s.url} target="_blank" rel="noreferrer">
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}

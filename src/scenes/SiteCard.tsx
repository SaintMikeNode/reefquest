import type { ReactNode } from "react";
import type { Site } from "../content/sites";
import { useL, useLang, useT } from "../i18n";
import { IconClose } from "../ui/Icons";

export const fmtLat = (v: number, _lang: "es" | "en" = "es") => `${Math.abs(v).toFixed(4)}° ${v >= 0 ? "N" : "S"}`;
export const fmtLon = (v: number, lang: "es" | "en" = "es") => `${Math.abs(v).toFixed(4)}° ${v >= 0 ? "E" : lang === "es" ? "O" : "W"}`;

/** Story / dive-site card shared by the island view and the boat. */
export function SiteCard({ site, onClose, actions }: { site: Site; onClose: () => void; actions?: ReactNode }) {
  const t = useT();
  const L = useL();
  const lang = useLang((s) => s.lang);
  return (
    <aside className="hud site-card panel" aria-live="polite">
      <div className="card-head">
        <span className="hud-label">
          {site.name}
          {site.depth_m ? ` · ${site.depth_m} m` : ""}
        </span>
        <button className="close-btn" onClick={onClose} aria-label={t("scene.close")}>
          <IconClose />
        </button>
      </div>
      {site.title && <h2>{L(site.title)}</h2>}
      {site.body && L(site.body).map((p, i) => <p key={i}>{p}</p>)}
      {actions && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "6px 0 12px" }}>{actions}</div>}
      <p className="hud-faint num" style={{ fontSize: 12.5, margin: "0 0 8px" }}>
        {fmtLat(site.lat, lang)}, {fmtLon(site.lon, lang)}
        {site.approx ? ` · ${t("scene.approx")}` : ""}
      </p>
      <p className="sources" style={{ margin: 0 }}>
        {t("scene.sources")}:{" "}
        {site.sources.map((s, k) => (
          <span key={s.url}>
            {k > 0 && "; "}
            <a href={s.url} target="_blank" rel="noreferrer">
              {s.label}
            </a>
          </span>
        ))}
      </p>
    </aside>
  );
}

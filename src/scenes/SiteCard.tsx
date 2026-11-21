import { motion } from "motion/react";
import type { ReactNode } from "react";
import { panelMotion } from "../ui/motionPresets";
import type { Site } from "../content/sites";
import { useL, useLang, useT } from "../i18n";
import { IconClose } from "../ui/Icons";
import { PhotoStrip, usePhotos } from "../ui/PhotoStrip";

export const fmtLat = (v: number, _lang: "es" | "en" = "es") => `${Math.abs(v).toFixed(4)}° ${v >= 0 ? "N" : "S"}`;
export const fmtLon = (v: number, lang: "es" | "en" = "es") => `${Math.abs(v).toFixed(4)}° ${v >= 0 ? "E" : lang === "es" ? "O" : "W"}`;

/** Story / dive-site card shared by the island view and the boat. */
export function SiteCard({ site, onClose, actions }: { site: Site; onClose: () => void; actions?: ReactNode }) {
  const t = useT();
  const L = useL();
  const lang = useLang((s) => s.lang);
  const photos = usePhotos()?.places[site.id];
  return (
    <motion.aside className="hud site-card panel" aria-live="polite" {...panelMotion}>
      <div className="card-head">
        {/* The place name with its action (e.g. "Explore by boat") right after it; they wrap
            together when the name is long, and the close button stays in the corner. */}
        <div className="card-place">
          <span className="place-name">
            {site.name}
            {site.depth_m ? <span className="place-depth"> · {site.depth_m} m</span> : null}
          </span>
          {actions && <div className="card-actions">{actions}</div>}
        </div>
        <button className="close-btn" onClick={onClose} aria-label={t("scene.close")}>
          <IconClose />
        </button>
      </div>
      {site.title && <h2>{L(site.title)}</h2>}
      {photos && photos.length > 0 && <PhotoStrip photos={photos} />}
      {site.body && L(site.body).map((p, i) => <p key={i}>{p}</p>)}
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
    </motion.aside>
  );
}

import { useT } from "../i18n";
import { LEVELS, rampCSS } from "../lib/alert";

/** Figure key for degree heating weeks: continuous bar with NOAA's alert breakpoints. */
export function HeatKey({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const steps = Array.from({ length: 24 }, (_, i) => i + 0.5);
  return (
    <div className="key">
      <span className="key-title">{t("key.dhwTitle")}</span>
      <div className="key-bar" aria-hidden="true">
        {steps.map((v) => (
          <span key={v} style={{ background: rampCSS(v) }} />
        ))}
      </div>
      <div className="key-ticks">
        {[0, 4, 8, 12, 16, 20, 24].map((v) => (
          <span key={v}>{v}</span>
        ))}
      </div>
      {!compact && (
        <div className="key-cats">
          {LEVELS.filter((l) => l.key !== "none").map((l) => (
            <span key={l.id}>
              <i style={{ background: l.color }} />
              {t(`alert.${l.key}`)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

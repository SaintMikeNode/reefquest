import { useState } from "react";
import { fmtNum, useLang, useT } from "../i18n";
import { rampCSS } from "../lib/alert";
import type { Latest } from "../lib/data";

/** "Heat stripes": each year's maximum degree heating weeks, one row per island. */
export function HeatStripes({ latest, onPick }: { latest: Latest; onPick?: (year: number) => void }) {
  const lang = useLang((s) => s.lang);
  const t = useT();
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const years = latest.years;
  const ticks = years.filter((y) => y % 10 === 0 || y === years[0] || y === years[years.length - 1]);
  const order = ["roatan", "utila", "guanaja", "cayos-cochinos"].filter((id) => latest.islands[id]);
  return (
    <div className="stripes" onMouseLeave={() => setTip(null)}>
      {order.map((id) => {
        const isl = latest.islands[id];
        return (
          <div className="stripe-row" key={id}>
            <span className="label">{isl.name}</span>
            <div className="stripe-bar" role="group" aria-label={isl.name}>
              {isl.year_max_dhw.map((v, i) => {
                const text = `${isl.name}, ${years[i]}: ${fmtNum(v, lang)} ${t("unit.dhw")}`;
                return (
                  <button
                    key={i}
                    style={{ background: rampCSS(v) }}
                    aria-label={text}
                    onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY, text })}
                    onFocus={(e) => {
                      const r = e.currentTarget.getBoundingClientRect();
                      setTip({ x: r.left, y: r.bottom, text });
                    }}
                    onClick={() => onPick?.(years[i])}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
      <div className="stripe-axis">
        <span />
        <div>
          {ticks.map((y) => (
            <span key={y}>{y}</span>
          ))}
        </div>
      </div>
      {tip && (
        <div className="tip" style={{ left: Math.min(tip.x + 12, window.innerWidth - 220), top: tip.y + 14 }}>
          {tip.text}
        </div>
      )}
    </div>
  );
}

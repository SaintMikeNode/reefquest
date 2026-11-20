import { useState } from "react";
import { fmtNum, useLang } from "../i18n";
import { rampCSS } from "../lib/alert";
import type { Latest } from "../lib/data";

/** "Warming stripes" of the yearly maximum DHW for each island. */
export function HeatStripes({ latest }: { latest: Latest }) {
  const lang = useLang((s) => s.lang);
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const years = latest.years;
  const ticks = years.filter((y) => y % 10 === 0 || y === years[0] || y === years[years.length - 1]);
  return (
    <div className="stripes" onMouseLeave={() => setTip(null)}>
      {Object.entries(latest.islands).map(([id, isl]) => (
        <div className="stripe-row" key={id}>
          <span className="name">{isl.name}</span>
          <div className="stripe-bar" role="img" aria-label={`${isl.name}: ${years[0]}–${years[years.length - 1]}`}>
            {isl.year_max_dhw.map((v, i) => (
              <div
                key={i}
                style={{ background: rampCSS(v) }}
                onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY, text: `${isl.name} · ${years[i]} · ${fmtNum(v, lang)} °C-wk` })}
                onClick={(e) => setTip({ x: e.clientX, y: e.clientY, text: `${isl.name} · ${years[i]} · ${fmtNum(v, lang)} °C-wk` })}
              />
            ))}
          </div>
        </div>
      ))}
      <div className="stripe-axis">
        <span />
        <div className="label">
          {ticks.map((y) => (
            <span key={y}>{y}</span>
          ))}
        </div>
      </div>
      {tip && (
        <div className="tooltip mono" style={{ left: tip.x + 12, top: tip.y + 12 }}>
          {tip.text}
        </div>
      )}
    </div>
  );
}

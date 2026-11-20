import { useEffect, useMemo, useRef, useState } from "react";
import { fmtDate, fmtNum, useLang, useT } from "../i18n";
import { LEVELS } from "../lib/alert";
import { dayDiff, loadHeatIndex, loadLatest, loadSeries, type HeatIndex, type IslandSeries, type Latest } from "../lib/data";
import { HeatStripes } from "../ui/HeatStripes";

const ISLAND_COLORS: Record<string, string> = { roatan: "#5ff2ff", utila: "#f1e2bd", guanaja: "#ff6f5e", "cayos-cochinos": "#b49cff" };

export function HeatPage() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const [series, setSeries] = useState<IslandSeries | null>(null);
  const [index, setIndex] = useState<HeatIndex | null>(null);
  const [latest, setLatest] = useState<Latest | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [on, setOn] = useState<Record<string, boolean>>({ roatan: true, utila: true, guanaja: true, "cayos-cochinos": true });

  useEffect(() => {
    Promise.all([loadSeries(), loadHeatIndex(), loadLatest()]).then(([s, i, l]) => {
      setSeries(s);
      setIndex(i);
      setLatest(l);
      setYear(i.years[i.years.length - 1].year);
    });
  }, []);

  // Per island per year: peak mean DHW, days ≥ 4, days ≥ 8.
  const stats = useMemo(() => {
    if (!series || !index) return null;
    const out: Record<string, { year: number; peak: number; d4: number; d8: number }[]> = {};
    for (const [id, s] of Object.entries(series.islands)) {
      out[id] = index.years.map((y) => {
        const off = dayDiff(series.first, y.first);
        const v = s.dhw_mean.slice(off, off + y.days);
        return { year: y.year, peak: Math.max(...v) / 10, d4: v.filter((x) => x >= 40).length, d8: v.filter((x) => x >= 80).length };
      });
    }
    return out;
  }, [series, index]);

  if (!series || !index || !latest || !year || !stats)
    return (
      <main className="page">
        <div className="page-head">
          <div className="label">{t("heat.loading")}</div>
        </div>
      </main>
    );

  const worst = Object.values(stats)
    .flat()
    .reduce<Record<number, number>>((m, r) => ((m[r.year] = Math.max(m[r.year] ?? 0, r.peak)), m), {});
  const topYears = Object.entries(worst)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([y]) => Number(y));

  return (
    <main className="page">
      <header className="page-head">
        <div className="label">{t("heat.kicker")}</div>
        <h1>{t("heat.title")}</h1>
        <p>{t("heat.lead")}</p>
      </header>

      <section className="section">
        <h2>{t("heat.chartTitle")}</h2>
        <p className="lead">{t("heat.chartLead")}</p>
        <div className="panel" style={{ padding: 16 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div className="legend">
              {Object.entries(series.islands).map(([id]) => (
                <button key={id} aria-pressed={on[id]} onClick={() => setOn({ ...on, [id]: !on[id] })}>
                  <i style={{ background: ISLAND_COLORS[id] }} />
                  {latest.islands[id]?.name ?? id}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <label className="label" htmlFor="yr">
                {t("heat.year")}
              </label>
              <select id="yr" className="btn" value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ background: "var(--panel-solid)" }}>
                {[...index.years].reverse().map((y) => (
                  <option key={y.year} value={y.year}>
                    {y.year}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <YearChart series={series} index={index} year={year} on={on} names={latest} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            {topYears.sort((a, b) => b - a).map((y) => (
              <button key={y} className="btn" aria-pressed={y === year} onClick={() => setYear(y)}>
                {y}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <h2>{t("heat.recordTitle")}</h2>
        <div className="cards">
          {Object.entries(stats).map(([id, rows]) => {
            const top = [...rows].sort((a, b) => b.peak - a.peak).slice(0, 5);
            return (
              <div className="panel card" key={id}>
                <h3>
                  <span style={{ color: ISLAND_COLORS[id] }}>{latest.islands[id]?.name}</span>
                </h3>
                <table className="mono" style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse" }}>
                  <thead>
                    <tr className="label" style={{ textAlign: "left" }}>
                      <th style={{ fontWeight: 400 }}>{t("heat.year")}</th>
                      <th style={{ fontWeight: 400 }}>{t("heat.peak")}</th>
                      <th style={{ fontWeight: 400 }}>{t("heat.daysAbove4")}</th>
                      <th style={{ fontWeight: 400 }}>{t("heat.daysAbove8")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top.map((r) => (
                      <tr key={r.year} style={{ borderTop: "1px solid var(--line)", cursor: "pointer" }} onClick={() => setYear(r.year)}>
                        <td style={{ padding: "5px 0" }}>{r.year}</td>
                        <td style={{ color: LEVELS.reduce((c, l) => (r.peak >= l.min ? l.color : c), LEVELS[0].color) }}>{fmtNum(r.peak, lang)}</td>
                        <td>{r.d4}</td>
                        <td>{r.d8}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      </section>

      <section className="section">
        <div className="panel" style={{ padding: 16 }}>
          <HeatStripes latest={latest} />
        </div>
      </section>

      <section className="section">
        <h2>{t("heat.scaleTitle")}</h2>
        <div className="cards" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
          {LEVELS.map((l) => (
            <div key={l.id} className="panel card" style={{ gap: 6 }}>
              <span className="chip" style={{ color: l.color, alignSelf: "flex-start" }}>
                <i />
                {t(`alert.${l.key}`)}
              </span>
              <span className="mono" style={{ fontSize: 12 }}>
                {l.key === "none" ? "DHW = 0" : l.key === "building" ? "0 < DHW < 4" : `DHW ≥ ${l.min}`}
              </span>
              <span className="dim" style={{ fontSize: 13.5, lineHeight: 1.45 }}>{t(`alert.${l.key}.desc`)}</span>
            </div>
          ))}
        </div>
        <p className="faint" style={{ fontSize: 12.5, marginTop: 10 }}>
          NOAA Coral Reef Watch (2023). <a href="https://coralreefwatch.noaa.gov/product/5km/methodology.php">coralreefwatch.noaa.gov</a> · {t("home.dataThrough")} {fmtDate(latest.date, lang)}
        </p>
      </section>
    </main>
  );
}

function YearChart({ series, index, year, on, names }: { series: IslandSeries; index: HeatIndex; year: number; on: Record<string, boolean>; names: Latest }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const lang = useLang((s) => s.lang);
  const [tip, setTip] = useState<{ x: number; y: number; html: string } | null>(null);
  const yi = index.years.find((y) => y.year === year)!;
  const off = dayDiff(series.first, yi.first);
  const lines = Object.entries(series.islands).map(([id, s]) => ({ id, v: s.dhw_mean.slice(off, off + yi.days) }));
  const top = Math.max(10, ...lines.filter((l) => on[l.id]).flatMap((l) => l.v)) / 10;

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = c.clientWidth, H = c.clientHeight;
      c.width = W * dpr;
      c.height = H * dpr;
      const g = c.getContext("2d")!;
      g.scale(dpr, dpr);
      const L = 30, B = 22, T = 8;
      const x = (i: number) => L + (i / Math.max(yi.days - 1, 1)) * (W - L - 8);
      const y = (v: number) => T + (1 - v / (top * 1.08)) * (H - T - B);
      g.clearRect(0, 0, W, H);
      const s0 = dayDiff(yi.first, `${year}-08-01`), s1 = dayDiff(yi.first, `${year}-10-31`);
      if (s1 > 0 && s0 < yi.days) {
        g.fillStyle = "rgba(95,242,255,0.06)";
        g.fillRect(x(Math.max(0, s0)), T, x(Math.min(s1, yi.days - 1)) - x(Math.max(0, s0)), H - T - B);
      }
      g.font = "11px JetBrains Mono, monospace";
      g.fillStyle = "#5b7f94";
      for (let v = 0; v <= top * 1.05; v += top > 12 ? 4 : 2) {
        g.globalAlpha = 0.25;
        g.fillRect(L, y(v), W - L - 8, 1);
        g.globalAlpha = 1;
        g.fillText(String(v), 2, y(v) + 4);
      }
      for (const [th, col] of [[4, "#ef3b2c"], [8, "#a50f15"], [12, "#d4199a"], [16, "#8b1fc9"], [20, "#5b1fb0"]] as const) {
        if (th > top * 1.05) continue;
        g.strokeStyle = col;
        g.setLineDash([4, 4]);
        g.beginPath();
        g.moveTo(L, y(th));
        g.lineTo(W - 8, y(th));
        g.stroke();
      }
      g.setLineDash([]);
      for (let m = 0; m < 12; m++) {
        const d = dayDiff(yi.first, `${year}-${String(m + 1).padStart(2, "0")}-01`);
        if (d < 0 || d >= yi.days) continue;
        const label = new Date(Date.UTC(year, m, 1)).toLocaleDateString(lang === "es" ? "es-HN" : "en-US", { month: "short", timeZone: "UTC" });
        g.fillStyle = "#5b7f94";
        if (W > 500 || m % 2 === 0) g.fillText(label.replace(".", ""), x(d), H - 6);
      }
      for (const l of lines) {
        if (!on[l.id]) continue;
        g.strokeStyle = ISLAND_COLORS[l.id];
        g.lineWidth = 2;
        g.shadowColor = ISLAND_COLORS[l.id];
        g.shadowBlur = 6;
        g.beginPath();
        l.v.forEach((v, i) => (i ? g.lineTo(x(i), y(v / 10)) : g.moveTo(x(i), y(v / 10))));
        g.stroke();
        g.shadowBlur = 0;
      }
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(c);
    return () => ro.disconnect();
  }, [lines, on, top, yi, year, lang]);

  return (
    <div className="chart" onMouseLeave={() => setTip(null)}>
      <canvas
        ref={ref}
        style={{ height: 300 }}
        role="img"
        aria-label={`DHW ${year}`}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const i = Math.round(((e.clientX - r.left - 30) / (r.width - 38)) * (yi.days - 1));
          if (i < 0 || i >= yi.days) return setTip(null);
          const d = new Date(Date.parse(yi.first + "T12:00:00Z") + i * 864e5).toISOString().slice(0, 10);
          const rows = lines
            .filter((l) => on[l.id])
            .map((l) => `<div><span style="color:${ISLAND_COLORS[l.id]}">■</span> ${names.islands[l.id]?.name}: ${fmtNum(l.v[i] / 10, lang)}</div>`)
            .join("");
          setTip({ x: e.clientX, y: e.clientY, html: `<div class="label">${fmtDate(d, lang)}</div>${rows}` });
        }}
      />
      {tip && <div className="tooltip mono" style={{ left: tip.x + 14, top: tip.y + 14 }} dangerouslySetInnerHTML={{ __html: tip.html }} />}
    </div>
  );
}

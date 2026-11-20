import { useEffect, useMemo, useRef, useState } from "react";
import { fmtDate, fmtNum, useLang, useT } from "../i18n";
import { LEVELS } from "../lib/alert";
import { dayDiff, loadHeatIndex, loadLatest, loadSeries, type HeatIndex, type IslandSeries, type Latest } from "../lib/data";
import { AlertChip } from "../ui/AlertChip";
import { HeatKey } from "../ui/HeatKey";
import { HeatStripes } from "../ui/HeatStripes";

// Series colors: distinguishable, sober, colorblind-aware.
const ISLAND_COLORS: Record<string, string> = { roatan: "#6fb6f2", utila: "#5fd0d6", guanaja: "#ff8a6e", "cayos-cochinos": "#b9a3ff" };
const ORDER = ["roatan", "utila", "guanaja", "cayos-cochinos"];

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
          <p className="muted">{t("heat.loading")}</p>
        </div>
      </main>
    );

  const worst: Record<number, number> = {};
  for (const rows of Object.values(stats)) for (const r of rows) worst[r.year] = Math.max(worst[r.year] ?? 0, r.peak);
  const topYears = Object.entries(worst)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([y]) => Number(y))
    .sort((a, b) => b - a);

  return (
    <main className="page">
      <header className="page-head page-band-head">
        <p className="eyebrow">{t("heat.kicker")}</p>
        <h1>{t("heat.title")}</h1>
        <p className="standfirst">{t("heat.lead")}</p>
      </header>

      <section className="section">
        <figure className="figure">
          <p className="fig-title">
            {t("fig")} 3. {t("heat.chartTitle")} · <span className="num">{year}</span>
          </p>
          <p className="fig-sub">{t("heat.chartLead")}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div className="series-toggles">
              {ORDER.map((id) => (
                <label key={id}>
                  <input type="checkbox" checked={on[id]} onChange={() => setOn({ ...on, [id]: !on[id] })} />
                  <i style={{ background: ISLAND_COLORS[id] }} />
                  {latest.islands[id]?.name ?? id}
                </label>
              ))}
            </div>
            <label style={{ display: "inline-flex", gap: 8, alignItems: "center", fontSize: 14.5 }}>
              {t("heat.year")}
              <select className="select" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {[...index.years].reverse().map((y) => (
                  <option key={y.year} value={y.year}>
                    {y.year}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <YearChart series={series} index={index} year={year} on={on} names={latest} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginTop: 12 }}>
            <span className="muted" style={{ fontSize: 14 }}>
              {t("heat.worstYears")}
            </span>
            <div className="chips">
              {topYears.map((y) => (
                <button key={y} aria-pressed={y === year} onClick={() => setYear(y)}>
                  {y}
                </button>
              ))}
            </div>
          </div>
          <p className="fig-source">{t("heat.source").replace("{date}", fmtDate(latest.date, lang))}</p>
        </figure>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>{t("heat.recordTitle")}</h2>
          <p>{t("heat.recordLead")}</p>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("table.island")}</th>
              <th>{t("heat.year")}</th>
              <th className="r">{t("heat.peak")}</th>
              <th>{t("table.level")}</th>
              <th className="r">{t("heat.daysAbove4")}</th>
              <th className="r">{t("heat.daysAbove8")}</th>
            </tr>
          </thead>
          <tbody>
            {ORDER.flatMap((id) =>
              [...stats[id]]
                .sort((a, b) => b.peak - a.peak)
                .slice(0, 3)
                .map((r, i) => (
                  <tr key={id + r.year} style={{ cursor: "pointer" }} onClick={() => setYear(r.year)}>
                    <td className={i === 0 ? "name" : ""} data-label={t("table.island")}>
                      {i === 0 ? latest.islands[id]?.name : <span className="sr-only">{latest.islands[id]?.name}</span>}
                    </td>
                    <td className="num" data-label={t("heat.year")}>
                      {r.year}
                    </td>
                    <td className="r" data-label={t("heat.peak")}>
                      {fmtNum(r.peak, lang)}
                    </td>
                    <td data-label={t("table.level")}>
                      <AlertChip dhw={r.peak} />
                    </td>
                    <td className="r" data-label={t("heat.daysAbove4")}>
                      {r.d4}
                    </td>
                    <td className="r" data-label={t("heat.daysAbove8")}>
                      {r.d8}
                    </td>
                  </tr>
                )),
            )}
          </tbody>
        </table>
      </section>

      <section className="section">
        <figure className="figure">
          <p className="fig-title">
            {t("fig")} 4. {t("home.stripesTitle")}
          </p>
          <p className="fig-sub">{t("home.stripesLead")}</p>
          <HeatStripes latest={latest} onPick={(y) => setYear(y)} />
          <div style={{ marginTop: 12 }}>
            <HeatKey compact />
          </div>
        </figure>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>{t("heat.scaleTitle")}</h2>
          <p>{t("heat.scaleLead")}</p>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("table.level")}</th>
              <th>{t("heat.threshold")}</th>
              <th>{t("heat.impact")}</th>
            </tr>
          </thead>
          <tbody>
            {LEVELS.map((l) => (
              <tr key={l.id}>
                <td className="name" style={{ fontSize: 15.5 }}>
                  <span className="alert">
                    <i style={{ background: l.color }} />
                    {t(`alert.${l.key}`)}
                  </span>
                </td>
                <td className="num" data-label={t("heat.threshold")}>
                  {l.key === "none" ? "0" : l.key === "building" ? "0 – 4" : `≥ ${l.min}`} {t("unit.dhw")}
                </td>
                <td data-label={t("heat.impact")} style={{ textAlign: "left" }}>
                  {t(`alert.${l.key}.desc`)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="fig-source" style={{ marginTop: 10 }}>
          NOAA Coral Reef Watch (2023), <a href="https://coralreefwatch.noaa.gov/product/5km/methodology.php">coralreefwatch.noaa.gov</a>
        </p>
      </section>
    </main>
  );
}

function YearChart({ series, index, year, on, names }: { series: IslandSeries; index: HeatIndex; year: number; on: Record<string, boolean>; names: Latest }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const lang = useLang((s) => s.lang);
  const [tip, setTip] = useState<{ x: number; y: number; rows: string[]; date: string } | null>(null);
  const yi = index.years.find((y) => y.year === year)!;
  const off = dayDiff(series.first, yi.first);
  const lines = ORDER.filter((id) => series.islands[id]).map((id) => ({ id, v: series.islands[id].dhw_mean.slice(off, off + yi.days) }));
  const top = Math.max(8, ...lines.filter((l) => on[l.id]).flatMap((l) => l.v)) / 10;

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
      // Right margin fits the end-of-line island labels (short names on narrow screens).
      g.font = "600 12.5px 'Source Sans 3 Variable', sans-serif";
      const label = (id: string) => {
        const n = names.islands[id]?.name ?? id;
        return W < 520 ? n.replace(/^Cayos /, "C. ") : n;
      };
      const R = Math.ceil(Math.max(40, ...lines.filter((l) => on[l.id]).map((l) => g.measureText(label(l.id)).width)) + 12);
      const L = 34, B = 24, T = 10;
      const x = (i: number) => L + (i / Math.max(yi.days - 1, 1)) * (W - L - R);
      const ymax = Math.ceil((top * 1.1) / 4) * 4;
      const y = (v: number) => T + (1 - v / ymax) * (H - T - B);
      g.clearRect(0, 0, W, H);
      g.font = "12.5px 'Source Sans 3 Variable', sans-serif";
      // Bleaching season.
      const s0 = dayDiff(yi.first, `${year}-08-01`), s1 = dayDiff(yi.first, `${year}-10-31`);
      if (s1 > 0 && s0 < yi.days) {
        g.fillStyle = "rgba(255,255,255,0.045)";
        g.fillRect(x(Math.max(0, s0)), T, x(Math.min(s1, yi.days - 1)) - x(Math.max(0, s0)), H - T - B);
        g.fillStyle = "#6a879a";
        g.fillText(lang === "es" ? "temporada de blanqueamiento" : "bleaching season", x(Math.max(0, s0)) + 6, T + 14);
      }
      // Gridlines and y labels.
      for (let v = 0; v <= ymax; v += ymax > 12 ? 4 : 2) {
        g.fillStyle = v === 0 ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.08)";
        g.fillRect(L, Math.round(y(v)) + 0.5, W - L - R, 1);
        g.fillStyle = "#8ea8b9";
        g.textAlign = "right";
        g.fillText(String(v), L - 8, y(v) + 4);
      }
      g.textAlign = "left";
      // Alert thresholds labelled at the right edge.
      for (const lv of LEVELS.filter((l) => l.min >= 4 && l.min <= ymax)) {
        g.strokeStyle = lv.color;
        g.globalAlpha = 0.7;
        g.setLineDash([3, 4]);
        g.beginPath();
        g.moveTo(L, y(lv.min));
        g.lineTo(W - R, y(lv.min));
        g.stroke();
        g.setLineDash([]);
        g.globalAlpha = 1;
      }
      // Month ticks.
      g.fillStyle = "#8ea8b9";
      for (let m = 0; m < 12; m++) {
        const d = dayDiff(yi.first, `${year}-${String(m + 1).padStart(2, "0")}-01`);
        if (d < 0 || d >= yi.days) continue;
        const mon = new Date(Date.UTC(year, m, 1)).toLocaleDateString(lang === "es" ? "es-HN" : "en-US", { month: "short", timeZone: "UTC" }).replace(".", "");
        if (W > 520 || m % 2 === 0) g.fillText(mon, x(d) + 2, H - 6);
      }
      // Series, directly labelled at the end of each line.
      const ends: { y: number; id: string; v: number }[] = [];
      for (const l of lines) {
        if (!on[l.id] || !l.v.length) continue;
        g.strokeStyle = ISLAND_COLORS[l.id];
        g.lineWidth = 2;
        g.beginPath();
        l.v.forEach((v, i) => (i ? g.lineTo(x(i), y(v / 10)) : g.moveTo(x(i), y(v / 10))));
        g.stroke();
        ends.push({ y: y(l.v[l.v.length - 1] / 10), id: l.id, v: l.v[l.v.length - 1] / 10 });
      }
      ends.sort((a, b) => a.y - b.y);
      for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 14) ends[i].y = ends[i - 1].y + 14;
      g.font = "600 12.5px 'Source Sans 3 Variable', sans-serif";
      for (const e of ends) {
        g.fillStyle = ISLAND_COLORS[e.id];
        g.fillText(label(e.id), W - R + 6, e.y + 4);
      }
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(c);
    return () => ro.disconnect();
  }, [lines, on, top, yi, year, lang, names]);

  return (
    <div className="chart" onMouseLeave={() => setTip(null)} style={{ position: "relative" }}>
      <canvas
        ref={ref}
        style={{ height: 320 }}
        role="img"
        aria-label={`DHW ${year}`}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const i = Math.round(((e.clientX - r.left - 34) / (r.width - 98)) * (yi.days - 1));
          if (i < 0 || i >= yi.days) return setTip(null);
          const d = new Date(Date.parse(yi.first + "T12:00:00Z") + i * 864e5).toISOString().slice(0, 10);
          setTip({
            x: e.clientX,
            y: e.clientY,
            date: fmtDate(d, lang),
            rows: lines.filter((l) => on[l.id]).map((l) => `${names.islands[l.id]?.name}: ${fmtNum(l.v[i] / 10, lang)}`),
          });
        }}
      />
      {tip && (
        <div className="tip" style={{ left: Math.min(tip.x + 14, window.innerWidth - 200), top: tip.y + 14 }}>
          <div style={{ fontWeight: 600 }}>{tip.date}</div>
          {tip.rows.map((r) => (
            <div key={r}>{r}</div>
          ))}
        </div>
      )}
    </div>
  );
}

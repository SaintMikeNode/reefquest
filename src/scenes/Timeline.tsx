import { useEffect, useRef, useState } from "react";
import { fmtDate, fmtNum, useLang, useT } from "../i18n";
import { rampCSS } from "../lib/alert";
import { addDays, dayDiff, loadLatest, loadSeries, loadYearGrid, type HeatIndex, type IslandSeries, type Latest } from "../lib/data";
import { AlertChip } from "../ui/AlertChip";
import { useScene } from "./sceneStore";

/** Year chips + a DHW chart of the selected year for this island + scrubber + play. */
export function Timeline({ index, island }: { index: HeatIndex; island: string }) {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const year = useScene((s) => s.year);
  const day = useScene((s) => s.day);
  const playing = useScene((s) => s.playing);
  const { setYear, setDay, setPlaying } = useScene.getState();
  const [series, setSeries] = useState<IslandSeries | null>(null);
  const [latest, setLatest] = useState<Latest | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const yearsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSeries().then(setSeries).catch(() => {});
    loadLatest().then(setLatest).catch(() => {});
  }, []);

  const yi = index.years.find((y) => y.year === year) ?? index.years[index.years.length - 1];
  const offset = series ? dayDiff(series.first, yi.first) : 0;
  const values = series ? series.islands[island].dhw_mean.slice(offset, offset + yi.days) : [];
  const date = addDays(yi.first, day);
  const dhwNow = values[day] !== undefined ? values[day] / 10 : null;

  // Keep the selected year chip in view.
  useEffect(() => {
    const el = yearsRef.current?.querySelector<HTMLButtonElement>(`[data-y="${year}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [year]);

  // Prefetch the next year so playback doesn't stall.
  useEffect(() => {
    if (playing) loadYearGrid(year + 1).catch(() => {});
  }, [playing, year]);

  // Playback: ~3 days per frame step at 30 fps; continues into the next year.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < 33) return;
      last = now;
      const s = useScene.getState();
      const cur = index.years.find((y) => y.year === s.year);
      if (!cur) return;
      const next = s.day + 3;
      if (next < cur.days) s.setDay(next);
      else {
        const ny = index.years.find((y) => y.year === s.year + 1);
        if (ny) s.setYear(ny.year, 0);
        else s.setPlaying(false);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, index]);

  // Draw the year's chart.
  useEffect(() => {
    const c = canvas.current;
    if (!c || !values.length) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = c.clientWidth, H = c.clientHeight;
    c.width = W * dpr;
    c.height = H * dpr;
    const g = c.getContext("2d")!;
    g.scale(dpr, dpr);
    g.clearRect(0, 0, W, H);
    const days = yi.days;
    const top = Math.max(100, ...values) / 10; // at least 0–10 DHW so quiet years look quiet
    const x = (i: number) => (i / Math.max(days - 1, 1)) * W;
    const y = (v: number) => H - 14 - (v / top) * (H - 22);
    // Bleaching season band (Aug 1 – Oct 31).
    const s0 = dayDiff(yi.first, `${year}-08-01`), s1 = dayDiff(yi.first, `${year}-10-31`);
    if (s1 > 0 && s0 < days) {
      g.fillStyle = "rgba(95,242,255,0.06)";
      g.fillRect(x(Math.max(s0, 0)), 0, x(Math.min(s1, days - 1)) - x(Math.max(s0, 0)), H - 14);
    }
    // Thresholds.
    g.font = "10px JetBrains Mono, monospace";
    for (const [th, col] of [[4, "#ef3b2c"], [8, "#a50f15"], [12, "#d4199a"], [16, "#8b1fc9"]] as const) {
      if (th > top) continue;
      g.strokeStyle = col;
      g.globalAlpha = 0.6;
      g.setLineDash([3, 4]);
      g.beginPath();
      g.moveTo(0, y(th));
      g.lineTo(W, y(th));
      g.stroke();
      g.setLineDash([]);
      g.globalAlpha = 0.9;
      g.fillStyle = col;
      g.fillText(String(th), W - 16, y(th) - 3);
    }
    g.globalAlpha = 1;
    // Area, colored by value.
    for (let i = 1; i < values.length; i++) {
      const v = values[i] / 10;
      g.fillStyle = rampCSS(Math.max(v, 0.5));
      g.globalAlpha = 0.55;
      g.fillRect(x(i - 1), y(v), Math.max(1, x(i) - x(i - 1) + 0.5), H - 14 - y(v));
    }
    g.globalAlpha = 1;
    g.strokeStyle = "#e6f6ff";
    g.lineWidth = 1.2;
    g.beginPath();
    values.forEach((v, i) => (i ? g.lineTo(x(i), y(v / 10)) : g.moveTo(x(i), y(v / 10))));
    g.stroke();
    // Month ticks.
    g.fillStyle = "#5b7f94";
    for (let m = 0; m < 12; m++) {
      const d = dayDiff(yi.first, `${year}-${String(m + 1).padStart(2, "0")}-01`);
      if (d < 0 || d >= days) continue;
      g.fillRect(x(d), H - 12, 1, 4);
      const label = new Date(Date.UTC(year, m, 1)).toLocaleDateString(lang === "es" ? "es-HN" : "en-US", { month: "short", timeZone: "UTC" });
      if (W > 420 || (W > 260 ? m % 2 === 0 : m % 3 === 0)) g.fillText(label.replace(".", ""), x(d) + 3, H - 2);
    }
    // Cursor.
    g.strokeStyle = "#5ff2ff";
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(x(day), 0);
    g.lineTo(x(day), H - 14);
    g.stroke();
    if (dhwNow !== null) {
      g.fillStyle = "#5ff2ff";
      g.beginPath();
      g.arc(x(day), y(dhwNow), 3.5, 0, Math.PI * 2);
      g.fill();
    }
  }, [values, day, year, yi, lang, dhwNow]);

  const roatanIdx = latest ? Object.keys(latest.islands).indexOf(island) : -1;
  const yearMaxes = latest && roatanIdx >= 0 ? latest.islands[island].year_max_dhw : [];

  return (
    <div className="timeline">
      <div className="controls">
        <button
          className="btn"
          aria-pressed={playing}
          onClick={() => {
            if (!playing && day >= yi.days - 1 && year === index.years[index.years.length - 1].year) setYear(index.years[0].year, 0);
            setPlaying(!playing);
          }}
          aria-label={playing ? t("scene.pause") : t("scene.play")}
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <div>
          <div className="date">{fmtDate(date, lang)}</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 2 }}>
            <span className="mono dim" style={{ fontSize: 12 }}>
              DHW {dhwNow !== null ? fmtNum(dhwNow, lang) : "–"}
            </span>
            {dhwNow !== null && <AlertChip dhw={dhwNow} />}
          </div>
        </div>
      </div>
      <div className="track">
        <canvas ref={canvas} aria-hidden="true" />
        <input
          type="range"
          min={0}
          max={yi.days - 1}
          value={Math.min(day, yi.days - 1)}
          onChange={(e) => {
            setPlaying(false);
            setDay(Number(e.target.value));
          }}
          aria-label={fmtDate(date, lang)}
        />
      </div>
      <div className="years" ref={yearsRef}>
        {index.years.map((y, i) => (
          <button
            key={y.year}
            data-y={y.year}
            className={[y.year === year ? "on" : "", (yearMaxes[i] ?? 0) >= 8 ? "event" : ""].join(" ")}
            title={yearMaxes[i] !== undefined ? `${t("card.record")}: ${fmtNum(yearMaxes[i], lang)} DHW` : undefined}
            onClick={() => {
              setPlaying(false);
              // Jump to the year's peak heat stress (or its last day).
              let best = y.days - 1;
              if (series) {
                const off = dayDiff(series.first, y.first);
                const v = series.islands[island].dhw_mean.slice(off, off + y.days);
                const m = Math.max(...v);
                if (m > 0) best = v.indexOf(m);
              }
              setYear(y.year, best);
            }}
          >
            {y.year}
          </button>
        ))}
      </div>
    </div>
  );
}

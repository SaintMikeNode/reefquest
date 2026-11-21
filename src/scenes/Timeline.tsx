import { useEffect, useRef, useState } from "react";
import { fmtDate, fmtNum, useLang, useT } from "../i18n";
import { rampCSS } from "../lib/alert";
import { addDays, dayDiff, loadLatest, loadSeries, loadYearGrid, type HeatIndex, type IslandSeries, type Latest } from "../lib/data";
import { AlertChip } from "../ui/AlertChip";
import { IconPause, IconPlay } from "../ui/Icons";
import { LITE } from "../lib/device";
import { useScene } from "./sceneStore";

/** Timebar: date and play on the left; the selected year's heat curve with a scrubber; and a
 *  full-width strip of every year since 1985 (colored by its peak), so nothing scrolls sideways. */
/** Year label position along the strip; the ones at the ends lean inward so they stay inside. */
const yearTick = (pct: number): React.CSSProperties => ({ left: `${pct}%`, transform: `translateX(${pct < 5 ? -15 : pct > 95 ? -85 : -50}%)` });

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
  // The play button invites a first press (a pulsing sonar ring) until someone has pressed it once.
  const [played, setPlayed] = useState(() => {
    try {
      return !!localStorage.getItem("rq-played");
    } catch {
      return false;
    }
  });
  const markPlayed = () => {
    if (played) return;
    setPlayed(true);
    try {
      localStorage.setItem("rq-played", "1");
    } catch {
      /* storage blocked */
    }
  };

  useEffect(() => {
    loadSeries().then(setSeries).catch(() => {});
    loadLatest().then(setLatest).catch(() => {});
  }, []);

  const yi = index.years.find((y) => y.year === year) ?? index.years[index.years.length - 1];
  const offset = series ? dayDiff(series.first, yi.first) : 0;
  const values = series ? series.islands[island].dhw_mean.slice(offset, offset + yi.days) : [];
  const date = addDays(yi.first, day);
  const dhwNow = values[day] !== undefined ? values[day] / 10 : null;
  const yearMax = latest?.islands[island]?.year_max_dhw ?? [];

  useEffect(() => {
    if (playing) loadYearGrid(year + 1).catch(() => {});
  }, [playing, year]);

  // Playback: 6 days per step at 30 fps (about 2 s a year, Tulio: faster); continues into the next
  // year. The intro on entering an island plays this year at 4 days a step (under 3 s; lite devices
  // 8 days every other frame).
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const s = useScene.getState();
      const slow = s.intro && LITE;
      if (now - last < (slow ? 66 : 33)) return;
      last = now;
      const cur = index.years.find((y) => y.year === s.year);
      if (!cur) return;
      const next = s.day + (s.intro ? (slow ? 8 : 4) : 6);
      if (next < cur.days) s.setDay(next);
      else {
        const ny = index.years.find((y) => y.year === s.year + 1);
        if (ny) s.setYear(ny.year, 0);
        else {
          s.setDay(cur.days - 1); // stop on the latest day
          s.setPlaying(false);
        }
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, index]);

  // The selected year's curve.
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
    const top = Math.max(100, ...values) / 10;
    const x = (i: number) => (i / Math.max(days - 1, 1)) * W;
    const y = (v: number) => H - 13 - (v / top) * (H - 18);
    const s0 = dayDiff(yi.first, `${year}-08-01`), s1 = dayDiff(yi.first, `${year}-10-31`);
    if (s1 > 0 && s0 < days) {
      g.fillStyle = "rgba(255,255,255,0.05)";
      g.fillRect(x(Math.max(s0, 0)), 0, x(Math.min(s1, days - 1)) - x(Math.max(s0, 0)), H - 13);
    }
    g.font = "11px 'Inter Variable', sans-serif";
    // Alert thresholds: hairlines, numbered at the left (the curve is usually low in January), and
    // only every other one when they are crowded (phones have a short chart).
    const gap = y(0) - y(4);
    for (const th of [4, 8, 12, 16]) {
      if (th > top) continue;
      g.fillStyle = "rgba(255,255,255,0.14)";
      g.fillRect(0, Math.round(y(th)) + 0.5, W, 1);
      if (gap < 11 && th % 8) continue;
      g.fillStyle = "rgba(238,242,245,0.5)";
      g.fillText(String(th), 2, y(th) - 2);
    }
    for (let i = 1; i < values.length; i++) {
      const v = values[i] / 10;
      g.fillStyle = rampCSS(Math.max(v, 0.6));
      g.globalAlpha = 0.5;
      g.fillRect(x(i - 1), y(v), Math.max(1, x(i) - x(i - 1) + 0.5), H - 13 - y(v));
    }
    g.globalAlpha = 1;
    g.strokeStyle = "#eef2f5";
    g.lineWidth = 1.3;
    g.beginPath();
    values.forEach((v, i) => (i ? g.lineTo(x(i), y(v / 10)) : g.moveTo(x(i), y(v / 10))));
    g.stroke();
    g.fillStyle = "rgba(238,242,245,0.55)";
    let lastRight = -Infinity;
    for (let m = 0; m < 12; m++) {
      const d = dayDiff(yi.first, `${year}-${String(m + 1).padStart(2, "0")}-01`);
      if (d < 0 || d >= days) continue;
      const label = new Date(Date.UTC(year, m, 1)).toLocaleDateString(lang === "es" ? "es-HN" : "en-US", { month: "short", timeZone: "UTC" }).replace(".", "");
      if (!(W > 460 || (W > 260 ? m % 2 === 0 : m % 3 === 0))) continue;
      // Kept inside the chart (the last month used to be cut off at the right edge).
      const tw = g.measureText(label).width, lx = Math.min(x(d) + 2, W - tw - 1);
      if (lx < lastRight + 4) continue;
      g.fillText(label, lx, H - 1);
      lastRight = lx + tw;
    }
    g.strokeStyle = "#ffffff";
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(x(day), 0);
    g.lineTo(x(day), H - 13);
    g.stroke();
    if (dhwNow !== null) {
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.arc(x(day), y(dhwNow), 3.5, 0, Math.PI * 2);
      g.fill();
    }
  }, [values, day, year, yi, lang, dhwNow]);

  const peakDay = (yr: { year: number; first: string; days: number }) => {
    if (!series) return yr.days - 1;
    const off = dayDiff(series.first, yr.first);
    const v = series.islands[island].dhw_mean.slice(off, off + yr.days);
    const m = Math.max(...v);
    return m > 0 ? v.indexOf(m) : yr.days - 1;
  };

  const first = index.years[0].year, lastY = index.years[index.years.length - 1].year;
  // Axis labels: the first and last years and every decade, plus the year on screen in white;
  // labels that would run into the year on screen step aside for it. On phones a decade within six
  // years of the first label (1990) is hidden: it ran into 1985.
  const ticks = [first, ...index.years.map((y) => y.year).filter((y) => y % 10 === 0 && y - first > 3 && lastY - y > 3), lastY]
    .filter((y) => y === year || Math.abs(y - year) > 4);
  if (!ticks.includes(year)) ticks.push(year);

  return (
    <>
      <div className="now">
        <button
          className={played ? "play-btn" : "play-btn invite"}
          aria-pressed={playing}
          onClick={() => {
            if (!playing && day >= yi.days - 1 && year === lastY) setYear(first, 0);
            setPlaying(!playing);
            markPlayed();
          }}
          aria-label={playing ? t("scene.pause") : t("scene.play")}
        >
          {playing ? <IconPause /> : <IconPlay />}
        </button>
        <div>
          <div className="date">{fmtDate(date, lang)}</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13.5, marginTop: 2 }}>
            <span className="hud-value">{dhwNow !== null ? fmtNum(dhwNow, lang) : "–"} {t("unit.dhw")}</span>
            {dhwNow !== null && <AlertChip dhw={dhwNow} />}
          </div>
        </div>
      </div>
      <div className="curve">
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
      <div className="timebar-key">{t("scene.timebarKey")}</div>
      <div className="timebar-key-short">{t("scene.timebarKeyShort")}</div>
      <div className="yearstrip" role="group" aria-label={t("heat.year")}>
        {index.years.map((y, i) => (
          <button
            key={y.year}
            className={y.year === year ? "on" : undefined}
            style={{ background: rampCSS(yearMax[i] ?? 0) }}
            title={`${y.year}${yearMax[i] !== undefined ? ` · ${fmtNum(yearMax[i], lang)} ${t("unit.dhw")}` : ""}`}
            aria-label={String(y.year)}
            aria-pressed={y.year === year}
            onClick={() => {
              setPlaying(false);
              setYear(y.year, peakDay(y));
            }}
          />
        ))}
      </div>
      <div className="year-axis">
        {ticks.map((y, i) => (
          <span key={`${y}-${i}`} className={y === year ? "on" : y !== first && y - first <= 6 ? "near-start" : undefined} style={yearTick(((y - first + 0.5) / index.years.length) * 100)}>
            {y}
          </span>
        ))}
      </div>
    </>
  );
}

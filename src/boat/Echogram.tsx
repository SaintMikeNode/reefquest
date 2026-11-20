import { useEffect, useRef } from "react";
import { BENTHIC } from "../scenes/materials";
import { echo, ECHO_N } from "./echo";

/** Scrolling echosounder strip: water column echoes over the seabed profile of the last minute. */
export function Echogram() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (now - last < 100) return;
      last = now;
      const c = ref.current;
      if (!c) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = c.clientWidth, H = c.clientHeight;
      if (c.width !== W * dpr) {
        c.width = W * dpr;
        c.height = H * dpr;
      }
      const g = c.getContext("2d")!;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      const n = echo.count;
      if (!n) return;
      let maxD = 5;
      for (let k = 0; k < n; k++) maxD = Math.max(maxD, echo.depth[(echo.head - 1 - k + ECHO_N) % ECHO_N]);
      maxD = Math.ceil(Math.min(maxD, 60) / 5) * 5;
      const y = (d: number) => 4 + (Math.min(d, maxD) / maxD) * (H - 8);
      const step = W / ECHO_N;
      // Water column speckle (fish / plankton echoes), seeded so it scrolls with the data.
      for (let k = 0; k < n; k++) {
        const idx = (echo.head - 1 - k + ECHO_N) % ECHO_N;
        const x = W - k * step;
        const d = echo.depth[idx];
        const s = Math.sin(idx * 12.9898) * 43758.5453;
        const r = s - Math.floor(s);
        if (r > 0.82 && d > 2) {
          g.fillStyle = `rgba(106,227,238,${0.25 + (r - 0.82) * 2})`;
          g.fillRect(x, y(d * (0.2 + r * 0.6)), 1.5, 1.5);
        }
      }
      // Seabed: a bright return line, then the bottom colored by habitat.
      for (let k = 0; k < n; k++) {
        const idx = (echo.head - 1 - k + ECHO_N) % ECHO_N;
        const x = W - (k + 1) * step;
        const d = echo.depth[idx];
        if (d <= 0) continue;
        const b = echo.benthic[idx];
        g.fillStyle = BENTHIC[b]?.color ?? "#6b6450";
        g.globalAlpha = 0.55;
        g.fillRect(x, y(d), step + 0.6, H - y(d));
        g.globalAlpha = 1;
        g.fillStyle = "#fff4c2";
        g.fillRect(x, y(d) - 1, step + 0.6, 2);
      }
      // Depth scale.
      g.fillStyle = "rgba(238,242,245,0.6)";
      g.font = "10px 'Inter Variable', sans-serif";
      g.fillText("0", 3, 11);
      g.fillText(`${maxD} m`, 3, H - 3);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="echogram" aria-hidden="true" />;
}

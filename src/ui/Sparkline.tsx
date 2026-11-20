import { rampCSS } from "../lib/alert";

/** Small area chart of DHW (values × 10) with the Alert 1 / Alert 2 thresholds. */
export function Sparkline({ values, label }: { values: number[]; label: string }) {
  const W = 240;
  const H = 44;
  const max = Math.max(90, ...values) / 10;
  const x = (i: number) => (i / (values.length - 1)) * W;
  const y = (v: number) => H - 2 - (v / max) * (H - 6);
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v / 10).toFixed(1)}`).join(" ");
  const last = values[values.length - 1] / 10;
  const gid = `g${Math.round(last * 100)}${values.length}`;
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={label}>
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={rampCSS(last)} stopOpacity=".55" />
          <stop offset="1" stopColor={rampCSS(last)} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[4, 8].map((th) => (
        <line key={th} x1="0" x2={W} y1={y(th)} y2={y(th)} stroke={th === 4 ? "#ef3b2c" : "#a50f15"} strokeOpacity=".55" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
      ))}
      <polygon points={`0,${H} ${pts} ${W},${H}`} fill={`url(#${gid})`} />
      <polyline points={pts} fill="none" stroke={rampCSS(Math.max(last, 1.5))} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
      <circle cx={W} cy={y(last)} r="2.5" fill="#fff" />
    </svg>
  );
}

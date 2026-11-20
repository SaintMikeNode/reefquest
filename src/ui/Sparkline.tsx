/** Small line chart of DHW (values × 10) with the Alert 1 threshold, for light pages. */
export function Sparkline({ values, label, dark = true }: { values: number[]; label: string; dark?: boolean }) {
  const W = 160, H = 34;
  const max = Math.max(80, ...values) / 10;
  const x = (i: number) => (i / (values.length - 1)) * W;
  const y = (v: number) => H - 2 - (v / max) * (H - 5);
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v / 10).toFixed(1)}`).join(" ");
  const ink = dark ? "#eef2f5" : "#14304f";
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={label}>
      <line x1="0" x2={W} y1={y(4)} y2={y(4)} stroke="#ff8a6e" strokeOpacity=".7" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
      <polygon points={`0,${H} ${pts} ${W},${H}`} fill={ink} fillOpacity=".1" />
      <polyline points={pts} fill="none" stroke={ink} strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
      <circle cx={W} cy={y(values[values.length - 1] / 10)} r="2.4" fill={ink} />
    </svg>
  );
}

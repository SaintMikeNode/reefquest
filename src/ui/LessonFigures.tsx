import { fmtNum, useL, useLang } from "../i18n";
import { rampCSS } from "../lib/alert";

// Explanatory figures for the Learn page, drawn as line art in the site's figure style.

/** A coral polyp in three states: healthy, stressed, bleached (and the way back). */
export function BleachingFigure() {
  const L = useL();
  const states = [
    { tissue: "#b8874c", algae: 22, label: { es: "Sano", en: "Healthy" }, note: { es: "Las algas dentro del tejido le dan comida y color.", en: "Algae inside the tissue give it food and color." } },
    { tissue: "#d8b98a", algae: 8, label: { es: "Estresado", en: "Stressed" }, note: { es: "Semanas de agua demasiado caliente: expulsa las algas.", en: "Weeks of too-warm water: it expels the algae." } },
    { tissue: "#f3efe6", algae: 0, label: { es: "Blanqueado", en: "Bleached" }, note: { es: "Tejido transparente sobre el esqueleto blanco. Aún vive.", en: "See-through tissue over the white skeleton. Still alive." } },
  ];
  return (
    <figure className="figure lesson-fig">
      <svg viewBox="0 -34 720 304" role="img" aria-label={L({ es: "Tres estados de un pólipo de coral", en: "Three states of a coral polyp" })}>
        <defs>
          <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="#8ea8b9" />
          </marker>
        </defs>
        {states.map((s, i) => {
          const cx = 120 + i * 240;
          return (
            <g key={i}>
              <Polyp cx={cx} tissue={s.tissue} algae={s.algae} bleached={i === 2} />
              <text x={cx} y={214} textAnchor="middle" fill="#f2f8fb" fontFamily="var(--serif)" fontSize="19" fontWeight="600">
                {L(s.label)}
              </text>
              <foreignObject x={cx - 105} y={224} width="210" height="46">
                <p className="svg-note">{L(s.note)}</p>
              </foreignObject>
            </g>
          );
        })}
        <path d="M205 110 H 275" stroke="#8ea8b9" strokeWidth="1.5" markerEnd="url(#arr)" />
        <path d="M445 110 H 515" stroke="#8ea8b9" strokeWidth="1.5" markerEnd="url(#arr)" />
        <text x="240" y="98" textAnchor="middle" fill="#ff8a6e" fontSize="13" fontFamily="var(--sans)">
          +°C
        </text>
        <text x="480" y="98" textAnchor="middle" fill="#ff8a6e" fontSize="13" fontFamily="var(--sans)">
          +°C
        </text>
        {/* The way back: if the water cools soon, algae can return. */}
        <path d="M590 20 C 530 -26, 210 -26, 150 18" fill="none" stroke="#5fd0d6" strokeWidth="1.3" strokeDasharray="4 4" markerEnd="url(#arr)" />
        <text x="370" y="-22" textAnchor="middle" fill="#5fd0d6" fontSize="13" fontFamily="var(--sans)">
          {L({ es: "si el agua se enfría pronto, las algas pueden volver", en: "if the water cools soon, the algae can come back" })}
        </text>
      </svg>
      <p className="fig-caption">{L({ es: "Esquema simplificado de un pólipo (no a escala). Cada pólipo mide unos milímetros; una colonia tiene miles.", en: "Simplified diagram of one polyp (not to scale). Each polyp is a few millimeters across; a colony has thousands." })}</p>
    </figure>
  );
}

function Polyp({ cx, tissue, algae, bleached }: { cx: number; tissue: string; algae: number; bleached: boolean }) {
  const base = 178;
  const tent = Array.from({ length: 9 }, (_, i) => {
    const a = -Math.PI / 2 + ((i - 4) / 4) * 1.05;
    const x0 = cx + Math.cos(a) * 34, y0 = 96 + Math.sin(a) * 10;
    const x1 = cx + Math.cos(a) * 62, y1 = 58 + Math.sin(a) * 40 + Math.abs(i - 4) * 6;
    return `M${x0.toFixed(1)} ${y0.toFixed(1)} Q ${((x0 + x1) / 2 + (i - 4) * 2).toFixed(1)} ${(y0 - 30).toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  });
  const dots = Array.from({ length: algae }, (_, i) => {
    const t = (i * 0.61803) % 1, u = (i * 0.414) % 1;
    return { x: cx - 30 + t * 60, y: 104 + u * 64 };
  });
  return (
    <g>
      {/* Skeleton cup (corallite) */}
      <path d={`M${cx - 52} ${base} L${cx - 44} ${base - 74} M${cx + 52} ${base} L${cx + 44} ${base - 74} M${cx - 60} ${base} H${cx + 60}`} stroke="#e8e2d2" strokeWidth="2" fill="none" />
      {/* Tissue: column and tentacles. Bleached: the white skeleton shows through clear tissue. */}
      <path d={`M${cx - 44} ${base - 2} C ${cx - 46} 140, ${cx - 40} 104, ${cx - 34} 96 H ${cx + 34} C ${cx + 40} 104, ${cx + 46} 140, ${cx + 44} ${base - 2} Z`} fill={bleached ? "#ece6d8" : tissue} fillOpacity={0.94} stroke={bleached ? "#ffffff" : "none"} strokeOpacity={0.7} strokeDasharray={bleached ? "3 3" : undefined} />
      {[-30, -15, 0, 15, 30].map((d) => (
        <path key={d} d={`M${cx + d} ${base} L${cx + d * 0.85} ${base - 70}`} stroke={bleached ? "#a39b88" : "#e8e2d2"} strokeWidth="1" strokeOpacity={bleached ? 0.9 : 0.2} />
      ))}
      {tent.map((d, i) => (
        <path key={i} d={d} stroke={bleached ? "#e6ebee" : tissue} strokeOpacity={bleached ? 0.55 : 0.95} strokeWidth="6" strokeLinecap="round" fill="none" />
      ))}
      <ellipse cx={cx} cy={96} rx={14} ry={4} fill="#3a2a18" fillOpacity={bleached ? 0.2 : 0.6} />
      {dots.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2.6} fill="#5c7a2a" />
      ))}
    </g>
  );
}

/** How degree heating weeks add up: a worked example over a 12-week window (illustrative numbers). */
export function DhwFigure() {
  const L = useL();
  const lang = useLang((s) => s.lang);
  const MMM = 29.0; // "normal warmest month" for this example
  const days = 84;
  const sst = Array.from({ length: days }, (_, d) => {
    const w = d / 7;
    return 28.7 + 1.9 / (1 + Math.exp(-(w - 4.5) * 1.1)) - 0.35 / (1 + Math.exp(-(w - 10) * 1.4)) + Math.sin(d * 0.9) * 0.08 + Math.sin(d * 0.37) * 0.1;
  });
  const hot = sst.map((s) => s - MMM);
  const counted = hot.map((h) => (h >= 1 ? h : 0));
  const dhw: number[] = [];
  counted.reduce((acc, h, i) => ((dhw[i] = acc + h / 7), acc + h / 7), 0);
  const total = dhw[days - 1];

  const W = 720, H = 300, l = 52, r = 160, t = 22, b = 44;
  const x = (d: number) => l + (d / (days - 1)) * (W - l - r);
  const y = (v: number) => t + (1 - (v - 28.2) / (31 - 28.2)) * (H - t - b);
  const line = sst.map((v, d) => `${d ? "L" : "M"}${x(d).toFixed(1)} ${y(v).toFixed(1)}`).join("");
  const area =
    sst.map((v, d) => `${d ? "L" : "M"}${x(d).toFixed(1)} ${y(hot[d] >= 1 ? v : MMM + 1).toFixed(1)}`).join("") +
    sst.map((_, d) => `L${x(days - 1 - d).toFixed(1)} ${y(MMM + 1).toFixed(1)}`).join("") + "Z";
  // DHW meter on the right
  const mx = W - r + 52, mt = t, mb = H - b, mmax = 12;
  const my = (v: number) => mb - (v / mmax) * (mb - mt);

  return (
    <figure className="figure lesson-fig">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={L({ es: "Ejemplo de cómo se suman las semanas-grado de calentamiento", en: "Example of how degree heating weeks add up" })}>
        {[28.5, 29, 29.5, 30, 30.5].map((v) => (
          <g key={v}>
            <line x1={l} x2={W - r} y1={y(v)} y2={y(v)} stroke="#ffffff" strokeOpacity="0.07" />
            <text x={l - 8} y={y(v) + 4} textAnchor="end" fill="#8ea8b9" fontSize="12" fontFamily="var(--mono)">
              {fmtNum(v, lang)}
            </text>
          </g>
        ))}
        <text x={l - 8} y={t - 8} textAnchor="end" fill="#8ea8b9" fontSize="12" fontFamily="var(--sans)">
          °C
        </text>
        {Array.from({ length: 13 }, (_, w) => (
          <text key={w} x={x(Math.min(w * 7, days - 1))} y={H - b + 18} textAnchor="middle" fill="#8ea8b9" fontSize="11.5" fontFamily="var(--mono)">
            {w}
          </text>
        ))}
        <text x={(l + W - r) / 2} y={H - 6} textAnchor="middle" fill="#8ea8b9" fontSize="12" fontFamily="var(--sans)">
          {L({ es: "semanas (las últimas 12)", en: "weeks (the last 12)" })}
        </text>
        <path d={area} fill="#ff8a6e" fillOpacity="0.28" />
        <line x1={l} x2={W - r} y1={y(MMM)} y2={y(MMM)} stroke="#c6d8e3" strokeDasharray="5 4" strokeWidth="1" />
        <line x1={l} x2={W - r} y1={y(MMM + 1)} y2={y(MMM + 1)} stroke="#ff8a6e" strokeDasharray="2 3" strokeWidth="1.2" />
        <path d={line} fill="none" stroke="#f2f8fb" strokeWidth="2" />
        <text x={l + 8} y={y(MMM) + 15} fill="#c6d8e3" fontSize="12.5" fontFamily="var(--sans)">
          {L({ es: "lo normal en el mes más cálido", en: "normal for the warmest month" })}
        </text>
        <text x={l + 8} y={y(MMM + 1) - 7} fill="#ff8a6e" fontSize="12.5" fontFamily="var(--sans)">
          {L({ es: "+1 °C: desde aquí el calor cuenta", en: "+1 °C: from here the heat counts" })}
        </text>
        <text x={x(60)} y={y(30.55) - 8} fill="#f2f8fb" fontSize="12.5" fontFamily="var(--sans)">
          {L({ es: "temperatura del mar", en: "sea temperature" })}
        </text>
        {/* Meter: degree heating weeks accumulated so far */}
        <g>
          <rect x={mx - 9} y={mt} width="18" height={mb - mt} fill="#ffffff" fillOpacity="0.05" stroke="#ffffff" strokeOpacity="0.2" />
          {Array.from({ length: Math.ceil(total * 4) }, (_, i) => {
            const v0 = i / 4, v1 = Math.min(total, (i + 1) / 4);
            return <rect key={i} x={mx - 9} y={my(v1)} width="18" height={my(v0) - my(v1)} fill={rampCSS(v0)} />;
          })}
          {[0, 4, 8, 12].map((v) => (
            <g key={v}>
              <line x1={mx + 9} x2={mx + 15} y1={my(v)} y2={my(v)} stroke="#8ea8b9" />
              <text x={mx + 19} y={my(v) + 4} fill="#8ea8b9" fontSize="12" fontFamily="var(--mono)">
                {v}
              </text>
            </g>
          ))}
          <text x={mx} y={my(total) - 10} textAnchor="middle" fill="#f2f8fb" fontSize="15" fontFamily="var(--mono)">
            {fmtNum(total, lang)}
          </text>
          <text x={mx + 40} y={my(4) - 8} fill="#ff8a6e" fontSize="11.5" fontFamily="var(--sans)">
            {L({ es: "blanqueo", en: "bleaching" })}
          </text>
          <text x={mx + 40} y={my(8) - 8} fill="#d6336c" fontSize="11.5" fontFamily="var(--sans)">
            {L({ es: "riesgo de mortalidad", en: "mortality risk" })}
          </text>
          <text x={mx} y={H - b + 18} textAnchor="middle" fill="#8ea8b9" fontSize="11.5" fontFamily="var(--sans)">
            °C-{L({ es: "sem", en: "wk" })}
          </text>
        </g>
      </svg>
      <p className="fig-caption">
        {L({
          es: "Ejemplo ilustrativo. Cada día que el mar está al menos 1 °C sobre lo normal del mes más cálido, ese exceso se suma; la suma de 12 semanas, dividida entre 7, son las semanas-grado de calentamiento. Desde 4 hay riesgo de blanqueamiento en todo el arrecife; desde 8, además, de muerte de los corales más sensibles al calor.",
          en: "Illustrative example. Each day the sea is at least 1 °C above normal for the warmest month, that excess is added up; the 12-week sum, divided by 7, is the degree heating weeks. From 4 there is a risk of reef-wide bleaching; from 8, also of death of the most heat-sensitive corals.",
        })}
      </p>
    </figure>
  );
}

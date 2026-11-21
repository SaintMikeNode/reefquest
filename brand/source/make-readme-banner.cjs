// Builds brand/readme/banner.svg: the README's animated banner, after the site's hero (a calm sea of
// dots swelling under the headline, schools of fish drawn in dots gliding through). Plain SVG + CSS
// animation, so GitHub plays it inside an <img>; still with reduced motion. Logo from the brand kit.
// Run: node brand/source/make-readme-banner.cjs
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const W = 1280, H = 400, R = 28; // the rounded "window", like the hero
const logoSrc = fs.readFileSync(path.join(ROOT, "brand/logo/svg/reefquest-horizontal-color-on-dark.svg"), "utf8");
const logoBox = logoSrc.match(/viewBox="([^"]+)"/)[1];
const logoInner = logoSrc.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "").replace(/<title>[\s\S]*?<\/title>/, "");

// Deterministic "random" so the file is the same every run.
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const f = (n) => Math.round(n * 10) / 10;

// The sea: columns of dots that bob together; their delays make swells travel across. Dots grow and
// brighten toward the viewer (bottom) and dim under the headline (top left).
const STEP = 20, COLS = Math.ceil(W / STEP) + 1, ROW0 = 150;
let sea = "";
for (let c = 0; c < COLS; c++) {
  const x = c * STEP + (c % 2) * 0;
  let dots = "";
  for (let y = ROW0, k = 0; y < H + 10; y += 15 + k * 1.6, k++) {
    const depth = (y - ROW0) / (H - ROW0); // 0 far → 1 near
    const r = 1.1 + depth * 2;
    const dim = x < 760 && y < 300 ? 0.45 + 0.55 * Math.min(1, Math.hypot((x - 380) / 520, (y - 210) / 150)) : 1;
    const o = (0.3 + depth * 0.6) * dim;
    dots += `<circle cx="${x}" cy="${f(y)}" r="${f(r)}" opacity="${f(o * 100) / 100}"/>`;
  }
  sea += `<g class="col" style="animation-delay:${f(-c * 0.11)}s">${dots}</g>`;
}

// A fish in dots: an ellipse body and a forked tail, nose pointing right.
function fish(cx, cy, s) {
  let d = "";
  for (let a = 0; a < 14; a++) {
    const t = (a / 14) * Math.PI * 2;
    d += `<circle cx="${f(cx + Math.cos(t) * 9 * s)}" cy="${f(cy + Math.sin(t) * 4 * s)}" r="${f(0.9 * s)}"/>`;
  }
  d += `<circle cx="${f(cx + 4 * s)}" cy="${f(cy - 1 * s)}" r="${f(1.1 * s)}"/>`; // eye
  for (let i = 1; i <= 3; i++) {
    d += `<circle cx="${f(cx - 9 * s - i * 2.4 * s)}" cy="${f(cy - i * 1.8 * s)}" r="${f(0.85 * s)}"/>`;
    d += `<circle cx="${f(cx - 9 * s - i * 2.4 * s)}" cy="${f(cy + i * 1.8 * s)}" r="${f(0.85 * s)}"/>`;
  }
  return d;
}
function school(n, spreadX, spreadY, s) {
  let g = "";
  for (let i = 0; i < n; i++) g += fish(rnd() * spreadX, rnd() * spreadY, s * (0.8 + rnd() * 0.4));
  return g;
}
// The islands, traced in dots along their OpenStreetMap coastlines, on the right like a small chart.
const geo = JSON.parse(fs.readFileSync(path.join(ROOT, "public/data/islands.geojson"), "utf8"));
const MAP = { x0: 760, lon0: -87.06, pxPerDeg: 360, y0: 72, lat0: 16.56 };
const mx = (lon) => MAP.x0 + (lon - MAP.lon0) * MAP.pxPerDeg;
const my = (lat) => MAP.y0 + (MAP.lat0 - lat) * MAP.pxPerDeg * 1.04;
let isles = "", labels = "";
const seen = new Set();
for (const feat of geo.features) {
  const polys = feat.geometry.type === "MultiPolygon" ? feat.geometry.coordinates : [feat.geometry.coordinates];
  let minY = Infinity, sumX = 0, n = 0;
  for (const poly of polys)
    for (const ring of poly)
      for (let i = 1; i < ring.length; i++) {
        const [a, b] = [ring[i - 1], ring[i]];
        const x0 = mx(a[0]), y0 = my(a[1]), x1 = mx(b[0]), y1 = my(b[1]);
        const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 2.6));
        for (let k = 0; k < steps; k++) {
          const x = x0 + ((x1 - x0) * k) / steps, y = y0 + ((y1 - y0) * k) / steps;
          const key = Math.round(x / 2.6) + "," + Math.round(y / 2.6);
          if (seen.has(key)) continue;
          seen.add(key);
          isles += `<circle cx="${f(x)}" cy="${f(y)}" r="1.15"/>`;
          minY = Math.min(minY, y);
          sumX += x;
          n++;
        }
      }
  if (n) labels += `<text class="mono" x="${f(sumX / n)}" y="${f(minY - 12)}" text-anchor="middle" fill="#e8f4ff" font-size="12" letter-spacing="2">${feat.properties.name.toUpperCase()}</text>`;
}
const school1 = school(9, 170, 60, 1.25);
const school2 = school(6, 120, 44, 0.95);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="ReefQuest: meet the reef around the Bay Islands of Honduras.">
<title>ReefQuest</title>
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#041634"/><stop offset="0.55" stop-color="#0a3c9e"/><stop offset="1" stop-color="#0b55d8"/>
  </linearGradient>
  <radialGradient id="glow" cx="0.72" cy="0.95" r="0.7">
    <stop offset="0" stop-color="#5fd0ff" stop-opacity="0.35"/><stop offset="1" stop-color="#5fd0ff" stop-opacity="0"/>
  </radialGradient>
  <clipPath id="win"><rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="${R}"/></clipPath>
</defs>
<style>
  .col { animation: swell 5.2s ease-in-out infinite alternate; }
  @keyframes swell { from { transform: translateY(5px); opacity: .55; } to { transform: translateY(-7px); opacity: 1; } }
  .school1 { animation: swim1 26s linear infinite; }
  .school2 { animation: swim2 34s linear infinite; animation-delay: -12s; }
  .bob { animation: bob 3.4s ease-in-out infinite alternate; }
  @keyframes swim1 { from { transform: translate(-260px, 0); } to { transform: translate(${W + 80}px, 0); } }
  @keyframes swim2 { from { transform: translate(-200px, 0); } to { transform: translate(${W + 60}px, 0); } }
  @keyframes bob { from { transform: translateY(-6px); } to { transform: translateY(6px); } }
  .isles { animation: breathe 4s ease-in-out infinite alternate; }
  @keyframes breathe { from { opacity: .7; } to { opacity: 1; } }
  .rise { animation: rise 1.2s cubic-bezier(.22,1,.36,1) both; }
  @keyframes rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
  @media (prefers-reduced-motion: reduce) { .col, .school1, .school2, .bob, .rise, .isles { animation: none; } }
  text { font-family: Inter, "Segoe UI", "Helvetica Neue", Arial, sans-serif; }
  .serif { font-family: "Instrument Serif", Georgia, "Times New Roman", serif; font-style: italic; }
  .mono { font-family: "IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace; }
</style>
<g clip-path="url(#win)">
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <g fill="#bfe0ff">${sea}</g>
  <g transform="translate(0 270)" fill="#e8f4ff" opacity=".55"><g class="school1"><g class="bob">${school1}</g></g></g>
  <g transform="translate(0 205)" fill="#9fe8ff" opacity=".4"><g class="school2"><g class="bob" style="animation-delay:-1.7s">${school2}</g></g></g>
  <g class="isles"><g fill="#ffffff">${isles}</g>${labels}</g>
  <g class="rise">
    <svg x="62" y="38" width="370" height="${f((370 * 196) / 1324.77)}" viewBox="${logoBox}">${logoInner}</svg>
    <text class="mono" x="66" y="140" fill="#9fd8ff" font-size="13" letter-spacing="2.6">BAY ISLANDS · HONDURAS · MESOAMERICAN REEF</text>
    <text x="64" y="206" fill="#ffffff" font-size="54" font-weight="700" letter-spacing="-1.5">Meet the reef</text>
    <text class="serif" x="64" y="266" fill="#dbeaff" font-size="58">around our islands.</text>
    <text x="66" y="308" fill="#bcd3f5" font-size="17">A free, bilingual 3D web experience · heat, habitat and reef life</text>
  </g>
</g>
<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="${R}" fill="none" stroke="#ffffff" stroke-opacity=".85" stroke-width="2"/>
</svg>
`;
fs.mkdirSync(path.join(ROOT, "brand/readme"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "brand/readme/banner.svg"), svg);
console.log(`brand/readme/banner.svg ${(svg.length / 1024).toFixed(1)} KB`);

// ---- Heat stripes for the README: one stripe per year, Roatán's yearly peak heat (degree heating
// weeks, NOAA Coral Reef Watch 5 km), colored by the site's alert levels (src/lib/alert.ts LEVELS).
{
  const latest = JSON.parse(fs.readFileSync(path.join(ROOT, "public/data/heat/latest.json"), "utf8"));
  const LEVELS = [[0, "#3a9bb5"], [0.01, "#f7a51c"], [4, "#ef3b2c"], [8, "#a50f15"], [12, "#d4199a"], [16, "#8b1fc9"], [20, "#5b1fb0"]];
  const color = (d) => LEVELS.filter(([m]) => d >= m).pop()[1];
  const isl = latest.islands.roatan, years = latest.years, n = years.length;
  const SW = 1280, SH = 150, pad = 0, bw = SW / n;
  let bars = "";
  years.forEach((y, i) => {
    const d = isl.year_max_dhw[i];
    bars += `<rect class="s" style="animation-delay:${f(i * 0.03)}s" x="${f(pad + i * bw)}" y="0" width="${f(bw + 0.6)}" height="${SH}" fill="${color(d)}"><title>${y}: peak ${d} °C-weeks</title></rect>`;
  });
  const lab = (i, a) => `<text x="${f(i * bw + bw / 2)}" y="${SH + 22}" text-anchor="${a}" fill="#8b949e" font-size="13" font-family="IBM Plex Mono, ui-monospace, Menlo, Consolas, monospace">${years[i]}</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SW} ${SH + 30}" width="${SW}" height="${SH + 30}" role="img" aria-label="Roatán: yearly peak heat stress, ${years[0]} to ${years[n - 1]}, NOAA Coral Reef Watch">
<title>Roatán yearly peak heat stress, ${years[0]}–${years[n - 1]}</title>
<style>.s { animation: in .5s cubic-bezier(.22,1,.36,1) both; transform-origin: center bottom; transform-box: fill-box; } @keyframes in { from { transform: scaleY(0); } to { transform: none; } } @media (prefers-reduced-motion: reduce) { .s { animation: none; } }</style>
<clipPath id="r"><rect width="${SW}" height="${SH}" rx="14"/></clipPath>
<g clip-path="url(#r)">${bars}</g>
${lab(0, "start")}${lab(Math.round((n - 1) / 2), "middle")}${lab(n - 1, "end")}
</svg>
`;
  fs.writeFileSync(path.join(ROOT, "brand/readme/heat-stripes-roatan.svg"), svg);
  console.log(`brand/readme/heat-stripes-roatan.svg ${(svg.length / 1024).toFixed(1)} KB (data through ${latest.date})`);
}

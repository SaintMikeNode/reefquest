// Generates the ReefQuest brand kit into <repo>/brand from the site's mark (src/ui/Logo.tsx) and fonts.
// Run from the repo root, with the two tools installed without saving them to package.json:
//   npm i --no-save fontkit @resvg/resvg-js
//   node brand/source/make-brand.cjs .
const fs = require("fs");
const path = require("path");
const fontkit = require("fontkit");
const { Resvg } = require("@resvg/resvg-js");

const repo = process.argv[2];
const out = path.join(repo, "brand");
const nm = path.join(repo, "node_modules");
const mk = (...p) => fs.mkdirSync(path.join(out, ...p), { recursive: true });
const write = (rel, data) => fs.writeFileSync(path.join(out, rel), data);
const png = (svg, w) => new Resvg(svg, { fitTo: { mode: "width", value: w } }).render().asPng();

// ---------- colors ----------
const C = {
  brand: "#0a66f0", brandInk: "#084fc2", brandSoft: "#dce9ff",
  navy: "#0b1f3f", deep: "#061d44", abyss: "#04132d", sea: "#0b4f8c",
  foam: "#bfe0ff", accent: "#7fb5ff", aqua: "#5fd0d6", coral: "#ff8a6e", white: "#ffffff", black: "#000000",
};

// ---------- fonts → outlines ----------
const inter = fontkit.openSync(path.join(nm, "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2"));
const interAt = (w) => inter.getVariation({ wght: w });
const serifIt = fontkit.openSync(path.join(nm, "@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff"));
const mono = fontkit.openSync(path.join(nm, "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff"));

/** Text as one SVG path, baseline at y=0, starting at x=0. tracking in em. */
function textPath(font, str, size, tracking = 0) {
  const run = font.layout(str);
  const s = size / font.unitsPerEm;
  let x = 0;
  const parts = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  run.glyphs.forEach((g, i) => {
    const pos = run.positions[i];
    const p = g.path.scale(s, -s).translate(x + pos.xOffset * s, -pos.yOffset * s);
    const d = p.toSVG();
    if (d) {
      parts.push(d);
      const b = p.bbox;
      minX = Math.min(minX, b.minX); minY = Math.min(minY, b.minY);
      maxX = Math.max(maxX, b.maxX); maxY = Math.max(maxY, b.maxY);
    }
    x += pos.xAdvance * s + tracking * size;
  });
  return { d: parts.join(" "), advance: x - tracking * size, bbox: { minX, minY, maxX, maxY }, cap: (font.capHeight / font.unitsPerEm) * size };
}
const r2 = (n) => Math.round(n * 100) / 100;

// ---------- the mark (from src/ui/Logo.tsx: a branching coral rising from a wave line) ----------
// Drawn in a 32-unit box. Visible extent with round caps: x 2.1–29.9, y 4–26.4 (center 16, 15.2).
const MARK_VIS = { minX: 2.1, minY: 4, maxX: 29.9, maxY: 26.4 };
function mark(coral, wave, { x = 0, y = 0, scale = 1, weight = 1 } = {}) {
  return `<g transform="translate(${r2(x)} ${r2(y)}) scale(${r2(scale)})">
    <path d="M3 24.5c3.2-1.7 6.3-1.7 9.5 0s6.3 1.7 9.5 0 6.3-1.7 7 0" fill="none" stroke="${wave}" stroke-width="${r2(1.8 * weight)}" stroke-linecap="round"/>
    <g fill="none" stroke="${coral}" stroke-width="${r2(2 * weight)}" stroke-linecap="round" stroke-linejoin="round">
      <path d="M16 22V9.5"/><path d="M16 17l-5.2-4.4V7.5"/><path d="M16 13.5l4.6-3.9V5"/><path d="M10.8 12.6l-3.1-1.6"/><path d="M20.6 9.6l2.6-1.2"/>
    </g>
  </g>`;
}
const svgDoc = (vb, body, title) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.map(r2).join(" ")}" role="img" aria-label="${title}"><title>${title}</title>\n${body}\n</svg>\n`;

// Color variants: [file suffix, coral, wave, text, preview background]
const VARIANTS = [
  ["color-on-dark", C.white, C.foam, C.white, C.deep],
  ["color-on-light", C.navy, C.brand, C.navy, C.white],
  ["white", C.white, C.white, C.white, C.brand],
  ["navy", C.navy, C.navy, C.navy, C.white],
  ["black", C.black, C.black, C.black, C.white],
];

// ---------- wordmark (site: Inter 650, -0.03em) ----------
const WM = textPath(interAt(650), "ReefQuest", 200, -0.03);

mk("logo", "svg");
mk("logo", "png");
mk("icon");
mk("social");

const logos = []; // [name, svg, png width, preview bg]
for (const [suf, coral, wave, ink, bg] of VARIANTS) {
  // Mark alone, square, centered on its visible extent.
  {
    const side = 28.6, cx = 16, cy = (MARK_VIS.minY + MARK_VIS.maxY) / 2;
    const body = mark(coral, wave);
    logos.push([`reefquest-mark-${suf}`, svgDoc([cx - side / 2, cy - side / 2, side, side], body, "ReefQuest"), 1024, bg]);
  }
  // Wordmark alone.
  {
    const b = WM.bbox;
    const body = `<path d="${WM.d}" fill="${ink}"/>`;
    logos.push([`reefquest-wordmark-${suf}`, svgDoc([b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY], body, "ReefQuest"), 1600, bg]);
  }
  // Horizontal: the site header's proportions (mark box 28, gap 9, type 20) ×10.
  {
    const s = 280 / 32;
    const markCy = ((MARK_VIS.minY + MARK_VIS.maxY) / 2) * s;
    const baseline = markCy + WM.cap / 2; // cap height centered on the mark
    const tx = 280 + 90;
    const body = `${mark(coral, wave, { scale: s })}\n  <path transform="translate(${tx} ${r2(baseline)})" d="${WM.d}" fill="${ink}"/>`;
    const minX = MARK_VIS.minX * s, minY = Math.min(MARK_VIS.minY * s, baseline + WM.bbox.minY);
    const maxX = tx + WM.bbox.maxX, maxY = Math.max(MARK_VIS.maxY * s, baseline + WM.bbox.maxY);
    logos.push([`reefquest-horizontal-${suf}`, svgDoc([minX, minY, maxX - minX, maxY - minY], body, "ReefQuest"), 2000, bg]);
  }
  // Vertical: the mark above the wordmark, centered.
  {
    const s = 520 / 32;
    const wmW = WM.bbox.maxX - WM.bbox.minX;
    const cx = Math.max(wmW, (MARK_VIS.maxX - MARK_VIS.minX) * s) / 2;
    const mx = cx - 16 * s;
    const markBottom = MARK_VIS.maxY * s;
    const baseline = markBottom + 64 + WM.cap;
    const tx = cx - wmW / 2 - WM.bbox.minX;
    const body = `${mark(coral, wave, { x: mx, scale: s })}\n  <path transform="translate(${r2(tx)} ${r2(baseline)})" d="${WM.d}" fill="${ink}"/>`;
    const minX = Math.min(mx + MARK_VIS.minX * s, tx + WM.bbox.minX), maxX = Math.max(mx + MARK_VIS.maxX * s, tx + WM.bbox.maxX);
    const minY = MARK_VIS.minY * s, maxY = baseline + WM.bbox.maxY;
    logos.push([`reefquest-vertical-${suf}`, svgDoc([minX, minY, maxX - minX, maxY - minY], body, "ReefQuest"), 1400, bg]);
  }
}
for (const [name, svg, w] of logos) {
  write(`logo/svg/${name}.svg`, svg);
  write(`logo/png/${name}.png`, png(svg, w));
}

// ---------- icons ----------
const dots = (size, step, r, op, fromY = 0) => {
  let c = "";
  for (let y = step / 2; y < size; y += step)
    for (let x = step / 2; x < size; x += step) {
      if (y < fromY) continue;
      c += `<circle cx="${r2(x)}" cy="${r2(y)}" r="${r}"/>`;
    }
  return `<g fill="#ffffff" fill-opacity="${op}">${c}</g>`;
};
const heroGrad = (id) =>
  `<radialGradient id="${id}" cx="50%" cy="34%" r="80%"><stop offset="0" stop-color="#2f7dff"/><stop offset="0.5" stop-color="#0c57dc"/><stop offset="1" stop-color="#062b84"/></radialGradient>`;

/** App icon: the coral mark on the hero's ocean blue, with the dotted sea faintly behind. */
function appIcon(size, { round = true, markFrac = 0.56, weight = 1, withDots = true } = {}) {
  const rx = round ? size * 0.225 : 0;
  const visW = MARK_VIS.maxX - MARK_VIS.minX;
  const s = (size * markFrac) / visW;
  const cy = (MARK_VIS.minY + MARK_VIS.maxY) / 2;
  const mx = size / 2 - 16 * s, my = size * 0.515 - cy * s;
  const clip = round ? `<clipPath id="c"><rect width="${size}" height="${size}" rx="${r2(rx)}"/></clipPath>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="ReefQuest"><title>ReefQuest</title>
  <defs>${heroGrad("g")}<radialGradient id="v" cx="50%" cy="45%" r="60%"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.22"/></radialGradient>${clip}</defs>
  <g${round ? ' clip-path="url(#c)"' : ""}>
    <rect width="${size}" height="${size}" fill="url(#g)"/>
    ${withDots ? dots(size, size / 16, r2(size / 260), 0.13) : ""}
    <rect width="${size}" height="${size}" fill="url(#v)"/>
    ${mark(C.white, C.foam, { x: mx, y: my, scale: s, weight })}
  </g>
</svg>
`;
}
const icon1024 = appIcon(1024);
write("icon/app-icon.svg", icon1024);
for (const w of [1024, 512, 192]) write(`icon/app-icon-${w}.png`, png(icon1024, w));
const maskable = appIcon(512, { round: false, markFrac: 0.46 }); // mark inside the 80% safe zone
write("icon/maskable-icon.svg", maskable);
write("icon/maskable-icon-512.png", png(maskable, 512));
const apple = appIcon(180, { round: false, markFrac: 0.56, weight: 1.1 }); // iOS rounds the corners itself
write("icon/apple-touch-icon.svg", apple);
write("icon/apple-touch-icon.png", png(apple, 180));
// Favicon: no dots, bigger mark, heavier strokes so it reads at 16 px.
const fav = appIcon(64, { markFrac: 0.74, weight: 1.35, withDots: false });
write("icon/favicon.svg", fav);
const favPngs = [16, 32, 48].map((w) => [w, png(fav, w)]);
for (const [w, b] of favPngs) write(`icon/favicon-${w}.png`, b);
// favicon.ico: an ICO container holding the three PNGs.
{
  const head = Buffer.alloc(6 + 16 * favPngs.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(favPngs.length, 4);
  let offset = head.length;
  favPngs.forEach(([w, b], i) => {
    const e = 6 + 16 * i;
    head.writeUInt8(w, e); head.writeUInt8(w, e + 1); head.writeUInt8(0, e + 2); head.writeUInt8(0, e + 3);
    head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6); head.writeUInt32LE(b.length, e + 8); head.writeUInt32LE(offset, e + 12);
    offset += b.length;
  });
  write("icon/favicon.ico", Buffer.concat([head, ...favPngs.map(([, b]) => b)]));
}
write("icon/site.webmanifest", JSON.stringify({
  name: "ReefQuest", short_name: "ReefQuest", lang: "es",
  description: "Los arrecifes de coral de las Islas de la Bahía, Honduras, en 3D.",
  start_url: "/", display: "standalone", background_color: C.deep, theme_color: "#072352",
  icons: [
    { src: "/app-icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "/app-icon-512.png", sizes: "512x512", type: "image/png" },
    { src: "/maskable-icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
}, null, 2) + "\n");

// ---------- social cards (1200×630) ----------
function social(lang) {
  const W = 1200, H = 630;
  const head = lang === "es" ? ["Conoce el arrecife", "que rodea nuestras islas."] : ["Meet the reef", "around our islands."];
  const kicker = lang === "es" ? "ISLAS DE LA BAHÍA, HONDURAS · ARRECIFE MESOAMERICANO" : "BAY ISLANDS, HONDURAS · MESOAMERICAN REEF";
  const l1 = textPath(interAt(700), head[0], 86, -0.035);
  const l2 = textPath(serifIt, head[1], 96, -0.01);
  const k = textPath(mono, kicker, 17, 0.1);
  const url = textPath(mono, "reefquest.todosenlaweb.com", 20, 0.02);
  // The hero's dotted sea: rows of dots swelling in a wave across the lower part.
  let sea = "";
  for (let y = 360; y < H + 10; y += 18)
    for (let x = 9; x < W; x += 18) {
      const v = Math.sin(x * 0.012 + y * 0.03) * 0.55 + Math.sin(-x * 0.006 + y * 0.05 + 1.3) * 0.45;
      const k2 = Math.min(1, Math.max(0, (y - 360) / 200));
      const lvl = (0.5 + 0.5 * v) * k2;
      if (lvl < 0.06) continue;
      sea += `<circle cx="${x}" cy="${r2(y - v * 7)}" r="${r2(0.8 + 2.6 * lvl)}" fill-opacity="${r2(0.15 + 0.7 * lvl)}"/>`;
    }
  const ls = 60 / 32;
  const markY = 70;
  const wm = textPath(interAt(650), "ReefQuest", 40, -0.03);
  const logoBase = markY + ((MARK_VIS.minY + MARK_VIS.maxY) / 2) * ls + wm.cap / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="ReefQuest: ${head.join(" ")}"><title>ReefQuest</title>
  <defs><radialGradient id="g" cx="50%" cy="30%" r="85%"><stop offset="0" stop-color="#1d6cf5"/><stop offset="0.55" stop-color="#0941b4"/><stop offset="1" stop-color="#062b84"/></radialGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <g fill="${C.foam}">${sea}</g>
  ${mark(C.white, C.foam, { x: 80 - 2 * ls, y: markY, scale: ls })}
  <path transform="translate(${r2(80 + 37 * ls - 2 * ls)} ${r2(logoBase)})" d="${wm.d}" fill="#fff"/>
  <path transform="translate(82 228)" d="${k.d}" fill="${C.foam}"/>
  <path transform="translate(78 322)" d="${l1.d}" fill="#fff"/>
  <path transform="translate(80 418)" d="${l2.d}" fill="#fff"/>
  <path transform="translate(82 ${H - 52})" d="${url.d}" fill="#fff" fill-opacity="0.85"/>
</svg>
`;
}
for (const lang of ["es", "en"]) {
  const s = social(lang);
  write(`social/og-image-${lang}.svg`, s);
  write(`social/og-image-${lang}.png`, png(s, 1200));
}

// ---------- tokens ----------
const tokens = {
  color: {
    brand: { blue: C.brand, "blue-ink": C.brandInk, "blue-soft": C.brandSoft, foam: C.foam },
    ocean: { navy: C.navy, deep: C.deep, abyss: C.abyss, sea: C.sea, "hero-light": "#0c57dc", "hero-mid": "#0941b4", "hero-dark": "#062b84" },
    accent: { sky: C.accent, aqua: C.aqua, coral: C.coral },
    text: { "on-dark": "#f5f8ff", "on-dark-body": "#cad8ee", "on-dark-muted": "#93a9c8", "on-light": C.navy, "on-light-muted": "#5d6f8c" },
    glass: { panel: "rgba(5, 18, 34, 0.64)", hairline: "rgba(255, 255, 255, 0.11)" },
    "heat-alert": { none: "#3a9bb5", warning: "#f7a51c", "alert-1": "#ef3b2c", "alert-2": "#a50f15", "alert-3": "#d4199a", "alert-4": "#8b1fc9", "alert-5": "#5b1fb0" },
  },
  font: {
    sans: "Inter Variable, Inter, Helvetica Neue, Arial, sans-serif",
    serif: "Instrument Serif, Georgia, serif",
    mono: "IBM Plex Mono, Menlo, monospace",
  },
  radius: { pill: "999px", card: "22px", window: "clamp(20px, 2.6vw, 34px)" },
};
write("tokens.json", JSON.stringify(tokens, null, 2) + "\n");
let css = "/* ReefQuest brand tokens (the site's live values are in src/styles.css). */\n:root {\n";
const walk = (o, pre) => { for (const [k2, v] of Object.entries(o)) typeof v === "object" ? walk(v, `${pre}-${k2}`) : (css += `  --rq${pre}-${k2}: ${v};\n`); };
walk(tokens, "");
css += "}\n";
write("tokens.css", css);

console.log("logos", logos.length, "files ->", out);

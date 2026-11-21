// Reef area per island, measured on the Allen Coral Atlas habitat map each island already ships
// (public/data/<island>/habitat.png: R = benthic class, B = 255 inside the Atlas reef mask). Writes
// `reef_km2` (mapped reef) and `coral_km2` (benthic class 15, "Coral/Algae") into the island's
// meta.json, for the islands page cards. Node, no packages: `node pipeline/reef_area.mjs`.
import { readFileSync, writeFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

const ISLANDS = ["roatan", "utila", "guanaja", "cayos-cochinos"];
const CORAL_ALGAE = 15;

/** Decode an 8-bit, non-interlaced RGB or RGBA PNG into { width, height, channels, data }. */
function decodePng(buf) {
  let pos = 8, width = 0, height = 0, channels = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString("ascii", pos + 4, pos + 8), body = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      const depth = body[8], color = body[9], interlace = body[12];
      if (depth !== 8 || interlace !== 0 || (color !== 2 && color !== 6)) throw new Error(`unsupported PNG (depth ${depth}, color ${color}, interlace ${interlace})`);
      channels = color === 2 ? 3 : 4;
    } else if (type === "IDAT") idat.push(body);
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat)), stride = width * channels, data = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), out = data.subarray(y * stride, (y + 1) * stride), prev = y ? data.subarray((y - 1) * stride, y * stride) : null;
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? out[i - channels] : 0, b = prev ? prev[i] : 0, c = prev && i >= channels ? prev[i - channels] : 0;
      let v = line[i];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[i] = v & 255;
    }
  }
  return { width, height, channels, data };
}

for (const id of ISLANDS) {
  const metaPath = `public/data/${id}/meta.json`;
  const meta = JSON.parse(readFileSync(metaPath, "utf8"));
  const png = decodePng(readFileSync(`public/data/${id}/habitat.png`));
  const cellM2 = (meta.size_m[0] / png.width) * (meta.size_m[1] / png.height);
  let reef = 0, coral = 0;
  for (let i = 0; i < png.width * png.height; i++) {
    const r = png.data[i * png.channels], b = png.data[i * png.channels + 2];
    if (b > 127) reef++;
    if (r === CORAL_ALGAE) coral++;
  }
  meta.reef_km2 = Math.round((reef * cellM2) / 1e5) / 10;
  meta.coral_km2 = Math.round((coral * cellM2) / 1e5) / 10;
  // Only these two keys change: write them into the text (re-serializing would reformat the
  // Python-written file), replacing any earlier run's values.
  let text = readFileSync(metaPath, "utf8").replace(/,\r?\n\s*"reef_km2": [^\n]*\r?\n\s*"coral_km2": [^\n]*(?=\r?\n})/, "");
  text = text.replace(/\r?\n}\s*$/, `,\n  "reef_km2": ${meta.reef_km2},\n  "coral_km2": ${meta.coral_km2}\n}\n`);
  JSON.parse(text);
  writeFileSync(metaPath, text);
  console.log(`${id}: reef ${meta.reef_km2} km², coral/algae ${meta.coral_km2} km² (${png.width}×${png.height}, ${Math.sqrt(cellM2).toFixed(1)} m cells)`);
}

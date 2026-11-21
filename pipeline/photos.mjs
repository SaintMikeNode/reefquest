// Photos of the places and species, from openly licensed sources, downloaded once and served by the
// site (never fetched live from iNaturalist or Wikimedia in the browser).
//
// Reads the curated selection in pipeline/photos.json and writes public/data/photos/:
//   index.json            every photo with its names, credit, license and source link, grouped by
//                         place (story/dive sites and boat zones) and by field-guide species
//   <id>-s.jpg, <id>-m.jpg  small (240 px) and medium (500 px) versions, exactly as published
//                         (not cropped or edited, so share-alike licenses carry no extra duty)
//
// Run from the repo root with Node 24 (no packages needed):  node pipeline/photos.mjs
// Sources and licenses: iNaturalist observations (CC0, CC BY, CC BY-NC, CC BY-SA, CC BY-NC-SA;
// never ND or unlicensed) and Wikimedia Commons files. The project is free and nonprofit, which
// the NC licenses require.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const SEL = JSON.parse(fs.readFileSync(path.join(ROOT, "pipeline/photos.json"), "utf8"));
const OUT = path.join(ROOT, "public/data/photos");
fs.mkdirSync(OUT, { recursive: true });
// Wikimedia asks automated clients to name a website or contact (it answers 429 otherwise).
const UA = { "User-Agent": "ReefQuest-photos/1.0 (https://reefquest.todosenlaweb.com; educational, nonprofit)" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const LICENSES = {
  cc0: ["CC0 1.0", "https://creativecommons.org/publicdomain/zero/1.0/"],
  "cc-by": ["CC BY 4.0", "https://creativecommons.org/licenses/by/4.0/"],
  "cc-by-nc": ["CC BY-NC 4.0", "https://creativecommons.org/licenses/by-nc/4.0/"],
  "cc-by-sa": ["CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0/"],
  "cc-by-nc-sa": ["CC BY-NC-SA 4.0", "https://creativecommons.org/licenses/by-nc-sa/4.0/"],
};

async function get(url, kind = "json") {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(url, { headers: UA });
    if (r.ok) return kind === "json" ? r.json() : Buffer.from(await r.arrayBuffer());
    await sleep(2000 * (i + 1));
  }
  throw new Error(`${url}: failed`);
}
const save = async (url, file) => {
  const f = path.join(OUT, file);
  if (!fs.existsSync(f)) {
    fs.writeFileSync(f, await get(url, "bin"));
    await sleep(250);
  }
};
const strip = (html) => String(html || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

/** One iNaturalist observation photo: names in both languages, credit, license, two sizes. */
async function inat(item) {
  const [es, en] = await Promise.all([get(`https://api.inaturalist.org/v1/observations/${item.inat}?locale=es`), get(`https://api.inaturalist.org/v1/observations/${item.inat}?locale=en`)]);
  await sleep(1100);
  const o = es.results[0], oEn = en.results[0];
  const p = (item.photo ? o.photos.find((x) => x.id === item.photo) : null) ?? o.photos[0];
  if (!p.license_code || /nd/.test(p.license_code)) throw new Error(`obs ${item.inat}: photo not openly licensed (${p.license_code})`);
  const id = `inat-${p.id}`;
  await save(p.url.replace("square", "small"), `${id}-s.jpg`);
  await save(p.url.replace("square", "medium"), `${id}-m.jpg`);
  const [w, h] = [p.original_dimensions?.width ?? 4, p.original_dimensions?.height ?? 3];
  const [license, licenseUrl] = LICENSES[p.license_code];
  return {
    id,
    src: { s: `/data/photos/${id}-s.jpg`, m: `/data/photos/${id}-m.jpg` },
    ratio: Math.round((w / h) * 1000) / 1000,
    name: { es: o.taxon?.preferred_common_name || o.taxon?.name, en: oEn.taxon?.preferred_common_name || oEn.taxon?.name },
    sci: o.taxon?.name ?? "",
    credit: (p.attribution || "").replace(/^\(c\)\s*/i, "© ").replace(/,?\s*some rights reserved.*$/i, "").replace(/,?\s*no rights reserved.*$/i, "").trim(),
    license,
    licenseUrl,
    source: `https://www.inaturalist.org/observations/${o.id}`,
    via: "iNaturalist",
    date: o.observed_on || null,
    // Where it was taken (public coordinates; none when iNaturalist hides the exact spot).
    at: o.obscured || !o.location ? null : o.location.split(",").map(Number),
  };
}

/** One Wikimedia Commons file (the caption names come from the selection file). */
async function commons(item) {
  const j = await get(
    `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(item.commons)}&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=500&format=json`,
  );
  const page = Object.values(j.query.pages)[0];
  const ii = page.imageinfo[0];
  const m = ii.extmetadata;
  const id = `wc-${page.pageid}`;
  const small = await get(`https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(item.commons)}&prop=imageinfo&iiprop=url&iiurlwidth=240&format=json`);
  await save(Object.values(small.query.pages)[0].imageinfo[0].thumburl, `${id}-s.jpg`);
  await save(ii.thumburl, `${id}-m.jpg`);
  await sleep(500);
  return {
    id,
    src: { s: `/data/photos/${id}-s.jpg`, m: `/data/photos/${id}-m.jpg` },
    ratio: Math.round((ii.width / ii.height) * 1000) / 1000,
    name: item.name,
    sci: item.sci ?? "",
    // Commons artist fields can carry wiki markup ("w:en:Name (talk | contribs)"): keep the name.
    credit: "© " + strip(m.Artist?.value).replace(/\s*\(talk\s*\|\s*contribs\)/i, "").replace(/^\w+:\w+:/, "").trim(),
    license: strip(m.LicenseShortName?.value),
    licenseUrl: m.LicenseUrl?.value || "",
    source: ii.descriptionurl,
    via: "Wikimedia Commons",
    date: null,
  };
}

// "Taken here" means within 1.5 km of a dive or story site, or 3 km of a boat zone's center (zones
// cover ~4 km of coast). Otherwise the caption names the island, from the photo's coordinates.
const km = ([a, b], [c, d]) => {
  const r = Math.PI / 180, x = (d - b) * r * Math.cos(((a + c) / 2) * r), y = (c - a) * r;
  return 6371 * Math.hypot(x, y);
};
const ISLANDS = { utila: ["Utila", "Utila"], roatan: ["Roatán", "Roatán"], guanaja: ["Guanaja", "Guanaja"], cayos: ["Cayos Cochinos", "Cayos Cochinos"] };
const islandOf = ([lat, lon]) => (lat < 16.1 && lon > -86.7 && lon < -86.4 ? "cayos" : lon < -86.75 ? "utila" : lon > -86.0 ? "guanaja" : "roatan");
async function one(item, spot, radius) {
  const p = item.inat ? await inat(item) : await commons(item);
  const at = p.at;
  delete p.at;
  if (item.here !== undefined) return { ...p, here: item.here, ...(item.where ? { where: item.where } : {}) };
  if (!at) return { ...p, here: false, where: { es: "las Islas de la Bahía", en: "the Bay Islands" } };
  if (spot && km(at, spot) <= radius) return { ...p, here: true };
  const [es, en] = ISLANDS[islandOf(at)];
  return { ...p, here: false, where: { es: `otro punto de ${es}`, en: `elsewhere on ${en}` } };
}

const index = { generated: new Date().toISOString().slice(0, 10), places: {}, species: {} };
for (const [key, place] of Object.entries(SEL.places)) {
  index.places[key] = [];
  for (const it of place.photos) index.places[key].push(await one(it, [place.lat, place.lon], key.startsWith("zone:") ? 3 : 1.5));
  console.log("place", key, index.places[key].length);
}
for (const [key, it] of Object.entries(SEL.species)) {
  index.species[key] = await one(it, null, 0);
  console.log("species", key);
}
fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(index, null, 1) + "\n");
// Remove files no longer selected.
const keep = new Set(Object.values(index.places).flat().concat(Object.values(index.species)).flatMap((p) => [`${p.id}-s.jpg`, `${p.id}-m.jpg`]));
for (const f of fs.readdirSync(OUT)) if (f.endsWith(".jpg") && !keep.has(f)) fs.unlinkSync(path.join(OUT, f));
console.log("photos:", keep.size / 2);

# ReefQuest

Free, bilingual (Spanish first, English second) 3D web experience about the coral reefs of the Bay
Islands of Honduras: satellite heat stress (NOAA Coral Reef Watch), Allen Coral Atlas habitat maps and
bathymetry, and photogrammetry models of local corals. Audience: Honduran schools, island communities,
dive shops, visitors. **The full spec is `docs/HANDOFF.md`; read it before planning work.**

## Working with Tulio

- Not a web developer: explain tool/framework picks in one or two sentences; ask before big
  architectural changes.
- Post progress updates (with how much is left) on long tasks: downloads, mesh processing, builds.
- American English in code comments and docs. UI strings in both `src/i18n/es.json` and `en.json`
  (a key missing from `en.json` is a type error).

## Hard limits

- **Bay Islands department only** (Roatán, Utila, Guanaja, Cayos Cochinos). Bounding box
  lat 15.8–16.6, lon -87.1 to -85.7 (`pipeline/common.py`). No other part of the Mesoamerican Reef.
- Static site; data is precomputed by scripts into `public/data/`, never fetched live from third-party
  servers in the browser.
- Low-end Android and old PCs: first view under ~5 MB, island scenes lazy-loaded, coral models
  50k–150k triangles, Draco/meshopt compressed. WebGL fallback = 2D map + charts.
- Every dataset and model shown needs visible attribution; the heat overlay is labeled as a 5 km
  regional satellite signal; reef scenes are labeled as a model, not a navigation chart.
- Do not scrape or republish site-level survey data (AGRRA, Healthy Reefs) until Tulio confirms terms.
  Do not bundle paid or editorial-license models.

## Commands

- `npm run dev`: dev server (port 5181, `reefquest` in `.claude/launch.json`)
- `npm run build`: typecheck + production build (`.cloudflare/output/v0/`)
- `npm run typecheck`

Node 24 (`.nvmrc` / `.node-version` / `engines`, matches Workers Builds). On this Mac it is keg-only
from Homebrew: prefix commands with `PATH="/opt/homebrew/opt/node@24/bin:$PATH"`. npm 11 install
scripts are allow-listed in `package.json` (`allowScripts`). The repo lives on an exFAT drive, so macOS
writes `._*` files; they are git-ignored and `scripts/clean-appledouble.mjs` strips them from builds.

## Stack

Vite 8 + TypeScript + React 19 + React Three Fiber / drei (three.js), zustand for small state, the
same tools as CopánQuest (`../copanquest`, a useful reference, but don't share code across sites).
Chunks: `index` (top bar, home map, cards; keep it small, ~80 KB gz) → `engine-3d` (three + R3F,
~250 KB gz) → `IslandScene` and each page, loaded with `React.lazy`. Hash routes: `#/`,
`#/island/roatan`, `#/heat`, `#/learn`, `#/about` (`src/lib/router.ts`).

Design (third direction, from a reference Tulio chose: the FlowOS Framer template; he wants the
site to stop looking AI-made). One confident ocean blue (`--brand`), a rounded white-bordered
"window" for the home hero, headlines that pair bold Inter with an italic
Instrument Serif accent (mark the accent words with `*…*` in the i18n string and render with
`accent()`), pill buttons (`.btn.primary` blue, `.btn.light` white), hairline guides with nodes,
and white data cards (`.card`) sitting on the artwork that show real data (today's alert per
island, the 42-year heat strip). Data sections and the 3D views stay on deep blue (`--deep`,
`--abyss`) so figures keep contrast; figures are rounded cards (`.figure`, `--card` radius); inner
pages open with a blue title band (`.page-band-head`). History: beige/light pages were rejected
("this is a sea project"), and everything must stay consistent across pages and HUDs.
The hero background is ours, not the reference's: `src/ui/BrailleSea.tsx` draws the real terrain
(GEBCO, `public/data/relief.bin`) as a ridgeline landscape in braille dots, looking north from the
shelf south of the islands, so Roatán is a white skyline with Guanaja's peak to the right. Lines
are rasterized into braille cells by `drawille-canvas` (Tulio asked for this library; import
`drawille-canvas/index.js`, because the package's `browser` entry is a plain DOM canvas, and keep
the `Buffer.alloc` shim) and the cells are painted as dots on a `<canvas>` so no device depends on
braille fonts. A satellite crosses the sky and lights the strip under it; weak devices and
reduced-motion get a still frame. The skyline is anchored to the gap between `.hero-actions` and
the cards. A first version with a painted sky-and-reef illustration was rejected as too close to
the reference: don't bring back painted scenery.
Tokens and all CSS in `src/styles.css`. Fonts, self-hosted via @fontsource:
Inter (text, headlines), Instrument Serif (italic accents, big numerals), IBM Plex Mono (data).
Tables stack into label/value rows on phones; **no horizontally scrolling boxes** anywhere (check
pages at 375 px). Heat colors follow NOAA's alert scale (`src/lib/alert.ts`); surveyed seafloor
uses the turbo ramp (0–30 m).
3D HUD = an atlas plate, not a dashboard: the title plate (kicker, serif name, coordinates, and the
way back as a white pill right under the name), type on a scrim, frosted rounded `.panel`s only
for content (`html.lite` drops the blur), pill buttons, layer rows with inline legends, cartographic pin labels (no boxes), heading tape
in the boat.
Severity must be visible, not just labeled: the sea overlay is nearly clear below 4 °C-weeks and
takes over from Alert 1–2 (slow pulse from Alert 2); coral areas whiten on the island and corals
bleach underwater by species (`BLEACH` in `corals.ts`) from ~4 to ~10 °C-weeks; the fog/background
shifts toward dark wine with the area's mean heat (`SCENE_FOG`); a `HeatStatus` line under the
place name gives NOAA's alert wording. All of it follows the selected date and is labeled illustrative.

## Layout

- `src/lib/`: `islands.ts` (which islands have a 3D scene), `data.ts` (loaders for `/data/*`, cached), `alert.ts` (CRW alert levels from DHW and
  the color ramp), `router.ts`, `device.ts` (quality tiers: 0 lite = low-end phones/old PCs, 1 phone = other
  phones and tablets, 2 full = desktops; `pick(lite, phone, full)` chooses budgets; force a tier with
  `?lite`, `?phone`, `?full`), `gridLod.ts` (level-of-detail triangle indices for heightfields).
- `src/i18n/`: `es.json`, `en.json`, `useT()` / `useL()` (picks `{es, en}` pairs) / `useLang`
  (localStorage `rq-lang`; first visit is Spanish unless the browser prefers English).
- `src/content/`: long-form bilingual content with sources: `sites.ts` (dive-site pins and their
  stories), `learn.ts` (explainers; `src/ui/LessonFigures.tsx` draws the bleaching and DHW
  diagrams), `reefLife.ts` (underwater field guide: species names and how to recognize them). **Every fact needs a source**; don't add unsourced claims.
- `src/pages/`: `Home` (hero, live SVG map with OSM coastlines + today's 5 km heat cells, island
  cards, heat stripes), `HeatPage` (island comparison chart, worst years, alert scale), `LearnPage`,
  `AboutPage` (caveats, data credits and licenses).
- `src/scenes/`: the 3D island scene. `terrain.ts` (decode heightmap, mesh, display scale: relief
  ×4 and depths beyond 40 m compressed; heightfield ray-march picking; lat/lon via the pipeline's
  affine fit), `materials.ts` (terrain shader: hillshade, natural seafloor colors by habitat with surf
  on the reef crest, or the Atlas classification when the "Habitat map" layer is on; contours,
  caustics; water shader: NOAA 5 km cells with hairline edges), `IslandScene.tsx` (Canvas with `frameloop="demand"`, pins, camera
  fly-to), `nature.ts` (instanced palms and forest canopy on land, by elevation and habitat),
  `Hud.tsx` (title plate, layers with inline keys, boat zones, readout, numbered first-visit guide
  `rq-guide-1`), `SiteCard.tsx`, `Timeline.tsx` (year chips, DHW chart, scrubber,
  playback), `sceneStore.ts`.
- `src/boat/`: the research-boat mode (lazy chunk, ~21 KB gz). `zone.ts` (detailed zone tiles: 10 m
  relief, 5 m habitat, meters as scene units, depths beyond 60 m compressed), `boatMaterials.ts`
  (seafloor with natural habitat colors + line-of-sight water attenuation + caustics; sea surface
  with ripples, fresnel, foam on very shallow water; sky; abyss floor), `boatModel.ts` (procedural
  research vessel: blue hull, white superstructure, A-frame, crane, radomes, CTD rosette),
  `sonar.ts` (multibeam swath ≈ 3.5 × depth per side, coverage on a 20 m grid saved in localStorage
  `rq-survey-<zone>`, drawn on the seafloor with the turbo depth ramp; sonar fan mesh), `echo.ts` +
  `Echogram.tsx` (scrolling echo sounder), `corals.ts` (stylized Caribbean reef life: 11 species
  shapes + surface patterns, mix by habitat and depth, dense within ~75 m of the boat and thinning
  out to 380 m, nearest kept when over budget), `props.ts` (shared water tint: from above along the
  line of sight, underwater by distance; `WATER` uniforms), `underwaterFx.ts` (light shafts, marine
  snow). Underwater view: `useBoat.under` (button or U); camera kept between seabed and surface,
  Snell's window on the surface shader, survey overlay hidden. `BoatWorld.tsx` (physics: throttle/drag/turn, grounding by depth ahead of the
  bow, tap-to-go, WASD/arrows, chase camera, wake, buoys at real moorings, fish schools),
  `BoatHud.tsx` (title plate with "Back to <island>", heading tape, sounder, survey %, depth key,
  CTD cast button/space bar, logbook mission saved in localStorage `rq-log-<zone>`, field guide of
  nearby species when underwater; on phones the panels start folded). Dev only:
  `window.__rqBoat.current.x/z` moves the boat, `window.__boat` is the store.
  Entered from a story card ("Explore by boat") or the zone list in the layers panel; zones are
  listed in `pipeline/zones.json` and built by `pipeline/zone_tiles.py` (each ~80–350 KB, loaded
  only when entered). Roatán has 7 (West End, Cordelia, Mary's Place hand-picked around stories; Big
  Bight, Diamond Rock, Santa Elena, Pelican Point picked as the most coral-rich 4 km windows, named
  after the nearest OSM place), Utila 1, Guanaja 2. The boat starts at the reef spot (4.5–14 m, coral
  or hard bottom around) nearest the site, anywhere in the zone.
- `src/scenes/labels.tsx`: screen-space labels (one projector + plain DOM), used instead of drei
  `Html` (which threw removeChild errors on unmount with React 19).
- `public/data/`: pipeline outputs (committed): `islands.json/.geojson`, `region.json` (GEBCO
  contours + mainland coast) and `relief.bin` (coarse GEBCO elevation grid for the home hero), `heat/` (index, latest, per-island daily series, `grid/<year>.bin`;
  all 42 NOAA years, 1985 → 2026-11-18), and one folder per island (`roatan/`, `utila/`,
  `guanaja/`, `cayos-cochinos/`: terrain.png, habitat.png, meta.json, `zones/` for boat tiles).
  To refresh heat: `crw_download.py --all` (skips years already downloaded; PacIOOS is slow, ~3–6 min
  a year) → `heat_products.py` → restart the dev server.
- `pipeline/`: Python data scripts (see `pipeline/README.md`). Python env is `~/.venvs/reefquest`
  (internal disk; the exFAT drive breaks installs), managed with `uv`. Raw downloads go to
  `data/raw/` (git-ignored). Heat data comes from the PacIOOS ERDDAP (`dhw_5km`; CoastWatch
  redirects there). Earth Engine project: `reefquest`.
- `docs/`: the handoff/spec and phase reports (`docs/phase0/REPORT.md`, `docs/phase1/REPORT.md`
  with the boat, the two redesign passes and screenshots).

## Performance (phones first)

Budgets measured with `window.__rqGl.info.render` (dev only), Roatán / West End, triangles per frame:

| View | Before | Full | Phone | Lite |
| --- | --- | --- | --- | --- |
| Island | 1,470k | 474k | 157k | 132k |
| Boat | 2,250k | 916k | 269k | 174k |
| Underwater | 2,250k | 333k | 142k | 86k |

How: island terrain uses 4-step cells over deep water and fine cells on land and the shelf
(`buildGeometry`); the boat seafloor is full detail only near the boat (`ZoneLod`, index buffer
rebuilt every 50 m) and underwater nothing beyond ~170 m is drawn; corals have detailed and simplified
meshes (`speciesGeometries(lo)`), placed nearest-first from a 50 m bucket grid with no per-prop
allocations, and underwater only within visibility; vegetation and reef use Lambert materials;
phones get 2-octave noise, no backdrop blur, no MSAA, HUD telemetry at 6 Hz, and redraw the island
only on change. `AdaptiveQuality` lowers canvas resolution when frames stay above ~29 ms (and never
climbs back to a level that failed); `FrameCap` holds the boat at 60 fps on 90/120 Hz phones.
Keep new 3D features inside these budgets and check all three tiers. Not yet verified on a real
low-end Android phone.

## Gotchas

- The Cloudflare Vite plugin's dev server only serves `public/` files that existed when it started:
  **restart the dev server after the pipeline writes new data files** (otherwise `/data/...` returns
  the SPA's index.html).
- The scene renders on demand: call `invalidate()` after anything that changes what's on screen.
- The browser pane in the desktop app can throttle requestAnimationFrame, so 3D screenshots there
  may be black; check in a visible browser window.
- React StrictMode runs `useMemo` twice in dev: an object that mutates a shared geometry in its
  constructor (as `ZoneLod` once did) ends up detached. Give such objects their own geometry.
- Hot reload of shader or reef modules can leave instanced meshes empty (refs survive, new meshes
  don't); reload the page before judging a 3D change.
- Content must match the data: the full record shows 2024 hotter than 2023 around Roatán, Utila
  and Cayos Cochinos (2023 for Guanaja). Re-check lesson and story wording when heat data changes.

## Hosting

Live at https://reefquest.todosenlaweb.com: Worker `reefquest` with that custom domain, static
assets via `cloudflare.config.ts` (SPA fallback). Code is on GitHub at `saintmikenode/reefquest`
(private, `main`). **Workers Builds is connected (since 2026-11-20): pushing to `main` deploys**
(trigger "Deploy main": `npx tsc && npx cf build`, then `npx cf deploy --prebuilt`). A push to any
other branch only uploads a preview version with the branch name as its alias (trigger "Deploy
non-production branches"); production is unchanged. Check builds with `npx cf builds list
--external-script-id <worker tag>` (tag from `npx cf workers scripts search --name reefquest`).
Manual fallback, only if a build is broken or Tulio asks: `npm run build` (it strips the `._*` files
macOS writes on this drive), then `npx cf deploy --prebuilt`.
Never push (and so never deploy) unless Tulio says so in that moment.

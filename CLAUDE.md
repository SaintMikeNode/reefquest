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
Chunks: `index` (top bar, home map, cards; keep it small, ~76 KB gz) → `engine-3d` (three + R3F,
~250 KB gz) → `IslandScene` and each page, loaded with `React.lazy`. Hash routes: `#/`,
`#/island/roatan`, `#/heat`, `#/learn`, `#/about` (`src/lib/router.ts`).

Design: "scientific instrument" look. Tokens and all CSS in `src/styles.css` (dark abyss
background, cyan lines, `.panel` with corner marks, JetBrains Mono for data, Space Grotesk for text,
both self-hosted via @fontsource). Heat colors follow NOAA's alert scale (`src/lib/alert.ts`).

## Layout

- `src/lib/`: `islands.ts` (which islands have a 3D scene), `data.ts` (loaders for `/data/*`, cached), `alert.ts` (CRW alert levels from DHW and
  the color ramp), `router.ts`, `device.ts` (`LITE` mode for weak phones: half-resolution mesh, DPR 1,
  no animated caustics; force with `?lite`).
- `src/i18n/`: `es.json`, `en.json`, `useT()` / `useL()` (picks `{es, en}` pairs) / `useLang`
  (localStorage `rq-lang`; first visit is Spanish unless the browser prefers English).
- `src/content/`: long-form bilingual content with sources: `sites.ts` (dive-site pins and their
  stories), `learn.ts` (explainers). **Every fact needs a source**; don't add unsourced claims.
- `src/pages/`: `Home` (hero, live SVG map with OSM coastlines + today's 5 km heat cells, island
  cards, heat stripes), `HeatPage` (island comparison chart, worst years, alert scale), `LearnPage`,
  `AboutPage` (caveats, data credits and licenses).
- `src/scenes/`: the 3D island scene. `terrain.ts` (decode heightmap, mesh, display scale: relief
  ×4 and depths beyond 40 m compressed; heightfield ray-march picking; lat/lon via the pipeline's
  affine fit), `materials.ts` (terrain shader: hillshade, habitat colors, contours, caustics; water
  shader: NOAA 5 km cells), `IslandScene.tsx` (Canvas with `frameloop="demand"`, pins, camera
  fly-to), `Hud.tsx` (layers, readout, site card), `Timeline.tsx` (year chips, DHW chart, scrubber,
  playback), `sceneStore.ts`.
- `public/data/`: pipeline outputs (committed): `islands.json/.geojson`, `heat/` (index, latest,
  per-island daily series, `grid/<year>.bin`), `roatan/` (terrain.png, habitat.png, meta.json).
- `pipeline/`: Python data scripts (see `pipeline/README.md`). Python env is `~/.venvs/reefquest`
  (internal disk; the exFAT drive breaks installs), managed with `uv`. Raw downloads go to
  `data/raw/` (git-ignored). Heat data comes from the PacIOOS ERDDAP (`dhw_5km`; CoastWatch
  redirects there). Earth Engine project: `reefquest`.
- `docs/`: the handoff/spec and phase reports (`docs/phase0/REPORT.md`).

## Gotchas

- The Cloudflare Vite plugin's dev server only serves `public/` files that existed when it started:
  **restart the dev server after the pipeline writes new data files** (otherwise `/data/...` returns
  the SPA's index.html).
- The scene renders on demand: call `invalidate()` after anything that changes what's on screen.
- The browser pane in the desktop app can throttle requestAnimationFrame, so 3D screenshots there
  may be black; check in a visible browser window.

## Hosting

Planned: Worker `reefquest`, custom domain `reefquest.todosenlaweb.com`, repo
`saintmikenode/reefquest`, static assets via `cloudflare.config.ts` (SPA fallback). **Not deployed:
the Worker doesn't exist yet and Workers Builds isn't connected.** Follow the workspace CLAUDE.md
for the first deploy and connecting the build trigger, and only when Tulio says to deploy. Never push
unless Tulio says so in that moment; once Workers Builds is connected, pushing to `main` deploys.

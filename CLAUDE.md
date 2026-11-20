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
  lat 15.8–16.6, lon -87.1 to -85.7 (`src/data/islands.ts`). No other part of the Mesoamerican Reef.
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
Chunks: `index` (menu, i18n, 2D map; keep it small) → `engine-3d` (three + R3F) → each island scene,
loaded with `React.lazy` when an island opens.

## Layout

- `src/data/islands.ts`: bounding box and the four island groups (menu positions are placeholders
  until Phase 0 derives boxes from coastlines).
- `src/i18n/`: `es.json`, `en.json`, `useT()` / `useLang` (localStorage `rq-lang`; first visit is
  Spanish unless the browser prefers English).
- `src/ui/`: archipelago menu (SVG), language toggle.
- `src/scenes/`: island 3D scenes (currently a placeholder).
- `pipeline/`: Python data scripts (Phase 0+). Raw downloads go to `data/raw/` (git-ignored);
  processed outputs to `public/data/` and `public/models/`.
- `docs/`: the handoff/spec and phase reports.

## Hosting

Planned: Worker `reefquest`, custom domain `reefquest.todosenlaweb.com`, repo
`saintmikenode/reefquest`, static assets via `cloudflare.config.ts` (SPA fallback). **Not deployed:
the Worker doesn't exist yet and Workers Builds isn't connected.** Follow the workspace CLAUDE.md
for the first deploy and connecting the build trigger, and only when Tulio says to deploy. Never push
unless Tulio says so in that moment; once Workers Builds is connected, pushing to `main` deploys.

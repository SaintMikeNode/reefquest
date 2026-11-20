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

Node 24 (`.nvmrc` / `.node-version` / `engines`, matches Workers Builds); `node` and `npm` must be
on the PATH. npm 11+ install scripts are allow-listed in `package.json` (`allowScripts`).
The repo must work on any computer (Tulio uses both a Mac and a Windows PC): no absolute paths,
no OS-specific tools or scripts in the build, and `.gitattributes` keeps text files LF everywhere.
Machine setup (Node install, Python env location) belongs outside the repo.

## Stack

Vite 8 + TypeScript + React 19 + React Three Fiber / drei (three.js), zustand for small state, the
same tools as CopánQuest (`../copanquest`, a useful reference, but don't share code across sites).
Chunks: `index` (top bar, home map, cards; keep it small, ~80 KB gz) → `engine-3d` (three + R3F,
~250 KB gz) → `IslandScene` and each page, loaded with `React.lazy`. Hash routes: `#/`,
`#/islands`, `#/island/roatan`, `#/heat`, `#/learn`, `#/about` (`src/lib/router.ts`).

Design (third direction, from a reference Tulio chose: the FlowOS Framer template; he wants the
site to stop looking AI-made). One confident ocean blue (`--brand`), a rounded white-bordered
"window" for the home hero, headlines that pair bold Inter with an italic
Instrument Serif accent (mark the accent words with `*…*` in the i18n string and render with
`accent()`), pill buttons (`.btn.primary` blue, `.btn.light` white; header nav links are outlined pills, centered with a three-column header grid on computers, the header CTA hidden from 901 to 1239 px so they fit; the hero headline must stay two lines on computers or the data cards fall below the fold), hairline guides with nodes,
and frosted-glass data cards (`.card`, white before; Tulio found the white out of place) sitting on the artwork that show real data (today's alert per
island, the 42-year heat strip). Data sections and the 3D views stay on deep blue (`--deep`,
`--abyss`) so figures keep contrast; figures are rounded cards (`.figure`, `--card` radius); every page except the 3D views sits on one deep navy gradient with a faint dot grid and soft pools of light (`.home` / `.sea-bg`, no bright blue around the hero), and its blocks are frosted glass: the landing page's map, table and stripes are `.window`s, inner pages' `.figure`s get the same tint, hairline edge, top highlight and backdrop blur (less on phones, none on lite; the dots behind are what the blur shows). Tulio asked for a frosted look, consistent everywhere, then found blue-tinted glass too saturated: it is now the 3D HUD panel glass (near-black navy at ~64%, white hairline, neutral grey-blue text), also on the hero data cards; inner
pages open with a blue title band (`.page-band-head`). History: beige/light pages were rejected
("this is a sea project"), and everything must stay consistent across pages and HUDs.
The hero background is `src/ui/DottedSea.tsx` (our own code after the "Dotted Waves" idea Tulio pointed
to; React Bits Pro is paid, so nothing is copied): a calm sea as a field of dots rising and swelling with
drifting swells, brighter and larger on the crests, dimmed under the headline. Schools of reef fish and
an eagle ray, drawn in fine dots, glide underneath, light up the water they pass, and dart away from the
cursor; the pointer leaves a wake of ripples, a click or tap a splash, and now and then a fish rings the
surface. Canvas 2D in a few color buckets (~10 fills a frame); phones 30 fps with fewer dots and fish,
lite 24 fps, reduced motion one still frame. Dev: `window.__rqSea.step(seconds)` advances it (the
browser pane barely runs frames). Earlier heroes, all rejected: a painted sky-and-reef illustration (too
close to the reference: no painted scenery), then three braille (drawille) versions: a ridgeline skyline,
a 3D drone flyover, and a sonar survey of Roatán.
The headline animates with `@overpunch/floodtext` (Tulio's pick): a slow diagonal wave of weight
(Inter is variable) and opacity, letter by letter; Instrument Serif has no weight axis, so the italic
line only takes the opacity. Lazy-loaded with a plain `<h1>` as fallback, remounted per language, static
with reduced motion. The main button ("Explore the islands in 3D", to `#/islands`) wears a liquid-metal
ring from `metal-fx` (the engine of cult-ui's "metal button"; used directly, no shadcn/Tailwind). It is the white
pill (Tulio: the most prominent; "Learn" is the blue one) with a silver ring tuned for light and no glow
(its halo smudged the blue); the white fill sits on the wrapper because metal-fx strips the button's
own, and it is forced visible because metal-fx hides it until its shader paints; lazy, skipped on lite (`ui/MetalRing.tsx`).
Tokens and all CSS in `src/styles.css`. Fonts, self-hosted via @fontsource:
Inter (text, headlines), Instrument Serif (italic accents, big numerals), IBM Plex Mono (data).
Phones: bottom panels clear the gesture bar (`env(safe-area-inset-bottom)`, `viewport-fit=cover`)
and sit 10 px from the sides; panels that stack above the timeline or the boat bar read its measured
height (`--tb`, `--bb` via `useBottomInset`); pin names never overlap or get cut off (`labels.tsx`
hides the lower-ranked name, its marker stays); the story card is opaque on phones; while diving the
research vessel is hidden (its hull filled the view like a red wall). Tables stack into label/value rows on phones; **no horizontally scrolling boxes** anywhere (check
pages at 375 px). Heat colors follow NOAA's alert scale (`src/lib/alert.ts`); surveyed seafloor
uses the turbo ramp (0–30 m).
3D HUD = an atlas plate, not a dashboard: the title plate (kicker, serif name, coordinates, and the
way back as a white pill right under the name), type on a scrim, frosted rounded `.panel`s only
for content (`html.lite` drops the blur; slim rounded scrollbars with no arrow buttons, kept off the content), pill buttons, layer rows with inline legends, cartographic pin labels (no boxes), heading tape
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
- `src/pages/`: `IslandsPage` (`#/islands`: three frosted cards side by side that fit one screen on computers (Roatán, Utila, Guanaja; Cayos Cochinos left out until it has a 3D scene; the preview height follows the window height), each with a live 3D preview in blueprint line art (Tulio found the colored relief too much): coastline, survey grid, land contours and depth lines over a rising light shader with contour lines (our take on React Bits' paid "Shader Card"); hover lifts the light, speeds the turn and swings the camera toward the pointer, the text drifts the other way. All four share ONE fixed WebGL canvas through drei `<View>`; meshes are coarse samples of each island's terrain.png cropped by distance to the coast, deep water dropped; lite and reduced motion render still frames, redrawn on scroll), `Home` (hero whose copy leads with the place and its reefs, then learning, then heat: "Meet the reef around our islands", buttons to the islands page and Learn; Tulio picked this over a satellite-heat headline and a "map the reef" game headline; live SVG map with OSM coastlines + today's 5 km heat cells, island
  cards, heat stripes), `HeatPage` (island comparison chart, worst years, alert scale), `LearnPage`,
  `AboutPage` (caveats, data credits and licenses).
- `src/scenes/`: the 3D island scene. `terrain.ts` (decode heightmap, mesh, display scale: relief
  ×4 and depths beyond 40 m compressed; heightfield ray-march picking; lat/lon via the pipeline's
  affine fit), `materials.ts` (terrain shader: hillshade, natural seafloor colors by habitat with surf
  on the reef crest, or the Atlas classification when the "Habitat map" layer is on, drawn as a chart rather than pixels: the 3 × 3 cells around each point vote with B-spline weights so class edges are rounded curves, with fine outlines and per-class patterns that fade with distance; contours,
  caustics; water shader: NOAA 5 km cells with hairline edges), `IslandScene.tsx` (Canvas with `frameloop="demand"`, pins, camera
  fly-to), `siteBoats.tsx` (pin list, `openSite`, and a small survey boat at anchor at every clickable place,
  tech/holographic style (rejected before: a chunky toy, then see-through hairlines too small): solid
  faceted hull in dark navy with a glowing fresnel rim, scan lines, bright edges, spinning radar;
  white waterline, mirrored reflection, a target reticle with a rotating dashed ring and a sonar
  ping on the water; hover lights it and the pin label, click opens the place; ~40 px on a 1080 px
  screen at any zoom; dev `window.__rqBoatScale` enlarges them), `nature.ts` (instanced palms and forest canopy on land, by elevation and habitat),
  `Hud.tsx` (title plate, layers with inline keys, boat zones, readout, numbered first-visit guide
  `rq-guide-1` (on top of every panel with a dim backdrop, kept above the timeline and scrolling inside
  on short screens; the mouse controls card waits until it is closed), the timeline whose height is published as `--tb` so panels stop above it),
  `MouseGuide.tsx` (computers only: mouse controls card, closable, `rq-mouse-guide-2`; inline in the
  boat bar), island mouse controls: drag moves, Shift (or Ctrl/Cmd) + drag rotates, wheel zooms, and the
  right button does nothing (Tulio: right-drag kept triggering the browser's Back gesture); mouse
  guards in `IslandScene.tsx` (no context menu over the 3D view, side buttons
  ignored mid-drag, the boat is a history step so Back leaves the boat, not the page, and a Back
  that arrives during or right after a right-drag (browser mouse gestures) is undone via `navGuard`
  in `router.ts`; the cursor readout panel is click-through so it doesn't flicker; a press whose release never
  arrives is finished with a synthetic pointerup on the next button-less move or window blur, so
  the camera can't get stuck; a lost WebGL context rebuilds the Canvas via `glKey`), `SiteCard.tsx` (its action, "Explore by boat", is a compact tinted chip (`.card-chip`, not a solid button: the title stays the loudest) right after the place name (16 px semibold), the two wrapping together on narrow cards, the close button pinned to the corner, 18 px before the title; on computers the card stops above the data credits line), `Timeline.tsx` (year chips, DHW chart, scrubber,
  playback), `sceneStore.ts`.
- `src/boat/`: the research-boat mode (lazy chunk, ~21 KB gz). `zone.ts` (detailed zone tiles: 10 m
  relief, 5 m habitat, meters as scene units, depths beyond 60 m compressed), `boatMaterials.ts`
  (seafloor with natural habitat colors + line-of-sight water attenuation + caustics, land in toon
  light bands; sea surface stylized, not photo-real (Tulio: "punchy", not generic): flat color bands
  by depth with thin contours, a drifting cell ripple pattern in patches (skipped on lite), foam
  stripes rolling onto beaches and reef crests, toon sun highlight and round glints; sky; abyss
  floor), `boatModel.ts` (stylized game-like research vessel after a cartoon-tugboat reference,
  in blues and whites (a coral/terracotta version read as a toy): chunky hull with a rising sheer,
  white rail, tire fenders, white wheelhouse with portholes, funnel aft of the wheelhouse, radar
  mast and radome, white A-frame with the CTD rosette, crane, winch, yellow ROV; toon shading with
  ink outlines (none on lite); static parts merged into one mesh per material, ~50 draw calls),
  `sonar.ts` (multibeam swath ≈ 3.5 × depth per side, coverage on a 20 m grid saved in localStorage
  `rq-survey-<zone>`, drawn on the seafloor with the turbo depth ramp; sonar fan mesh), `echo.ts` +
  `Echogram.tsx` (scrolling echo sounder), `corals.ts` (stylized Caribbean reef life: 11 species
  shapes + surface patterns, mix by habitat and depth, dense within ~75 m of the boat and thinning
  out to 380 m, nearest kept when over budget), `props.ts` (shared water tint: from above along the
  line of sight, underwater by distance; `WATER` uniforms), `underwaterFx.ts` (light shafts, marine
  snow). Underwater view: `useBoat.under` (button or U); camera kept between seabed and surface,
  Snell's window on the surface shader, survey overlay hidden. `BoatWorld.tsx` (physics tuned for fun, not realism (Tulio: "a fun interactive experience"): ~31 kn
  top speed in a few seconds, quick turns, bow lift and lean at speed, a bump back off the shallows,
  and the chase camera swings behind the boat unless it is being dragged; throttle/drag/turn, grounding by depth ahead of the
  bow, tap-to-go, WASD/arrows, chase camera, foam collar with bob rings and a bow wave, wake with
  foam edges, buoys at real moorings, fish schools; vegetation: chunky palms and trees near the boat
  and instanced forest clumps out to ~2–3.4 km so far hills aren't bare, distance-culled and capped
  per tier, one draw call per kind; the vessel is hidden while diving),
  `BoatHud.tsx` (title plate with "Back to <island>", heading tape, sounder, survey %, depth key,
  CTD cast button/space bar, logbook mission saved in localStorage `rq-log-<zone>`, field guide of
  nearby species when underwater; on phones: one instrument pill at the top (heading, speed,
  depth; tap for the sounder sheet) and one dock at the bottom (arrival, guide/logbook, actions)).
  Dev only:
  `window.__rqBoat.current.x/z` moves the boat, `window.__boat` is the store.
  Entered from a story card ("Explore by boat"), the "Explore by boat" tab of the layers panel
  (tabs: one open at a time, a second tap closes it), or a green ⛵ place on the island: every zone
  with no story/dive site in it gets a clickable place (`usePlaces` in `siteBoats.tsx`), so Utila
  and Guanaja have theirs; zones are
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
- `pipeline/`: Python data scripts (see `pipeline/README.md`). The committed `public/data/` is
  complete; the site never needs the pipeline or the raw downloads. Raw downloads go to
  `data/raw/` (git-ignored, not kept: a script that needs them downloads them again). Heat data comes from the PacIOOS ERDDAP (`dhw_5km`; CoastWatch
  redirects there). Earth Engine project: `reefquest`.
- `docs/`: the handoff/spec and phase reports (`docs/phase0/REPORT.md`, `docs/phase1/REPORT.md`
  with the boat, the two redesign passes and screenshots).
- `brand/`: the brand kit (logo in horizontal, vertical, mark and wordmark layouts × color-on-dark,
  color-on-light, white, navy and black, as SVG and PNG; app icon, favicons, maskable and Apple icons,
  web manifest; 1200×630 social cards in es/en; `tokens.css`/`tokens.json`; the rules in `README.md`;
  the visual sheet `index.html`, previewed with the `brand` launch config on port 4379). Everything
  but README and index.html is generated by `brand/source/make-brand.cjs` from `src/ui/Logo.tsx` and
  the fonts (wordmark = Inter 650, −0.03 em, outlined); keep the two in sync. The site's
  `public/favicon.*`, `apple-touch-icon.png`, `app-icon-*.png`, `maskable-icon-512.png` and
  `site.webmanifest` are copies from `brand/icon/`, and `public/og-image.png` (the link preview for WhatsApp and the like, set in `index.html` with Open Graph tags and an absolute URL) is `brand/social/og-image-es.png`.

## Performance (phones first)

Budgets measured with `window.__rqGl.info.render` (dev only), Roatán / West End, triangles per frame:

| View | Before | Full | Phone | Lite |
| --- | --- | --- | --- | --- |
| Island | 1,470k | 474k | 157k | 132k |
| Boat | 2,250k | 913k | 267k | 180k |
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

Scene transitions: `ui/SceneTransition.tsx` with transition-style (Tulio's pick), in two phases: a
curtain animates closed over the old scene ("in:" effect), the scene switches behind it (`apply`), and
it animates open ("out:"), waiting while a 3D loading screen is up. The curtain is three layers (aqua,
ocean blue, deep navy) running the same effect 90 ms apart, so a change reads as a burst of color, not a
flat slide (Tulio: "plain slides"). Kinds: `island` (library circles: expanding sonar ping, then an
iris), `page` (custom circle swoop), `board`/`leave` and `dive`/`surface` (custom wavy water line
rising/falling, polygons generated in styles.css). The top layer carries the destination's name (rises
in out of a blur), pulsing sonar rings while a scene loads, or rising bubbles. `transition({kind, label,
sub?, apply})`; App holds the shown route, IslandScene the shown boat. **transition-style 0.1.4's
per-pack CSS files leave out the shape variables their keyframes use** (the effects silently did
nothing): import `transition.hackpack.min.css` before any pack. With reduced motion (e.g. Windows
animation effects off) the scene just switches.

## Gotchas

- A package reached only through a lazy chunk must be listed in `optimizeDeps.include` (vite.config.ts);
  otherwise the dev server re-bundles mid-session and React is loaded twice ("Invalid hook call").
  After `npm i`, restart the dev server.

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
Manual fallback, only if a build is broken or Tulio asks: `npm run build`, then
`npx cf deploy --prebuilt`.
Never push (and so never deploy) unless Tulio says so in that moment.

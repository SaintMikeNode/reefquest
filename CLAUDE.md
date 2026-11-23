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
  One exception, Tulio's call: the sentence "Para apoyar este proyecto, haz clic aquí" after the contact line in the footer, on "Cómo ayudar" and on "Datos y
  créditos" (`src/ui/Support.tsx`; he asked for a sentence, not a button) opens Ko-fi's donation
  panel (`ko-fi.com/saintmikenode`) in a window over the page, as on his Pipodojo site. Nothing
  from Ko-fi loads until a visitor presses it, and the window says the money goes to Saint Mike
  Node, not to the reef organizations. Contact: `hola@saintmikenode.org` or `whatsup@nerdypunk.dev`
  (`Contact` in `src/ui/Credit.tsx`; "escribe a", singular: it's just Tulio).
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
`#/islands`, `#/island/roatan`, `#/learn` (two tabs: `#/learn/heat`, the main one, and
`#/learn/lessons`; the old `#/heat` opens the heat tab), `#/support`, `#/about`
(`src/lib/router.ts`). Menu: Islas, Aprende, Cómo ayudar, Datos y créditos.

Design (third direction, from a reference Tulio chose: the FlowOS Framer template; he wants the
site to stop looking AI-made). One confident ocean blue (`--brand`), a rounded white-bordered
"window" for the home hero, headlines that pair bold Inter with an italic
Instrument Serif accent (mark the accent words with `*…*` in the i18n string and render with
`accent()`), pill buttons (`.btn.primary` blue, `.btn.light` white; every text button is a full pill (999px) with its label never squeezed against the ends: the layers panel is 356 px so its two tabs fit with 14 px padding, and they stack on very narrow phones; header nav links are outlined pills, centered with a three-column header grid on computers, the header CTA hidden from 901 to 1239 px so they fit; the hero headline must stay two lines on computers or the data cards fall below the fold), hairline guides with nodes,
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
(Inter is variable), a gentle rise of each letter (a swell, `--ft-y`) and a slight dimming, letter by letter
(opacity never below ~88%: the library's own opacity effect went to ~40% and Tulio found words unreadable); Instrument Serif has no weight axis, so the italic
line only takes the rise and dimming. Lazy-loaded with a plain `<h1>` as fallback, remounted per language, static
with reduced motion. The main button ("Explore the islands in 3D", to `#/islands`) is the white pill
(Tulio: the most prominent; "Learn" is the blue one). Important calls to action are Specular buttons
(`ui/SpecularButton.tsx`, React Bits' "Specular Button", MIT + Commons Clause, ported to TS; Tulio's
pick, replacing an earlier metal-fx ring): our `.btn`/`.card-chip` pills with a rim that catches the
light and a highlight that follows the cursor (a tiny WebGL2 canvas per button, redrawn only while the
light moves; plain pill on lite, without WebGL2, and no gliding with reduced motion). Used on: the hero
islands button and header "Explore in 3D" (white, blue light), "Explore by boat" in story cards
(solid ocean blue, white light), "Open in 3D" in the hero data card and the islands page cards. The
component renders a link (`href`), a button, or a span inside a larger link (`as="span"`). `attract`
(seconds) makes the light run once round the rim on its own now and then (1.7 s, every 4 s on the
story card's "Explore by boat", Tulio: so people see it is the thing to press; phones have no
hover): a timer between sweeps, nothing drawn, paused off screen or in a hidden tab, off with
reduced motion and on lite.
Tokens and all CSS in `src/styles.css`. **Pills come in three sizes only** (the "Pill system" block at the end of
styles.css; Tulio: pills that differed in height, rounding and alignment "cannot feel like slop"):
S 30 px (chips in cards and on the map, tabs, segments, close buttons, the button inside a tag),
M 36 px (HUD and header buttons, messages, the way back on phones), L 44 px (hero and card
buttons, the way back on computers, the boat dock); all fully rounded, labels weight 600, one icon
size per height, a little less padding on a leading icon's side. A new pill takes one of these
sizes; don't set its height or padding elsewhere. A label that clips to "…" keeps a line box of at least 1.35 (line-height 1
cut the g of "Bajo el agua"), and buttons side by side as a pair (the boat dock) share one width. Round buttons follow the same heights (close buttons S, tool and arrow
circles M, play and lightbox L). **Box corners come in four sizes too** (`--r-xl/l/m/s` in styles.css; Tulio: two
boxes that differed in rounding "look different"): XL the home page's big windows, L 22 px every panel,
card, sheet, menu and dialog (HUD panels, the phone bar, the timeline, cards, figures), M 14 px photos
and rows inside a box, S 8 px thumbnails, tooltips and focus rings; marks and key caps under ~20 px keep
2–5 px, and a box holding pills is concentric with them. A new box takes one of these. **Messages are one
family** ("Messages" block at the end of styles.css: toasts and warnings, the tap hint, the camera's
subject, the arrival and mission tags): rounded by half their one-line height (a pill on one line, a
rounded box on two), text balanced into even lines and centered when the box is, the leading dot inline
with the first line. Running into the shallows says "Agua poco profunda" (shown ~3 s per bump,
`groundedAt` in the boat store); the zone's edge has its own message. On phones the top row (the name, the tools) sits 16 px from the top
edge (Tulio: 10 was too close). **The island and boat views on phones are laid out like an app** (Tulio: easier
to use): a bottom bar (`.scene-nav` in `Hud.tsx`) with four tabs, all islands, Capas (the layers
panel with its "Explore by boat" tab), Calor (the timeline) and the other language; Capas and Calor
open as sheets right above the bar, one at a time (Calor starts open so the intro is seen), and a
story card replaces them. The top row keeps only the name (left) and help and view reset (right).
Its height is `--nb`; phone panels stand on it. Computers are unchanged. Fonts, self-hosted via @fontsource:
Inter (text, headlines), Instrument Serif (italic accents, big numerals), IBM Plex Mono (data).
Phones: bottom panels clear the gesture bar (`env(safe-area-inset-bottom)`, `viewport-fit=cover`)
and sit 10 px from the sides; panels that stack on another read its measured height (`--nb` the bottom
bar, `--tb` the timeline, `--bb` the boat's Equipo sheet, `--sb` the sonda, via `useBottomInset` /
`useInsetRef`, measured without a sheet's slide-in offset so the gap stays even); pin names never overlap or get cut off (`labels.tsx`
hides the lower-ranked name, its marker stays); the story card is opaque on phones, and its action ("Explore by boat") always stays beside the place
name (a long name wraps in its own column; "By boat" on narrow cards; Tulio found it jumping below
the name on some cards); while diving the
research vessel is hidden (its hull filled the view like a red wall). Tables stack into label/value rows on phones; **no horizontally scrolling boxes** anywhere (check
pages at 375 px). Heat colors follow NOAA's alert scale (`src/lib/alert.ts`); surveyed seafloor
uses the turbo ramp (0–30 m).
3D HUD = an atlas plate, not a dashboard: the title plate (kicker, serif name, coordinates, and the
way back as a white pill, "All islands", to `#/islands`), type on a scrim, frosted rounded `.panel`s only
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
  stories: Roatán 12, Utila 14, Guanaja 20. A place can carry `nameEs` (label in Spanish when it has
  no proper name), `approx` (shown as "approximate location"), `scene` (animals documented there,
  drawn in the boat mode: `whale-shark`, `turtles`, `reef-sharks`, `stingrays`) and `wreck` (length and how it
  lies, for the ship on the seafloor). Where positions come from: Roatán, the marine park's mooring
  list; Utila, survey sites printed in open-access papers and PADI's site pages; Guanaja has no
  published GPS list, so every position there was read off two dive maps (Franko's Maps 2017, which
  has a grid, and Clearwater Paradise Resort's), pinned only where the two agree and marked
  approximate; the maps' artwork is not used. Left out on purpose: sites whose sources disagree on
  the position, and coordinates that trace back to AGRRA. The dolphin lagoon on Roatán is a story
  only, with no animals drawn: those dolphins are captive and the card says so), `learn.ts` (explainers; `src/ui/LessonFigures.tsx` draws the bleaching and DHW
  diagrams), `reefLife.ts` (underwater field guide: species names and how to recognize them). **Every fact needs a source**; don't add unsourced claims.
- `src/pages/`: `IslandsPage` (`#/islands`: four frosted cards in a row (2 × 2 under 1180 px, one column on phones): the three islands and a photos card (a ring of reef photos turning in CSS 3D; opens the dome of every photo); every button sits at the bottom of its card so they line up; each island card shows its mapped reef area (`reef_km2` in meta.json, from `pipeline/reef_area.mjs` on the Allen Coral Atlas habitat map) before the record year, so it isn't all bad news. The island cards: text and button centered, with a pure-CSS blueprint texture (a faint grid fading to the edges and a wireframe floor in perspective under each island) that fit one screen on computers (Roatán, Utila, Guanaja; Cayos Cochinos left out until it has a 3D scene; the preview height follows the window height), each with a live 3D preview in blueprint line art (Tulio found the colored relief too much): coastline, survey grid, land contours and depth lines over a rising light shader with contour lines (our take on React Bits' paid "Shader Card"); hover lifts the light, speeds the turn and swings the camera toward the pointer, the text drifts the other way. The island previews share ONE WebGL canvas, each drawn into its stage's rectangle (scissor) from its own portal scene and camera. The canvas lies in the grid over the island stages and scrolls with the page, **not `position: fixed`**: phones scroll on the compositor without waiting for a redraw, and a fixed canvas (drei `<View>`) left the islands behind, drawn outside their cards (Tulio). Meshes are coarse samples of each island's terrain.png cropped by distance to the coast, deep water dropped; animated previews more than a screen away are skipped; lite and reduced motion render still frames, redrawn only on layout changes and hover), `Home` (hero whose copy leads with the place and its reefs, then learning, then heat: "Meet the reef around our islands", buttons to the islands page and Learn, and "Watch the demo" (blue, play icon): on computers one row with the white islands button exactly centered (a three-column grid; a centered row centered the group, Tulio), the demo on its left, Learn on its right; on phones stacked Learn, islands, demo. The demo (`ui/DemoVideo.tsx`, a lazy chunk) is Tulio's one-minute recording in a floating window: nothing of it, code, poster or video, loads before the press; Spanish or English by the site's language; `public/video/` holds web encodes of the 1080p originals, all with fast start: phones and slow connections get 720p H.264 (~8.6 MB; many phones can't decode AV1 smoothly), computers 1080p AV1 (SVT-AV1 CRF 44, ~9 MB, measured SSIM 0.985) or, where AV1 won't play, 1080p H.264 (CRF 28, ~16.7 MB, SSIM 0.984), as `<source>`s in that order; keep every file under Cloudflare's 25 MiB asset limit; JPEG posters (this ffmpeg has no WebP encoder); Escape, the close button or a click outside closes it; Tulio picked this over a satellite-heat headline and a "map the reef" game headline; live SVG map with OSM coastlines + today's 5 km heat cells, island
  cards, heat stripes; on phones the yearly heat card puts "Open in 3D" at the top right beside a
  two-line title, with the islands in two rows), `LearnHub` ("Aprende": the heat data and the lessons as two liquid tabs, Tulio's call to merge
  them; `LiquidTabs page` is the page-size version of the tabs on the 3D layers box: only the top of
  the panel goes through the goo filter, no height or blur animation; switching tabs rewrites the
  address with `replaceState` and plays no curtain); on arrival the closed tab's label pulses three times (from 1 s, after the curtain;
  brighter and 6% bigger; ends at the first press; Tulio: "Lecciones" didn't read as clickable) with its two panes `HeatPage` (island comparison
  chart, worst years, alert scale) and `LearnPage` (lessons), `SupportPage` ("Cómo ayudar": the
  conservation organizations by island from `src/content/support.ts`; every statement comes from the
  organization's own site, read on `SUPPORT_CHECKED`; only organizations with a working website; the
  page links out, handles no donations and says ReefQuest is independent),
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
  screen at any zoom; dev `window.__rqBoatScale` enlarges them. Each boat is several draw calls and
  an island has up to 21, so: the click target is `visible={false}` (pointer rays still hit it) and
  phones skip the reflection and the ping, which would sit frozen there anyway), `nature.ts` (instanced palms and forest canopy on land, by elevation and habitat), `plane.tsx`
  (a small Cessna-like high-wing plane, white with blue trim, flying a loop 1–3 km off each
  island's coast at a fixed height above its highest ground, one lap in 70–100 s. **Not drawn in
  the 3D scene**: phones redraw the island only on change, and a plane in the scene stood still and
  then jumped (Tulio). It is a small SVG over the canvas, placed where its 3D position projects and
  turned and squashed with the view (a CSS matrix from its projected nose and wing axes, wings
  narrowing as it banks), with its shadow on the sea. The compositor moves it: no 3D redraw, no
  repaint, ~30 updates a second on phones, every frame on computers, and it follows every redraw
  when the view moves. Parked with reduced motion; never takes the pointer; dev
  `window.__rqPlaneScale` enlarges it),
  `Hud.tsx` (title plate, layers with inline keys, boat zones, readout, numbered first-visit guide
  `rq-guide-1` (on top of every panel with a dim backdrop, kept above the timeline and scrolling inside
  on short screens; the mouse controls card waits until it is closed), the timeline whose height is published as `--tb` so panels stop above it),
  `MouseGuide.tsx` (computers only: mouse controls card, closable, `rq-mouse-guide-2`; inline in the
  boat bar), island mouse controls: drag moves, Shift (or Ctrl/Cmd) + drag rotates, wheel zooms, and the
  right button does nothing (Tulio: right-drag kept triggering the browser's Back gesture); mouse
  guards in `IslandScene.tsx` (no context menu over the 3D view, side buttons
  ignored mid-drag, the boat is a history step so Back leaves the boat, not the page, and a Back
  that arrives during or right after a right-drag (browser mouse gestures) is undone via `navGuard`
  in `router.ts` (never one caused by a link click; a right-drag whose release was swallowed ends on the next move without the right button); the cursor readout panel is click-through so it doesn't flicker; a press whose release never
  arrives is finished with a synthetic pointerup on the next button-less move or window blur, so
  the camera can't get stuck; a lost WebGL context rebuilds the Canvas via `glKey`), `SiteCard.tsx` (its action, "Explore by boat", is a compact tinted chip (`.card-chip`, not a solid button: the title stays the loudest) right after the place name (16 px semibold), the two wrapping together on narrow cards, the close button pinned to the corner, 18 px before the title; on computers the card stops above the data credits line), `Timeline.tsx` (year chips, DHW chart, scrubber,
  playback (6 days a step, ~2 s a year; Tulio found 3 days too slow); on entering an island an intro
  plays the island's hottest year on record, the whole year from 1 January to 31 December, at 4
  days a step (~3 s), and stops at its end (Tulio: so the islands' differences show drastically;
  not stopped on the peak, he wants the whole year; it used to play the current year to the latest
  day): Roatán and Utila 2024, Guanaja 2023, worked out from the island's daily series (`introEnd`
  in the store). By 31 December the heat has eased (Guanaja 3.9 °C-weeks); the year's curve and its
  stripe keep the peak. Earlier: four years was too drastic and 2 days a step too slow. It starts after the curtain
  and the first-visit guide, with the year's grid preloaded; `introPending` in the store makes it
  play once per visit, not again after the boat; any play/pause or scrub ends it; reduced motion
  skips it; the play button is a large glowing blue disc with a sonar ring pulsing out of it until
  the first press, remembered in localStorage `rq-played`), `sceneStore.ts`. The island's `World`
  follows the day through `useScene.subscribe` (refilling the heat texture), not a React
  dependency: re-rendering the whole 3D tree every playback step left the mouse unresponsive.
- `src/boat/`: the research-boat mode (lazy chunk, ~21 KB gz). `zone.ts` (detailed zone tiles: 10 m
  relief, 5 m habitat, meters as scene units, depths beyond 60 m compressed), `boatMaterials.ts`
  (seafloor with natural habitat colors + line-of-sight water attenuation + caustics, land in toon
  light bands; sea surface stylized, not photo-real (Tulio: "punchy", not generic): flat color bands
  by depth with thin contours, a drifting cell ripple pattern in patches (skipped on lite), foam
  stripes rolling onto beaches and reef crests, toon sun highlight and round glints; sky; abyss
  floor), `boatModel.ts` (R/V Arrecife: toon-stylized like a game boat but shaped like a modern
  coastal research ship, after a French oceanographic fleet vessel Tulio picked (a cartoon-tugboat
  version with a funnel and tire fenders read as another kind of boat; a coral/terracotta one as a
  toy). High bow; hull painted in bands (`hullBand`): dark navy below a yellow line rising to the
  bow, blue topsides, the bow's white sweeping down diagonally, dark rub rail, portholes; white
  forecastle bulwark, navy bulwark round the open grey working deck aft; white deckhouse with
  square windows, bridge with a raked wraparound window band under a yellow brow, railed top deck
  with two radomes and a tall white mast (two spinning radars); navy A-frame with the CTD rosette,
  navy side gantry, crane, winch, yellow ROV, orange rescue boat on a davit. No funnel. The hull is
  open at the top (the deck closes it) and has rings up its side so the bands sit flush. Toon
  shading with ink outlines (none on lite); static parts merged into one mesh per material: ~24k
  triangles, 30 draw calls),
  `sonar.ts` (multibeam swath ≈ 3.5 × depth per side, coverage on a 20 m grid saved in localStorage
  `rq-survey-<zone>`, drawn on the seafloor with the turbo depth ramp; sonar fan mesh), `echo.ts` +
  `Echogram.tsx` (scrolling echo sounder), `corals.ts` (stylized Caribbean reef life: 11 species
  shapes + surface patterns, mix by habitat and depth, dense within ~75 m of the boat and thinning
  out to 380 m, nearest kept when over budget), `props.ts` (shared water tint: from above along the
  line of sight, underwater by distance; `WATER` uniforms), `underwaterFx.ts` (light shafts, marine
  snow). Underwater view: `useBoat.under` (button or U); camera kept between seabed and surface,
  Snell's window on the surface shader, survey overlay hidden. `BoatWorld.tsx` (physics tuned for fun, not realism (Tulio: "a fun interactive experience"): ~50 kn
  top speed in a few seconds, quick turns, bow lift and lean at speed, a bump back off the shallows,
  and the chase camera swings behind the boat unless it is being dragged; throttle/drag/turn, grounding by depth ahead of the
  bow, tap-to-go, WASD/arrows, chase camera, foam collar with bob rings and a bow wave, wake with
  foam edges, buoys at the places (all of them in two instanced draw calls), fish schools; vegetation: chunky palms and trees near the boat
  and instanced forest clumps out to ~2–3.4 km so far hills aren't bare, distance-culled and capped
  per tier, one draw call per kind; the vessel is hidden while diving),
  `BoatHud.tsx` (title plate with "Back to <island>", heading tape, sounder, survey %, depth key,
  CTD cast button/space bar, logbook mission saved in localStorage `rq-log-<zone>`, field guide of
  nearby species when underwater; on phones: the name and an instrument pill (heading, speed,
  depth) on top, and the same bottom bar as the island: the way back (to the island, or
  "Superficie" under the water), Equipo/Tools (the dock: arrival, guide/logbook, actions; the
  camera and CTD under the water), Fotos (the zone's gallery, under the water too) and Sonda (the
  sounder); Equipo and Sonda are sheets on the bar, Equipo starts open, the bar hides while the
  camera is up. The sonda opens on the bar whether its tab or the instrument pill at the top opened
  it, closing whatever else was there, so nothing ever overlaps).
  `places.ts` (`zonePlaces(zone)`: where each place of `sites.ts` sits in a zone, worked out once
  and shared by buoys, tags, the arrival check, wildlife and wrecks; `subject`: what the mission in
  range is about, which the underwater view starts out facing).
  **Missions** (`wildlife.tsx`; Tulio: "each place has to feel original and individual, like a
  game", and the first version, a speck of a shark in flat water, was "boring and lame"). Every
  place with a `scene` or a `wreck` is a mission with three steps: find it, see it, photograph it
  underwater. Each has its own cast, its own water (`MOODS` in `props.ts`: open cobalt water off the
  shelf, bright turquoise shallows, steel blue over sand, deep blue-green by a hull; colors at eye
  level and straight down, plus visibility, eased as the boat comes and goes) and its own rules:
  - whale shark (Utila NE): at the surface a tuna boil (white water, leaping tuna, seabirds
    wheeling, what captains look for) with the shark's dark shape under the surface; under it a
    bait ball (a school moving entirely in its vertex shader), the shark and a pod of dolphins. The
    island's guidelines are the rules: inside the 90 m contact zone under 10 knots (3 was too hard to play, Tulio) (the speed limit
    is the game's rule, the story says so) and out of the white water, or it dives for 30 s. Hold
    still and it comes over and circles the boat at ~10 m; the snorkel view stays near the surface
    (the guidelines allow snorkeling only) with the dolphins swinging in.
  - turtles (Pumpkin Hill, the West End reserve) and reef sharks (Cara a Cara, with the bait
    bucket the dive is named for): under the water they close in and circle at arm's length.
  - stingrays (`rays.ts`; Stingray Point on Utila, from We-Dive Utila and PADI, and Hole in the
    Wall on Roatán, from Reef Builders 2017: the dive guides that say stingrays are seen there;
    Tulio asked for them where the sources allow, in place of the divers): stingrays (a blunt
    diamond with a tail, margins rippling in the vertex shader) gliding low over the sand and now
    and then settling on it, and a spotted eagle ray (pointed wings it flaps, white spots) cruising
    higher; the sources don't name the stingray species, and the story says the shapes are
    illustrative. Under the water they cross the sand in front of the mask (the divers' oval,
    `frontAnchor`). ~280 triangles a ray, two draw calls. Pale aqua water over sand (`MOODS`).
  - divers (every plain dive site, `kind: "dive"` with no `scene` or `wreck`: 25 places, all inside
    a zone; Tulio: those places felt empty): a group of 2–4 scuba divers (`divers.ts`, ~630
    triangles each, flutter kick in the vertex shader, one instanced draw call) following their
    guide in a slow loop near the buoy at the site's depth, breathing out bubbles. From the boat
    (the surface is opaque) they show as foam patches of bubbles breaking the surface, drawn
    larger than life so they can be spotted. Under the water they come to a flat oval in front of
    the mask, as wide as the view (narrow on a phone held upright), so they keep crossing it.
    Plain reef water, no mood. The tag's button opens the site's photos above the water.
  - wrecks (`wreck.ts`, Halliburton, Jado Trader, El Aguila): a small freighter built in code,
    upright, on its side or in pieces as the sources describe, one mesh of ~400 triangles, unlit
    with its shading baked into vertex colors, and a school of fish over the deck. The zones'
    bathymetry is far smoother than the real reef, so a wreck is laid down the model's slope at its
    documented depth (up to 520 m from its pin; its buoy and tag go with it). Underwater the view
    stands off the hull's side and above the deck: it used to start inside the 73 m Jado Trader.
  **Every mission has a ring on the water** (`missionRings.ts`; Tulio: where to go under was
  ambiguous; "cool and subtle"): its area (the range where the mission is on: 80 m, a wreck's
  half length + 30 m, the whale sharks' 90 m contact zone) in the mission's tag color, a dashed
  edge turning slowly, a soft glow inside it, a ripple running out every few seconds (none on
  lite); solid and brighter while the boat is inside, dim once its photo is taken, fading past
  ~1 km. All of a zone's rings are one instanced draw call; hidden under the water.
  **Whatever there is to see comes close, and the player is always told what to do**: the mission
  tag (`MissionTag` in BoatHud: icon, the place on its own line with three step bars, one line of
  what to do now, the story button; in the family of the arrival tag, Tulio found the bordered box
  with a colored label run into the text "vibe coded") replaces the arrival tag in range; on boarding
  a message names what the zone has; the logbook lists it ("What to look for here") with distance and
  bearing, and a press sails there (stopping short of the whale sharks' contact zone). A place with
  a mission does not open its story card on arrival (the card would cover the tag); on phones no story
  opens by itself (it hid the boat and the tools): arriving opens the Equipo sheet with "Read the story". A new mission
  needs its texts (`mission.<type>.<state>` in both languages), its icon (`PlaceMark`), its mood and
  its photo subjects.
  **Camera** (`photos.ts`, after CopánQuest's `game/camera.ts`): underwater only, button "Cámara" or
  F; the viewfinder marks the part of the screen a photo keeps (a centered 16:9 box, the same numbers
  in `cropShare` and `.vf-frame`), names the subject in frame (worked out 5×/s from
  `photoSubjects`, which each scene keeps current: the shark, every turtle and shark, ten points
  along each hull), and the shutter (or F / Enter) saves a 480 × 270 JPEG (~6–30 KB) right after a
  frame is drawn (`fulfilShot`; the drawing buffer is only readable then). One photo per mission in
  localStorage `rq-photos-v1`; the photo completes the mission. The logbook has two tabs, Habitats
  and Photos (the album: a frame per mission of the island the boat is at, Tulio's call, since all
  34 at once was too much: Roatán 8, Utila 13, Guanaja 13; this zone's first under "In this zone",
  then "Elsewhere on <island>"; the photo or the mission's outline, a one-press save; photos from
  other islands stay saved). Only the viewfinder's buttons take
  the pointer: a drag inside the frame turns the view.
  Camera mode hides the side panels, the title and the dock (and the bottom bar on phones). Under the water the way back on the
  title plate is "Back to the surface" (it surfaces; "Superficie" on phones), and the place's photo
  gallery (the Photos chip, "See photos") is not offered on computers: the camera is (phones keep
  Fotos in the bottom bar, Tulio's call). The dock then holds only
  Camera and CTD (Tulio: a second way up was redundant). On phones a cast shows only its depth and
  no label is ever cut (checked in Spanish at 360 px).
  **Place tags**: every place of the zone is a tag over the water (icon by kind, name, distance; a
  press sails there). **A place the view faces always has its tag on screen** (Tulio: they hid and
  only flashed for a moment; far places sit on the horizon at the very top, under the compass and
  the title). `labels.tsx`, nearest first: the tag goes above its place, held inside the screen;
  slides sideways off a panel along the edge; then steps up, or else down, past any HUD box or tag
  it would cover (it re-reads the HUD's boxes twice a second), keeping last frame's direction so
  tags don't trade places back and forth; the step is eased so a change of slot glides. The stem
  joins tag and place only when the tag is right above it. Hidden only when it faces away or no
  spot is free. The top center is one stack (`.top-stack`: mission or arrival tag, then
  messages), so they never cover each other; on computers `useStackRoom` keeps it centered on the
  screen (Tulio: it drifted beside long zone names): beside the title, which is held to its side
  and wraps long names onto two lines (32 px instead of 38 when the room is tight), or, on a
  narrower window, under the title, still centered, the mission tag's story button as its icon alone;
  on phones it stands on whatever is open at the bottom (Equipo, the sonda, or just the bar;
  messages used to cover the title there).
  **CTD**: the A-frame (its own group, pivoting at the foot of its legs) swings out over the stern
  before the rosette goes down and back after it comes up: the sheave used to sit 0.15 m behind the
  transom and the rosette cut through the hull.
  **None of this costs anything away from its place**: every scene is hidden and its animation
  skipped until the boat is within sight (1300 m for a boil's birds, 300–380 m for the rest). The
  underwater view goes no deeper than 36 m (`DIVE_MAX`), not to a 300 m seabed. Underwater the
  backdrop is `WaterDome` (`underwaterFx.ts`: the water's color by direction, with rays of sunlight;
  no rays on lite). Sightings are saved in localStorage `rq-seen-<zone>`.
  Dev only:
  `window.__rqBoat.current.x/z` moves the boat, `window.__boat` is the store, `window.__rqCam()`
  is the camera, `window.__rqPlaces(zone)` and `window.__rqSubject` are the places and the mission
  subject. Use these in tests, not `import()` of the modules: after a hot reload the app runs
  modules with a `?t=` stamp, and a plain import gets a second, idle copy.
  Entered from a story card ("Explore by boat"), the "Explore by boat" tab of the layers panel
  (tabs: one open at a time, a second tap closes it), or a green ⛵ place on the island: every zone
  with no story/dive site in it gets a clickable place (`usePlaces` in `siteBoats.tsx`), so Utila
  and Guanaja have theirs; zones are
  listed in `pipeline/zones.json` and built by `pipeline/zone_tiles.py` (each ~80–350 KB, loaded
  only when entered). Roatán has 7 (West End, Cordelia, Mary's Place hand-picked around stories; Big
  Bight, Diamond Rock, Santa Elena, Pelican Point picked as the most coral-rich 4 km windows, named
  after the nearest OSM place), Utila 5, Guanaja 6: every place on those two islands is inside a
  zone. The eight added on 2026-11-20 (Utila north-east, harbor, north, south; Guanaja Southwest
  Cay, leeward, north, south-east cays) were built with `pipeline/zone_from_island.py`, which
  resamples the island's own model and needs no Earth Engine: coarser seafloor, same files, and
  `zone_tiles.py <id>` rebuilds any of them at full detail once Tulio has signed in again. The boat starts at the reef spot (4.5–14 m, coral
  or hard bottom around) nearest the site, anywhere in the zone.
- `src/scenes/labels.tsx`: screen-space labels (one projector + plain DOM), used instead of drei
  `Html` (which threw removeChild errors on unmount with React 19).
- `public/data/`: pipeline outputs (committed): `islands.json/.geojson`, `region.json` (GEBCO
  contours + mainland coast) and `relief.bin` (elevation grid for the footer's contour landscape, 350 × 200 at ~430 m: GEBCO for the sea, each island's DEM for its land, built by `pipeline/relief_land.py` after `region_relief.py`; with GEBCO's coarse means alone Roatán drew as a few islets), `heat/` (index, latest, per-island daily series, `grid/<year>.bin`;
  all 42 NOAA years, 1985 → 2026-11-18), and one folder per island (`roatan/`, `utila/`,
  `guanaja/`, `cayos-cochinos/`: terrain.png, habitat.png, meta.json, `zones/` for boat tiles).
  To refresh heat: `crw_download.py --all` (skips years already downloaded; PacIOOS is slow, ~3–6 min
  a year) → `heat_products.py` → restart the dev server.
- `pipeline/`: Python data scripts (see `pipeline/README.md`). The committed `public/data/` is
  complete; the site never needs the pipeline or the raw downloads. Raw downloads go to
  `data/raw/` (git-ignored, not kept: a script that needs them downloads them again). Heat data comes from the PacIOOS ERDDAP (`dhw_5km`; CoastWatch
  redirects there). Earth Engine project: `reefquest`.
- Photos (Tulio asked for pictures of the places): `pipeline/photos.mjs` (Node, no packages) downloads
  the curated `pipeline/photos.json` into `public/data/photos/` (`index.json` + each photo at 240 and
  500 px, unmodified). Openly licensed only: iNaturalist (CC0, BY, BY-NC, BY-SA, BY-NC-SA; never ND)
  and Wikimedia Commons (the El Aguila wreck). Picked by eye for beauty and fit: no watermarks, faces,
  catches or hands. Captions say "taken here" only when the photo's own coordinates are within 1.5 km
  of a site / 3 km of a zone center, otherwise the island ("elsewhere on Roatán"); hidden locations
  say "the Bay Islands". Shown in story/dive cards (`ui/PhotoStrip.tsx`, under the title), in a
  Photos chip on the boat's title plate for every zone (Roatán, Utila, Guanaja), from the arrival bar
  near dive sites, as thumbnails in the boat field guide (credits under the list), and all together
  with credits on Data & credits. Galleries (our own code, after React Bits' Circular Gallery, Dome
  Gallery and Masonry): `ui/CurveCarousel.tsx` (cards' photo strips, a CSS 3D arc, with round arrow buttons floating on the sides of the middle photo for people who don't drag), `ui/Lightbox.tsx`
  (full-screen photo with credit), `ui/DomeGallery.tsx` (images load eagerly and taps are matched to tiles in code: inside the 3D sphere the browser neither lazy-loads nor hit-tests the tiles; every photo on a sphere, lazy, "See all the
  photos" via `ui/AllPhotos.tsx`; lite gets a grid), and a masonry of credits on Data & credits whose columns all end on one line (the photos of the shorter columns grow a few percent, cropped).
  Loaded lazily, only when shown. BY-NC licenses depend on ReefQuest
  staying free and nonprofit. USF Ogden slides and CoralNet images need written permission (not used).
- `docs/`: the handoff/spec and phase reports (`docs/phase0/REPORT.md`, `docs/phase1/REPORT.md`
  with the boat, the two redesign passes and screenshots).
- `brand/`: the brand kit (logo in horizontal, vertical, mark and wordmark layouts × color-on-dark,
  color-on-light, white, navy and black, as SVG and PNG; app icon, favicons, maskable and Apple icons,
  web manifest; 1200×630 social cards in es/en; `tokens.css`/`tokens.json`; the rules in `README.md`;
  the visual sheet `index.html`, previewed with the `brand` launch config on port 4379). Everything
  but README and index.html is generated by `brand/source/make-brand.cjs` from `src/ui/Logo.tsx` and
  the fonts (wordmark = Inter 650, −0.03 em, outlined); keep the two in sync. The README's figures (`brand/readme/banner.svg`, an animated dotted-sea banner in English with the islands traced from OSM, and `heat-stripes-roatan.svg` from `latest.json`) come from `brand/source/make-readme-banner.cjs`; re-run it when heat data or the logo change. The site's
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
Missions, measured the same way (2026-11-21): beside the whale shark boil 140k / 74k / 56k
triangles (full / phone / lite), 45–49 draw calls; snorkeling with it 6k / 4k (19 / 15 calls); a
wreck from below 3–11k. The island view of Guanaja, with 21 places, draws 194 calls on computers
(the plane is not in the 3D scene).
Keep new 3D features inside these budgets and check all three tiers. Not yet verified on a real
low-end Android phone.

Interaction feel (Tulio: "smooth and interactive like an Apple app", on phones and desktop):
- Motion (`motion` package) only in lazily loaded chunks (island, boat, islands page), never in the
  first-load bundle; the header and home use CSS. Shared presets in `ui/motionPresets.ts` (spring, no
  wobble, rise in through a light blur, quick fade out; no blur on lite).
- Layers box: `ui/LiquidTabs.tsx` (after pinui's "Liquid Tabs"): panel body and active tab merged by
  a goo filter so the tab is a folder tab that flows to the next label; the body's top corners are square
  and the tab is rounded only on top (rounded ones notched both edges where body and strip meet); the tab not open sits on a lighter
  blue-grey strip with muted text, the open one is the dark folder with a white label and sky-blue icon; content slides out/in by
  direction through a blur, height eases. One tab is always open (no second-tap collapse).
- Folding panels (the boat's logbook and sounder) open and close with `ui/Fold.tsx`: on computers
  the height eases (~0.3 s) while the content fades; phones and tablets only fade and slide it
  (no layout animation there); still with reduced motion. Use it for any new fold-out section.
  The logbook's head and its Habitats / Photos tabs stay put while the list under them scrolls
  (`.log-scroll`; Tulio: the tabs scrolled out of sight). A panel's own scrollbar stops short of
  its rounded corners (track margin), so no bar runs out of its box.
- Boat view on computers: the action buttons (Dive / Camera, Cast CTD) stand at the bottom center
  with the controls card under them (Tulio: they sat too far in the corner); the logbook or field
  guide is on the left (at least 300 px) and, from 1100 px of width, the sounder in the right corner
  level with it (Tulio: HUD consistency; it folds open upward, and the dock's right column is kept
  at least its width so nothing runs under it; narrower, it stays top right); under 1100 px of width
  the controls card steps aside, and
  in the phone layout (also a narrow desktop window) it is hidden (it sat over the buttons).
- Map layers fade (~350 ms ease-out) instead of switching: the shaders blend by `uShowHabitat`,
  `uShowContours`, `uShowHeat` (0..1), and dive sites by `sitesFade` (boats scale, markers and labels
  fade; always mounted, unclickable while off).
- Panels animate in and out with AnimatePresence: story/dive cards (cross-fade between sites), the
  readout, the first-visit guide and its backdrop, the boat's gallery and sounder; the phone layers
  panel slides and fades; checkbox ticks pop in; layer color keys slide open.
- Header links (desktop) and the ES/EN toggle are 3D chips (after pinui's "Chips", CSS only, no
  sounds): a lip under each, a press sinks the chip onto it, the current page / language stays pressed
  in, inverted. Dark chips in the 3D views.
- Data & credits shows the project credit (`ui/Credit.tsx`, `badge`) as a frosted pill under the
  title. On phones the credit is two lines, "Código abierto de NerdyPunkDev," / "parte de Todos en la
  Web." (the full sentence didn't fit and a third line left the name alone). The footer (`TopBar.tsx`) keeps its three columns (brand, pages, the project; Tulio rejected a
  centered single column) with, under them, the Bay Islands seen from the sky (after the footer of
  saintmikenode.org) in contour lines (`ui/SkyIslands.tsx`: the home page's GEBCO relief.bin cut into contours once and
  projected in perspective on a canvas, land ×35, depths compressed; slow sway, draws in on first view;
  its own chunk, loaded when the footer gets near; still on lite and with reduced motion), then the sources.
- Every clickable thing shares one feel (`--spring`, `--ease-out` in styles.css): colors ease and a
  press sinks it slightly. Reduced motion turns all of this off.

Transition smoothness (Tulio: they stuttered and got stuck on phones). Two rules:
(1) **The curtain opens only when the new scene is ready**: no `.loading-screen`, the 3D view has
drawn three frames (`holdCurtain()` in IslandScene, released by `<SceneReady />` inside each 3D view;
a new 3D view needs one), and frames have stayed under 50 ms for 120 ms (capped at 7 s). Opening while
the scene was still compiling shaders froze the reveal for 0.8–1.4 s.
(2) **Phones and tablets (`MOBILE`) never animate `clip-path`, `filter` or layout properties**: the
curtain there (`.curtain.fast`) is the same three layers as real shapes (discs, sheets with SVG wavy
caps) moved only with `transform`/`opacity`, which the compositor runs without repainting; desktops
keep transition-style's clip-path effects. A new transition kind needs both: a `transition-style`
effect and a `shape` in `LOOKS`. Motion panels and LiquidTabs skip their blur on `MOBILE` too.

Scene transitions: `ui/SceneTransition.tsx` with transition-style (Tulio's pick), in two phases: a
curtain animates closed over the old scene ("in:" effect), the scene switches behind it (`apply`), and
it animates open ("out:"), waiting while a 3D loading screen is up. The curtain is three layers (aqua,
ocean blue, deep navy) running the same effect 90 ms apart, so a change reads as a burst of color, not a
flat slide (Tulio: "plain slides"). Kinds: `island` (library circles: expanding sonar ping, then an
iris), `page` (custom circle swoop), `board`/`leave` and `dive`/`surface` (custom wavy water line
rising/falling, polygons generated in styles.css). The top layer carries the destination's name (rises
in out of a blur), pulsing sonar rings while a scene loads, or rising bubbles. `transition({kind, label,
sub?, apply})`; App holds the shown route, IslandScene the shown boat. App compares a new route with the last one asked for (`wanted`), not the one on screen: a change made while the curtain was still closing used to be dropped, so clicks seemed lost. Things above a button must not change height as the timeline plays (`HeatStatus` stacks every level's text in one cell), or the button jumps under the cursor. **transition-style 0.1.4's
per-pack CSS files leave out the shape variables their keyframes use** (the effects silently did
nothing): import `transition.hackpack.min.css` before any pack. With reduced motion (e.g. Windows
animation effects off) the scene just switches.

## Gotchas

- A translation key written twice keeps only the last value, with no type error: the phone bar's
  "Islas" and "Calor" once replaced the footer's "Islas en 3D" and "Estrés térmico". `vite.config.ts`
  now fails the build on a duplicate key. The bottom bars' labels are `bar.*`.

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
- 3D views on phones: the top row is the name (left) and the tools or instrument pill (right); the
  name takes only the room they leave (`--tools-w`, measured by `useWidthVar`). The bottom bar's
  labels must fit a quarter of a 320 px screen (~70 px at 11.5 px): "Herramientas" didn't, hence
  "Equipo". Check Spanish at 320 px before adding or lengthening a tab.
- Earth Engine sign-in expires: `region_relief.py`, `terrain.py` and the Atlas scripts then fail
  with "Please authorize access" and need Tulio to run `earthengine authenticate` (it had expired
  on 2026-11-20). `relief_land.py`, `zone_from_island.py` and the heat scripts don't need it.
- The scene store (`useScene`) outlives the island view, so anything left in it shows up on the
  next island: a "fly to this place" order was replayed in the new island's coordinates and the
  camera ended over empty sea (Tulio: "the island was off camera"). **Every island opens at its
  default view**: `CameraRig` only acts on a fly-to newer than the one it saw when it mounted, and
  `World` is keyed by island so the heat overlay and status are worked out again.
- `mergeGeometries` returns null, with no error, when its parts don't carry the same attributes
  (a `SphereGeometry` has normals and uvs, a hand-built fin only positions): strip them first. The
  turtles crashed the whole boat view this way.
- Don't center with `transform: translate(-50%)` something that also has an entrance animation on
  `transform`: the animation wins and the element starts at the middle of the screen (the phone tap
  hint ran off the right edge). Center with insets and `justify-items`.
- Camera controls are `scenes/CameraControls.tsx` (three.js's own OrbitControls / MapControls,
  mounted like drei's), **not drei's `<OrbitControls>` / `<MapControls>`**: those come from
  three-stdlib, which froze the camera on phones after a pinch (lifting one finger switched the
  controls off while the other was still down; fingers weren't captured and could count twice).
  Ours also turn the view with a two-finger twist. They capture the pointer on the canvas's
  wrapper (R3F's `events.connected`), so anything listening for a press's end must listen there
  or on the window, not on the canvas (tap-to-sail did, and stopped hearing taps).
- A full-screen overlay that stops the page scrolling must use `lockScroll()` (`src/lib/scrollLock.ts`,
  counted, so overlays can nest), never save and restore `body.style.overflow` itself: the photo
  dome and the photo viewer each did, and opening a photo inside the dome left the page locked on
  every page until a reload (Tulio: "pages get stuck and scrolling is frozen").
- Open things on `click`, not on `pointerup`: on a touch screen the tap's click arrives after the
  finger lifts and is hit-tested again, so whatever a pointerup handler just put on screen receives
  it. The photo dome opened the viewer on pointerup and the click then closed it on the viewer's
  backdrop, for every photo away from the middle of the screen (Tulio: "clicking a photo sometimes
  doesn't open it"). Judge tap versus drag by the distance from where the press began (`TAP_SLOP`),
  not by one move event's step.
- A page opened before a deploy asks for chunk files that no longer exist (the server answers with
  index.html). `main.tsx` reloads once on `vite:preloadError`; a second failure within 30 s shows
  the error card.
- Never call the heat data "today", "now" or "live" (Tulio): it is the latest day a script
  downloaded, not fetched by the day. Say "latest" / "más reciente" / "último dato" and show the
  date next to it.
- README badges (after CopánQuest's): three rows (who, what, built with) whose order is chosen so
  each is one line on GitHub's desktop width (572 / 592 / 695 px of ~830) and on phone widths every
  line still holds two or more: Tulio wants no badge alone on a line. Adding or renaming a badge
  changes the wrapping, so check it at 832 and 328–398 px before committing.
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

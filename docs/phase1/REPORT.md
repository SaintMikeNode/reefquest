# Phase 1 report: Roatán MVP (overnight build)

November 20, 2026. Built locally; **nothing is committed, pushed or deployed.** Preview: the
`reefquest` config in `.claude/launch.json` (port 5181), then open http://localhost:5181.

![Roatán in 3D](roatan-3d.jpg)

## What's there

**Home (`#/`)**: "Ocean heat, seen from space". A live SVG map of the archipelago with real
OpenStreetMap coastlines and today's NOAA 5 km heat cells; a readout panel (hottest island today,
record year); four island cards with today's DHW, NOAA alert level, sea temperature, a 120-day
sparkline and each island's worst year; and "heat stripes": the yearly maximum heat stress per
island since 1985. Roatán opens in 3D; the other three show data now and "3D coming soon".

**Roatán in 3D (`#/island/roatan`)**: the scene is real data end to end:

- Land: Copernicus DEM (30 m), with 20 m topographic lines and hillshade.
- Seafloor: the Allen Coral Atlas satellite bathymetry over the reef (0–19 m), faded into GEBCO
  deep water (the trench north of Roatán, compressed so it doesn't swallow the reef).
- Reef habitats in the Atlas's colors (coral/algae, seagrass, sand, rock, rubble), depth contours,
  animated light caustics in the shallows and a glowing shoreline.
- The sea surface shows NOAA's actual 5 km cells for the chosen day, colored on NOAA's alert scale.
- Timeline 1985 → today: year chips (heat-event years outlined), a chart of the year's heat with
  the bleaching season shaded, a scrubber, and ▶ playback through the decades.
- Live readout under the cursor: lat/lon, elevation or depth, habitat class, reef zone, DHW and
  alert level at that spot.
- Pins: four stories (Flowers Bay: SCTLD's first Honduran record; Cordelia Banks: 46% → 5% live
  coral after 2023, jumps the timeline to the heat peak; West End: pillar coral, critically
  endangered; El Aguila wreck) and five dive sites from the Roatán Marine Park mooring list. Every
  story cites its sources.
- Layer toggles, a habitat legend, the caveats ("not a navigation chart", "5 km regional signal",
  exaggeration), credits in the panel, a one-time "how to move" hint, reset view, ES/EN.

![Cordelia Banks, October 2023](roatan-cordelia-2023.jpg)

**Utila and Guanaja in 3D (`#/island/utila`, `#/island/guanaja`)**: built overnight with the same
pipeline. Guanaja's 400 m mountains inside its barrier-reef ring, and Utila's flat island with the
southwest cays, both with habitat colors and heat cells. Their shallow depths are estimated from
the reef zones until we download their Atlas bathymetry (the scene says so). No story pins yet.

![Guanaja in 3D](guanaja-3d.jpg)

**Research boat (new)**: from a story card ("Explore by boat") or the layers panel, you sail a
procedural research vessel over detailed tiles of the reef: West End · Sandy Bay, Cordelia Banks and
Mary's Place on Roatán (real Atlas bathymetry), plus the richest coral areas of Utila and Guanaja
(picked automatically from the habitat map; depths estimated). Tap the water (phones) or use
WASD / arrows; the camera follows and can orbit. You see the reef through clear water (shallows
turquoise, depth fading to blue along the line of sight), foam on the reef crest, illustrative
corals, sponges, seagrass and fish placed by the real habitat map, and buoys at the real moorings
(arriving at a story buoy opens its story). A sounder shows depth, habitat, reef zone and heat
stress under the boat; "Take sample" fills a logbook, and sampling every habitat in the zone
completes the mission. It runs aground in water shallower than ~1 m. Boat code is a 9 KB lazy chunk;
each zone tile is 100–420 KB.

![Research boat under way, West End](boat-cordelia.jpg)

![Guanaja northeast barrier reef](boat-guanaja.jpg)

**Heat stress (`#/heat`)**: our island-level comparison (NOAA doesn't publish one): a chart of
all four islands for any year, the worst years per island (peak DHW, days ≥ 4, days ≥ 8), heat
stripes, and NOAA's full alert scale with its official impact wording.

![2023 compared](heat-compare-2023.jpg)

**Learn (`#/learn`)**: seven short explainers for teenagers: bleaching, degree heating weeks,
2023, SCTLD, the 2024 reef health report card, why reefs matter (tourism, fishing, storm
protection), coral restoration. All sourced.

**Data & credits (`#/about`)**: five plain-language caveats, every dataset with its citation and
license, software and fonts.

## Redesign pass (after the boat)

- **One dark ocean look everywhere.** Pages, charts, map, 3D HUD and boat HUD share the same palette
  (deep navy, sand-colored islands, cyan accents, NOAA alert colors for heat). Typography is
  Source Serif 4 for headings, Source Sans 3 for text and IBM Plex Mono for numbers, set like a
  research publication: numbered figures with source lines, direct labels instead of legends where
  possible, data tables that stack on phones.
- **No sideways-scrolling boxes.** Checked every page at 375 px wide: nothing overflows.
- **Islands have nature.** Instanced palms along the shore and forest canopy inland, placed by
  elevation and land cover; one draw call each, skipped in lite mode.
- **The research vessel** was rebuilt: dark blue hull with a red boot top, white superstructure,
  A-frame and crane on the aft deck, radomes, lifeboat, a CTD rosette and the Honduran flag.
- **Science on board.** A multibeam sonar fan sweeps the seafloor while you sail; the strip it
  covers turns into a depth-colored bathymetry map (red = shallow, blue = 30 m), like the maps
  research ships produce, with "hectares mapped" and a depth key in the HUD. The echo sounder
  scrolls a live echogram. The CTD button (or space bar) lowers the instrument to the bottom,
  logs a sample of that habitat and brings it back up; the mission is to sample every habitat
  in the zone.
- **Phones.** In the boat, the instruments and logbook start folded to one line each so the
  scene stays visible; tap to open them.

## Second redesign pass: an atlas, a living reef, a learning path

The brief: less "AI-made", a serious and elegant science look, dark everywhere, a clearer way back,
reefs that look like reefs, and a better learning experience. References: NASA Earth Observatory's
figures (Robert Simmon's "Elegant Figures"), the Global Fishing Watch map, Distill-style figure
captions, and the instrument displays of ocean research cruises.

**Design rules now in the code (and in CLAUDE.md):** decoration must be real data; type does the
work, boxes only where content needs a surface; one accent color means "interactive", every other
color comes from the data; numbers in a mono face, labels in small caps, titles in the serif.

![Home](redesign-home.jpg)

- **Home.** The wavy lines behind the title are gone. Now it's the real seafloor: GEBCO 2023 depth
  contours of the Bay Islands, credited in the corner. Figure 1 shows each NOAA 5 km cell as the
  square it is (not a dot), with depth contours and the real mainland coast.

![Figure 1](redesign-map.jpg)

- **3D views.** The place name is a title plate (region in small caps, the name in the serif,
  coordinates), and **the way back is a clear button right under the name** ("All islands" /
  "Back to Roatán"). Map layers carry their own legends, pins are map labels with a halo instead
  of boxes, the 5 km heat cells have hairline edges, and the first visit shows a numbered
  "How to read this island" guide (also behind the ? button).
- **Island seafloor in natural colors.** Pale sand shallows, dark seagrass, mottled coral and rock,
  and surf breaking along the reef crest. The satellite classification is still one click away
  ("Habitat map" layer).

![Island](redesign-island.jpg)

- **A reef that looks like a Caribbean reef.** New stylized species, each with its own shape and
  surface pattern: brain coral (winding valleys), star coral (polyp cups), elkhorn, staghorn, pillar
  coral, purple and gold sea fans (a real lattice), sea rods, giant barrel, tube and azure vase
  sponges, turtle grass. They are placed by the Atlas habitat and depth (elkhorn on the shallow
  crest, sponges deeper), dense around the boat. Plus reef fish: blue tangs, snappers, sergeant
  majors, grunts, wrasses, parrotfish.
- **Underwater.** "Underwater" (or U) takes the camera down to the reef under the boat: red light
  lost with depth, visibility fog, the sky seen through Snell's window, light shafts, drifting
  particles, the hull overhead. A **field guide** lists the species around you, most common first,
  with how to recognize each one (sources: Coralpedia, IUCN 2024).

![Underwater](redesign-reef.jpg)

![Field guide](redesign-underwater.jpg)

- **Learn.** Two diagrams for classrooms: a coral polyp healthy → stressed → bleached (and the way
  back), and a worked example of how degree heating weeks add up over 12 weeks. The recent-history
  lesson now says "2023 and 2024: two extreme years in a row", because the full record shows 2024
  hotter than 2023 around Roatán (14.3 vs 13.3 °C-weeks; before 2023 no year passed 6.5).

![Learn](redesign-learn.jpg)

- **Heat record complete.** All 42 NOAA years are in (1985 → 18 Nov 2026). Today Roatán is at
  5.1 °C-weeks (Alert 1); the record is 2024 for Roatán, Utila and Cayos Cochinos, 2023 for Guanaja.
- **Performance.** Desktop Chrome: ~124 fps above the water, ~149 underwater with the dense reef.
  Lite devices get 30% of the reef budget, no blur behind panels, and fewer fish and light shafts.

## Size and performance

| What | Download (compressed) |
| --- | --- |
| First screen (app, CSS, fonts, map and status data) | ~150 KB |
| Opening Roatán in 3D (3D engine + terrain + habitat + heat data) | ~1.3 MB more |
| Each extra year on the timeline | ~30 KB |

Well under the 5 MB budget. Phones with ≤ 6 cores or ≤ 4 GB memory get "lite" mode (quarter
of the mesh vertices, no caustic animation, lower resolution); add `?lite` to any URL to try it.
The scene only redraws when something changes, which saves battery.

## Facts checked overnight (with sources in the app)

- NOAA's current alert scale (Alert Levels 1–5, updated Dec 2023). The app derives the level from
  DHW; NOAA also requires same-day HotSpot ≥ 1 °C, so ours is an approximation (said on the
  credits page).
- SCTLD: first recorded 24 Sep 2020 at Flowers Bay; ~155 m/day spread (Truc et al. 2023).
- Cordelia Banks: 46% → 5% live coral, Sep 2023 → Feb 2024 (Healthy Reefs).
- 2024 report card: MAR "poor" (2.5); Roatán 2.8 "fair", 22% coral, 19% macroalgae.
- Pillar coral: IUCN Critically Endangered (Dec 2022).

## Still running / not done

- **Cayos Cochinos 3D: blocked.** The Earth Engine copy of the Allen Coral Atlas has no habitat
  classes there (only the reef outline), so the scene would have no reef colors. It stays "coming
  soon" until you download its Atlas package (it includes benthic and geomorphic maps): same steps
  as Roatán, uploading `pipeline/areas/cayos-cochinos.geojson`. Then I'll read the habitat from the
  download instead of Earth Engine.
- Utila and Guanaja: their Atlas bathymetry downloads (upload `pipeline/areas/utila.geojson` and
  `guanaja.geojson`) will replace the estimated shallow depths.
- Not tested on a real low-end Android phone yet; tested in desktop Chrome and a phone-size emulator.
- The phone portrait camera (looking along the island from its west tip) is implemented but I
  couldn't see it in a true portrait window; please check on your phone.

## Decisions for you

1. Commit this work (it's all local and uncommitted)?
2. Deploy? That creates the `reefquest` Worker and `reefquest.todosenlaweb.com` (only on your word).
3. Coral models: decided, no photographer or paid models. Corals in the boat scene are illustrative
   and labeled as such.
4. Branding: stand-alone (as built: its own coral logo and "instrument" look) or part of a series
   with CopánQuest?

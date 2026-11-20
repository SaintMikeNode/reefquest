# HANDOFF: ReefQuest

The original project brief from Tulio (November 2026). It is the product spec; `CLAUDE.md` holds the
working conventions. Decisions made since the brief are listed first.

## Decisions since the brief

- **Name and domain (open question 1):** ReefQuest, `reefquest.todosenlaweb.com`. Repo
  `saintmikenode/reefquest`, Worker `reefquest` (not created yet).
- **Front-end stack:** Vite + TypeScript + **React + React Three Fiber** (three.js underneath), the
  same tools as CopánQuest, chosen by Tulio over plain three.js so code and habits carry over.
  The cost is about 150 KB more JavaScript, which is why the 3D engine and each island scene load lazily.
- **Earth Engine (open question 3):** Google Cloud project `reefquest` (organization nerdypunk.com),
  registered November 2026 for noncommercial Earth Engine use as nonprofit "Saint Mike Node",
  Community tier (150 EECU-hours, no billing account). Noncommercial eligibility expires
  May 19, 2028 and must be renewed in the Earth Engine configuration page.
- Open questions 2 and 4 (branding with CopánQuest, paid models) are still open.

---

A free, bilingual (Spanish/English) 3D web experience about the coral reefs of the Bay Islands of Honduras. It combines open satellite data on ocean heat stress, satellite-derived reef maps and real photogrammetry models of local corals. The audience is Honduran schools, island communities, dive shops and visitors.

## How to work with me (Tulio)

- I'm not a web developer. When you pick a framework or tool, tell me why in one or two sentences, and ask before any big architectural change.
- On long-running tasks (data downloads, mesh processing, builds), post progress updates saying how much is left. Silence feels like flying blind.
- Use American English in code comments and docs. The user interface is Spanish first, with English as a full second language (the Bay Islands have a large English-speaking population).
- I host on Cloudflare (Workers Paid plan). Prefer a static site deployed to Cloudflare, with data precomputed by scripts rather than fetched live from third-party servers in the browser.

## Scope (hard limit)

**Bay Islands department of Honduras only.** Four island groups: Roatán, Utila, Guanaja, Cayos Cochinos. Do not add other parts of the Mesoamerican Reef.

Working bounding box for all data pulls (verify and tighten as needed):

- Latitude: 15.8° N to 16.6° N
- Longitude: 87.1° W to 85.7° W (i.e., -87.1 to -85.7)

Suggested per-island boxes are TODO: derive them from the coastline data in Phase 0.

## Product concept

1. **Archipelago menu:** a simple 2D map of the four island groups. Tap an island to open its 3D scene.
2. **One 3D scene per island** (not one continuous seafloor; the islands are separated by deep channels with no good high-resolution bathymetry). Each scene shows:
   - Island land terrain plus the shallow reef seafloor around it.
   - Seafloor colored by habitat class (coral/algae, seagrass, sand, rock, etc.).
   - A heat-stress overlay (degree heating weeks) as a semi-transparent color wash, with a time slider from 1985 to the latest available date.
   - Pins at real dive sites that open close-up photogrammetry models of actual corals, with a short story (bleaching, disease, restoration).
3. **Per-island heat-stress charts:** our own island-level summary computed from the raw grid (e.g., "Utila vs. Guanaja this season"). NOAA doesn't publish this at island level; it's our local contribution.
4. **Learn/teach section:** plain-language explainers (what bleaching is, what a degree heating week means, why reefs matter to the islands) suitable for classrooms.
5. **Credits/data page:** full attribution and plain-language data caveats.

Build order: **Roatán first** (most existing coral models, most visitors), then Utila, Guanaja, Cayos Cochinos.

## Performance constraints

- Must run on low-end Android phones and old PCs (same goal as my earlier project Copan Quest).
- Target: first meaningful view under ~5 MB downloaded; each island scene loads lazily.
- Coral models: decimate to roughly 50k–150k triangles each, compress (Draco or meshopt), lazy-load on tap.
- Terrain: heightmap meshes with sensible resolution caps; use textures for habitat colors rather than per-vertex data if lighter.
- Provide a graceful fallback if WebGL is unavailable (2D map + charts).

## Suggested stack (confirm with me before locking in)

- **Data pipeline:** Python scripts (xarray, rasterio, pandas, numpy; earthengine-api for Allen Coral Atlas exports). Outputs go to `/public/data/` as compact JSON, PNG heightmaps/textures and GLB models.
- **Front end:** Vite + TypeScript + three.js. Reasoning: three.js is lightweight and well suited to small, custom terrain scenes on weak devices; CesiumJS is heavier and built for globe-scale maps we don't need. *(Superseded: React + R3F, see Decisions above.)*
- **Charts:** a small library (e.g., uPlot or Chart.js) or plain SVG.
- **i18n:** simple JSON string files (`es.json`, `en.json`).
- **Hosting:** Cloudflare (static assets). Data refresh: a scheduled job (GitHub Actions cron or a Cloudflare cron Worker) that reruns the heat-stress script and redeploys. Heat data updates daily, but a weekly refresh is fine for the MVP.

## Data sources

### 1. Heat stress: NOAA Coral Reef Watch (CRW) v3.1, daily, 5 km

- Product overview: https://coralreefwatch.noaa.gov/product/5km/index.php
- Methodology: https://coralreefwatch.noaa.gov/product/5km/methodology.php
- **Main access: ERDDAP (no API key).**
  - CoastWatch dataset `NOAA_DHW`: https://coastwatch.pfeg.noaa.gov/erddap/griddap/NOAA_DHW.html
  - Metadata: https://coastwatch.pfeg.noaa.gov/erddap/info/NOAA_DHW/index.html
  - Mirror, dataset `dhw_5km`: https://upwell.pfeg.noaa.gov/erddap/griddap/dhw_5km.html
- Record starts 1985-04-01. Note: the PacIOOS THREDDS copy only serves the latest 3 years; use ERDDAP for full history.
- Archive with DOI (for citation): https://doi.org/10.25921/6jgr-pt28 (NCEI accession CRW-5km-HeatStressProducts)
- Citation guidance: https://coralreefwatch.noaa.gov/satellite/docs/recommendations_crw_citation.php
- Variables of interest (check exact names in the ERDDAP metadata): `CRW_DHW` (degree heating weeks, °C-weeks), `CRW_HOTSPOT`, `CRW_SST`, `CRW_SSTANOMALY`, `CRW_BAA` (bleaching alert area, 0–4).
- Example query shape (VERIFY: latitude may be stored descending, which changes bracket order; stride and time format may need adjusting):

  ```
  https://coastwatch.pfeg.noaa.gov/erddap/griddap/NOAA_DHW.csv?CRW_DHW[(2023-01-01T12:00:00Z):1:(2023-12-31T12:00:00Z)][(16.6):1:(15.8)][(-87.1):1:(-85.7)]
  ```

  Pull year by year (or in chunks) for 1985–present to avoid timeouts. Store raw downloads in `/data/raw/crw/` (gitignored) and processed outputs in `/public/data/heat/`.
- Interpreting values: one DHW = one week at 1 °C above the local bleaching threshold (or half a week at 2 °C above). Classic CRW guidance: ~4 °C-weeks → significant bleaching likely (Alert Level 1); ~8 °C-weeks → widespread bleaching and mortality likely (Alert Level 2). CRW has since added higher alert levels for extreme events; check current definitions in the methodology page and match the alert scale the ERDDAP dataset actually encodes (its BAA flag currently lists levels 0–4).
- Sanity check against NOAA's own Honduras regional virtual station (covers all Honduran reefs, not Bay Islands specifically): https://coralreefwatch.noaa.gov/product/vs/data.php (Honduras row has a multi-year graph and a txt download). Description: https://coralreefwatch.noaa.gov/product/vs/description.php
- **Processing:** for each island, average (and report max) of reef-adjacent ocean pixels within that island's box → daily time series → per-island JSON. Also produce per-date gridded PNG overlays (or a compact array) for the 3D color wash.
- **UI caveat (must appear in the app):** this is a 5 km regional ocean-temperature signal, not a measurement on any individual reef.

### 2. Reef habitat maps and shallow bathymetry: Allen Coral Atlas

- Atlas: https://allencoralatlas.org/ (Mesoamerica mapped since June 2021)
- Google Earth Engine dataset `ACA/reef_habitat/v2_0`: https://developers.google.com/earth-engine/datasets/catalog/ACA_reef_habitat_v2_0
  - Bands (5 m pixels): `geomorphic`, `benthic`, `reef_mask`. The class tables (values, colors, names) are on that page; reuse their colors as a starting palette.
- **Bathymetry:** downloadable from the Atlas portal (free account required). This is satellite-derived shallow-water bathymetry, so it only covers clear shallow water. Reference: Li et al. (2021), "Automated global shallow water bathymetry mapping using Google Earth Engine," Remote Sensing 13(8):1469, doi:10.3390/rs13081469. I (Tulio) may need to download it manually and drop it in `/data/raw/aca/`; tell me exactly what to download.
- License: CC-BY 4.0. Citation: Allen Coral Atlas (2020). Imagery, maps and monitoring of the world's tropical coral reefs. Zenodo. doi:10.5281/zenodo.3833242
- **Caveat:** accuracy varies; scientists have reported errors elsewhere in the Caribbean. Label scenes as a model, not a navigation chart. Visually inspect each island before shipping.

### 3. Land terrain and deep-water fill

- Land elevation: Copernicus DEM GLO-30 (30 m, open). Available via AWS open data or OpenTopography.
- Deep water around each island's reef edge: GEBCO global grid (~450 m). Use only to fade the shallow seafloor smoothly into deeper water; don't present it as detailed.
- **Hardest technical task:** blending land DEM, Allen shallow bathymetry and GEBCO at the reef edge without visible seams or cliffs. Plan time for this.

### 4. Coastlines and boundaries

- OpenStreetMap coastlines (osmdata.openstreetmap.de land polygons) and/or geoBoundaries for the Islas de la Bahía department. Use for the archipelago menu map and to derive per-island boxes and land masks.

### 5. Reef survey context (field data, not satellite)

- Healthy Reefs for Healthy People, Mesoamerican Reef Report Cards (2024 is the latest; scores coral cover, macroalgae, herbivorous and commercial fish): https://www.healthyreefs.org/en/healthy-reefs-data/report-cards
- AGRRA Data Explorer (largest Caribbean reef-health survey database; includes Bay Islands sites): https://www.agrra.org/
- **Do not scrape or republish site-level survey data until I confirm permission/terms.** For the MVP, use only summary facts from public report cards, with citations.

### 6. Photogrammetry coral models (Roatán)

Candidates on Sketchfab, by a Roatán-based photographer. **Check each license before using; do not bundle paid or editorial-license models without purchase/permission.**

| Model | URL | License (as last seen) |
|---|---|---|
| Pillar coral with SCTLD, West End | https://sketchfab.com/3d-models/pillar-coral-sctld-dendrogyra-cylindricus-9bffdf5527ef44efbc388aff747de9b2 | CC Attribution |
| Great star coral with SCTLD | https://sketchfab.com/3d-models/great-star-coral-sctld-montastrea-cavernosa-4df3355143f8471189c8856daccaffc2 | Downloadable; confirm license |
| Elkhorn coral, north side near El Aguila | https://sketchfab.com/3d-models/elkhorn-coral-acropora-palmata-ce0fdf05ab8c4a0e94015cf3798cbc45 | Confirm license |
| El Aguila shipwreck | https://sketchfab.com/3d-models/el-aguila-shipwreck-roatan-honduras-44db197552c84d9e848cf5ea3ba558ad | Downloadable; confirm license |
| Staghorn coral restoration (Roatán Marine Park outplants, Chief's Quarter) | https://sketchfab.com/3d-models/staghorn-coral-restoration-86cdca3624ae4b4497abf0ea82d7c754 | Paid, editorial license |
| Staghorn coral colony, 3–5 m | https://sketchfab.com/3d-models/staghorn-coral-roatan-honduras-f1de6a74d3df4722a83093dc88303602 | Paid |

- Workflow: I download the models manually into `/data/raw/models/`. You write a script that converts to GLB, decimates, compresses and writes to `/public/models/`, and keeps a `models.json` manifest (id, title ES/EN, location, depth, author, license, source URL).
- The site credits each model's author and license on the model view and on the credits page.
- Later: a pipeline for our own photogrammetry (school/dive-shop captures of the same reef patch each year).

## Local context facts (for explainer text; cite sources in the app)

- Stony coral tissue loss disease (SCTLD) was first reported in Honduras on September 24, 2020, in Flowers Bay, Roatán, then spread across the island (Frontiers in Marine Science, 2023: https://www.frontiersin.org/articles/10.3389/fmars.2023.1197318).
- The 2024 Healthy Reefs report card rated the Mesoamerican Reef "poor" overall, with a slight improvement driven by fish biomass. Live coral cover at Cordelia Banks, Roatán, reportedly fell from 46% to 5% after the 2023 bleaching. Verify figures against the report card before publishing.
- Write explainers in plain language for teenagers; avoid jargon or define it inline.

## Local partners (for later; no action needed in code)

Roatán Marine Park, Bay Islands Conservation Association (offices on Roatán, Utila and Guanaja), Coral Reef Alliance (Mesoamerican office), Healthy Reefs for Healthy People, AGRRA, the Cayos Cochinos research station/foundation, and island dive shops.

## Phased plan

**Phase 0: Data verification (do first, report back before building UI)**
- Confirm the ERDDAP query works for the bounding box; download one year and plot it.
- Confirm Allen Coral Atlas habitat export for Roatán via Earth Engine; tell me what I need to set up (Earth Engine account/project) and what to download manually (bathymetry).
- Derive per-island boxes and land masks from coastline data.
- Deliverable: a short report (Markdown) with what worked, file sizes, gaps and any surprises.

**Phase 1: Roatán MVP**
- Archipelago menu (Roatán active, the other three as "coming soon").
- Roatán 3D scene: land + shallow seafloor + habitat colors.
- Heat-stress time slider and per-island chart for 1985–present.
- 2–4 pinned coral models (CC-licensed only).
- Spanish/English toggle, credits page, data caveats.
- Deployed to Cloudflare.

**Phase 2: Utila, Guanaja, Cayos Cochinos scenes.**

**Phase 3: Education and engagement**
- Classroom mode / teacher guide pages.
- Seasonal "heat-stress status" banner for each island (bleaching season is roughly August–October).
- Optional: shareable images of the current status for social media.

## Acceptance checks

- Works on a mid/low-end Android phone over a mobile connection.
- Every dataset and model shown has attribution visible in the app.
- The heat overlay is clearly labeled as regional satellite data.
- No data outside the Bay Islands bounding box is loaded or shown.
- All UI text exists in both Spanish and English.

## Open questions for Tulio

1. ~~Project name and domain?~~ ReefQuest, reefquest.todosenlaweb.com.
2. Should this sit alongside Copan Quest as part of the same series/branding, or stand alone?
3. ~~Do you have (or want to create) a Google Earth Engine account/project for the Allen Coral Atlas export?~~ Yes: Cloud project `reefquest`, see Decisions.
4. Are you willing to buy paid models, or contact the photographer for permission?

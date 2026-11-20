# Phase 0 report: data verification

November 20, 2026. Scripts are in `pipeline/` and run with the Python environment at
`~/.venvs/reefquest` (see `pipeline/README.md`).

## Summary

| Check | Status |
| --- | --- |
| NOAA CRW heat stress via ERDDAP | **Works.** 2023 downloaded, plotted and cross-checked against NOAA's Honduras virtual station (correlation 0.985). |
| Per-island boxes and land masks | **Done** from OpenStreetMap coastlines: `public/data/islands.json` (1.8 KB) and `islands.geojson` (52 KB). |
| Allen Coral Atlas habitat via Earth Engine | **Works for Roatán.** Signed in on this Mac; `aca_habitat.py roatan` printed 5 m class areas and wrote a 20 m GeoTIFF (3,478 × 1,671 px, 0.1 MB). Preview: `aca_roatan_benthic_20m.png`. |
| Allen Coral Atlas bathymetry | **Requested for Roatán** (Nov 20): area "ReefQuest Roatan" saved under My Areas; package = bathymetry composite + benthic, geomorphic, reef extent (GeoJSON); license accepted. The Atlas emails a download link (valid 30 days) → save to `data/raw/aca/`. The Atlas's own Roatán statistics match our Earth Engine numbers exactly. |

## 1. Heat stress (NOAA Coral Reef Watch v3.1, 5 km daily)

**What worked**

- Dataset `dhw_5km` (= `NOAA_DHW`). Record: **1985-04-01 → 2026-11-18** (the server lags about two days).
- Both CoastWatch and the upwell mirror now **redirect to the PacIOOS ERDDAP** in Hawaii
  (`pae-paha.pacioos.hawaii.edu`), which serves the full record. (The brief's warning about PacIOOS
  only having three years applies to its THREDDS server, not to this ERDDAP.) The script asks PacIOOS
  first and falls back to CoastWatch. The first request to CoastWatch returned a 503; PacIOOS worked.
- Latitude is stored north → south, so queries go `[(north):1:(south)]`, as the brief suspected.
- One year, 6 variables (DHW, BAA, BAA 7-day max, SST, SST anomaly, HotSpot): **5.6 MB, 127 s**.
  Grid: 16 × 28 cells of 0.05° (448 cells, 430 with ocean data). **No missing ocean days in 2023.**
- Full history estimate: 42 years × ~5.6 MB ≈ **235 MB raw** (git-ignored), about **1.5 hours** to download.
  `python pipeline/crw_download.py --all` (it skips years already on disk and resumes after failures).

**2023 results (the worst bleaching year on record in the Caribbean)**

- The whole box passed **Alert Level 2 (8 °C-weeks)** by late September, peaking at **18.1 °C-weeks
  around October 27**. SST peaked at 31.9 °C in mid-October.
- Clear east–west gradient: much more heat stress near Guanaja than near Utila. First per-island numbers
  (mean over the ocean cells in each island's analysis box):

  | Island | 5 km cells | Peak mean DHW | Peak max DHW | Days ≥ 4 | Days ≥ 8 |
  | --- | ---: | ---: | ---: | ---: | ---: |
  | Utila | 30 | 11.8 | 12.3 | 102 | 66 |
  | Roatán | 78 | 13.3 | 14.4 | 107 | 73 |
  | Guanaja | 30 | 15.9 | 17.5 | 115 | 83 |
  | Cayos Cochinos | 16 | 12.5 | 13.2 | 103 | 69 |

  This is the "Utila vs. Guanaja" comparison the brief wants, and it is real signal, not noise.
- Plots: `crw_2023_timeseries.png`, `crw_2023_maxdhw_map.png`, `islands_boxes.png` (this folder).

**Sanity check against NOAA's Honduras virtual station**

- Daily correlation with the station's DHW: **0.985**; same timing (both peak around October 31).
- The station peaks higher (20.4 vs. our 15.8 at the 90th percentile of cells) because its polygon covers
  all Honduran reefs, centered northeast of the Bay Islands (16.7 N, 85.85 W). That's expected: it's not
  a Bay Islands product, which is exactly why our island-level summary is a contribution.

**Surprises and decisions for you**

1. **Alert scale.** The gridded `CRW_BAA` only goes up to 4 (Alert Level 2), but NOAA's virtual station
   reports levels up to **7**. CRW added higher alert levels after 2023 (Alert Levels 3–5 for extreme
   heat). Proposal: the app computes the alert level from DHW itself, using CRW's current thresholds
   (to be confirmed on the methodology page before we ship), so 2023 shows as the extreme event it was.
2. **The working box includes mainland Honduras.** The grey cells in the southeast corner are the coast
   near Trujillo. The per-island boxes leave it out, so nothing mainland is shown, but the project box
   could be tightened to the four island boxes: **lat 15.85–16.60, lon −87.10 to −85.75**.
3. **The islands are not masked as land at 5 km** (they're too narrow), so cells over the islands still
   carry an ocean value. That's fine for the island averages; for the "reef-adjacent" average in the
   brief we'll weight cells by the Allen Coral Atlas reef mask once we have it.
4. Raw downloads are small enough to keep everything. For the web: per-island daily series 1985–today
   are ~15,200 days; we'll ship weekly values for charts (~40 KB gzipped per island, estimate) and the
   color wash as one small grid per day, packed per year (~160 KB per year, loaded with the slider).

## 2. Island groups, boxes and land masks (OpenStreetMap)

- Source: OSM `natural=coastline` inside the box via the Overpass API (346 ways → 99 closed island
  rings; the 8 open pieces are the mainland coast and are dropped). Cached in `data/raw/osm/`.
- Grouping is by position. One islet east of Barbareta (probably one of the Pigeon Cays) initially fell
  into Guanaja; the split is now at 86.05° W and it belongs to Roatán.

| Island group | Rings | Land (km²) | Analysis box (land + ~5 km reef buffer, on the CRW grid) |
| --- | ---: | ---: | --- |
| Utila | 16 | 41.6 | 15.95–16.20 N, 87.10–86.80 W |
| Roatán (with Santa Elena, Barbareta, cays) | 48 | 128.0 | 16.20–16.50 N, 86.70–86.05 W |
| Guanaja | 19 | 56.1 | 16.35–16.60 N, 86.05–85.75 W |
| Cayos Cochinos | 16 | 2.5 | 15.85–16.05 N, 86.60–86.40 W |

- Utila's box touches the west edge of the project box and Guanaja's touches the north edge; both
  islands' reefs are inside.
- Land areas are from OSM polygons and include small cays; they're for our own use, not for publishing
  as official figures.
- **Not included by design:** the Swan Islands (Islas del Cisne), ~250 km northeast, which some sources
  count as part of the department. The brief limits scope to the four groups.
- `public/data/islands.geojson` (52 KB, simplified to ~20 m) is ready for the 2D menu map. OSM needs
  the credit "© OpenStreetMap contributors" (ODbL) on the credits page.

## 3. Allen Coral Atlas

**Habitat (Earth Engine `ACA/reef_habitat/v2_0`)**

- A single image, 5 m pixels, bands `geomorphic`, `benthic`, `reef_mask`, from PlanetScope composites
  of 2018–2020. CC BY 4.0. Citation: Allen Coral Atlas (2020), doi:10.5281/zenodo.3833242.
- Class tables and the Atlas's own colors are in `pipeline/aca_habitat.py` (benthic: sand, rubble,
  rock, seagrass, coral/algae, microalgal mats; geomorphic: 11 zones from lagoon to reef slope).
- Coverage limits: benthic classes only to ~10 m depth, geomorphic to ~15 m.
- `aca_habitat.py roatan` prints the area of each class at full 5 m resolution and downloads a 20 m
  GeoTIFF (UTM 16N) for the 3D scene texture. A 20 m texture of Roatán's box is about 3,500 × 1,650
  pixels.
- **Roatán result (box 16.20–16.50 N, 86.70–86.05 W, areas at 5 m):** benthic: coral/algae 49.7 km²,
  seagrass 28.2, rock 6.1, sand 2.8, rubble 1.1. Geomorphic: outer reef flat 33.2 km², back reef slope
  24.2, reef slope 10.1, deep lagoon 8.8, sheltered reef slope 7.2, plateau 5.5. The preview shows the
  expected pattern: a wide north-shore reef with seagrass lagoons, a narrow south fringe, and complex
  reefs around Barbareta. "Coral/Algae" is one class: the Atlas can't tell live coral from algae.
- A server-side "most common class" downsample is refused as too large for one request, so the 20 m
  file samples the nearest 5 m pixel. Good enough for a scene texture; we can tile it if we need 5–10 m.
- License note: the Earth Engine page and the Atlas FAQ say CC BY 4.0, but the Atlas FAQ also says
  republishing the *entire global* dataset needs ASU's consent. We only show four small areas, which
  fits CC BY, but I'll read the Atlas Terms of Use (allencoralatlas.org/tou/) before Phase 1 ships.

**Bathymetry (download only)**

- Not available in Earth Engine. It's a GeoTIFF from the Atlas website: 10 m pixels, 16-bit integers,
  apparently depth in centimeters (to confirm from the file), clear shallow water only.

## What I need from you (Tulio)

1. **Earth Engine sign-in (2 minutes).** In a terminal on this Mac:

   ```bash
   ~/.venvs/reefquest/bin/earthengine authenticate
   ```

   It opens a browser: sign in with the NerdyPunk account that owns project `reefquest` and allow
   access. Then tell me, and I'll run the Roatán habitat export.

2. **Bathymetry download from the Allen Coral Atlas.**
   1. Go to https://allencoralatlas.org/atlas/ and create a free login (or sign in).
   2. Top bar: **My Areas** → upload `pipeline/areas/roatan.geojson` (or all four at once with
      `bay-islands-all.geojson`; if the uploader rejects several shapes, upload the four island files
      one by one).
   3. Save the area, open its **Download Data** tab and tick **Bathymetry – composite data**. Also tick
      **Benthic Map** and **Geomorphic Map** as a backup copy of the habitat layers.
   4. Accept the data license and press **Prepare Download**. An email arrives (minutes to hours) with
      a link that lasts 30 days.
   5. Put the downloaded files (unzipped) in `data/raw/aca/` in the ReefQuest folder.

## Next (after the two steps above)

- Run the habitat export for Roatán; check the classes visually against satellite imagery.
- Inspect the bathymetry (units, depth range, gaps) and test blending it with the Copernicus land DEM
  and GEBCO around Roatán (the hardest technical task in the brief).
- Download the full heat-stress record and build the per-island series and yearly overlays.

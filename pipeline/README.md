# Data pipeline

Python scripts that turn open datasets into the compact files the site serves from `public/data/`
and `public/models/`. Raw downloads go to `data/raw/` (git-ignored). Phase 0 findings:
`docs/phase0/REPORT.md`.

## Setup

The Python environment lives on the Mac's internal disk, not in the repo: the repo is on an exFAT
drive, where macOS writes `._*` files that break package installs.

```bash
brew install uv
uv venv ~/.venvs/reefquest --python 3.12
uv pip install --python ~/.venvs/reefquest/bin/python -r pipeline/requirements.txt
```

Run scripts from the `pipeline/` folder with `~/.venvs/reefquest/bin/python <script>.py`.
Earth Engine needs a one-time `~/.venvs/reefquest/bin/earthengine authenticate` (Cloud project `reefquest`).

## Scripts

| Script | Source | Output |
| --- | --- | --- |
| `crw_download.py <years…> / --all` | NOAA CRW v3.1 5 km via ERDDAP (PacIOOS `dhw_5km`, CoastWatch fallback) | `data/raw/crw/<year>.nc` |
| `crw_inspect.py <year>` | one year of CRW | grid facts + plots in `docs/phase0/` |
| `islands.py` | OpenStreetMap coastlines (Overpass) | `public/data/islands.json`, `islands.geojson` |
| `phase0_islands_plot.py [year]` | islands + CRW | `docs/phase0/islands_boxes.png`, per-island summary |
| `aca_areas.py` | `islands.json` | `pipeline/areas/*.geojson` to upload to the Allen Coral Atlas |
| `aca_habitat.py <island> [--scale m]` | Earth Engine `ACA/reef_habitat/v2_0` | `data/raw/aca/<island>_habitat_<m>m.tif` + class areas |
| `heat_products.py` | `data/raw/crw/*.nc` + `islands.json` | `public/data/heat/`: `index.json`, `latest.json`, `islands.json` (daily series), `grid/<year>.bin` |
| `terrain.py <island>` | Copernicus DEM GLO-30 2024 + GEBCO 2023 (Earth Engine), Atlas bathymetry (`data/raw/aca/atlas_<island>/`), habitat GeoTIFF, OSM outline | `public/data/<island>/terrain.png`, `habitat.png`, `meta.json` |

Order for a new island: `islands.py` → `aca_habitat.py <id>` → (Atlas download unzipped to
`data/raw/aca/atlas_<id>/`) → `terrain.py <id>`. Heat: `crw_download.py --all` → `heat_products.py`.
After writing new files, restart the dev server.

Earth Engine gotchas (both cost hours): a mosaic forgets its projection, so set
`setDefaultProjection` before resampling (else the DEM becomes a 1° ramp); and EE's bicubic
resampling scrambles the GEBCO community collection, so fetch it with nearest sampling and
interpolate locally. Atlas bathymetry saturates into noise over deep water: use it only inside the
mapped reef habitat.

Planned: coral model conversion (`public/models/`), the other three islands' terrain.

`common.py` holds the project bounding box; every pull is clipped to it.

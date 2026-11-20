# Data pipeline

Python scripts that turn open datasets into the compact files the site serves from `public/data/`
and `public/models/`. Raw downloads go to `data/raw/` (git-ignored).

Planned (Phase 0, see `docs/HANDOFF.md`):

| Script | Source | Output |
| --- | --- | --- |
| `crw_heat.py` | NOAA CRW DHW via ERDDAP (`NOAA_DHW`) | `public/data/heat/` per-island JSON + overlays |
| `islands.py` | OpenStreetMap land polygons | per-island boxes and land masks |
| `aca_habitat.py` | Allen Coral Atlas (Earth Engine `ACA/reef_habitat/v2_0`) | habitat textures |
| `terrain.py` | Copernicus DEM GLO-30, ACA bathymetry, GEBCO | heightmaps |
| `models.py` | Sketchfab downloads in `data/raw/models/` | decimated, compressed GLB + `models.json` |

Setup (needs Python 3.11+; the macOS system Python is 3.9):

```bash
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r pipeline/requirements.txt
```

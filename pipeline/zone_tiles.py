"""Detailed tiles for the research-boat mode: a few km around dive sites, at 10 m relief and 5 m habitat.

Zones are listed in pipeline/zones.json. Heights use the same recipe as terrain.py (Copernicus DEM on
land, Allen Coral Atlas bathymetry over the reef, GEBCO beyond). Habitat comes from Earth Engine at
its native 5 m (ACA/reef_habitat/v2_0).

Outputs in public/data/<island>/zones/<zone>/:
  height.png   R/G packed heights, h = (R*256 + G) / 10 - 3000 m (10 m cells)
  habitat.png  R = benthic, G = geomorphic, B = 255 where reef_mask (5 m cells)
  meta.json    sizes, lat/lon ↔ uv fits, stats

Usage: python pipeline/zone_tiles.py [zone-id ...]   (default: all zones)
"""
import json
import math
import sys

import ee
import numpy as np
import rasterio
from PIL import Image
from rasterio.warp import transform

from common import PUBLIC_DATA, ROOT
from terrain import OFFSET, PROJECT, SCALE, block_mode, build_heights, ee_grid

CELL = 10.0
HAB = 5.0
CRS = "EPSG:32616"


def fit(us, vs, lon, lat):
    A = np.c_[lon, lat, np.ones(len(lon))]
    B = np.c_[us, vs, np.ones(us.size)]
    return {
        "lonlat_to_uv": [np.linalg.lstsq(A, us, rcond=None)[0].tolist(), np.linalg.lstsq(A, vs, rcond=None)[0].tolist()],
        "uv_to_lonlat": [np.linalg.lstsq(B, lon, rcond=None)[0].tolist(), np.linalg.lstsq(B, lat, rcond=None)[0].tolist()],
    }


def build(zone: dict, features: dict) -> None:
    W_m, H_m = zone["size_m"]
    (cx,), (cy,) = transform("EPSG:4326", CRS, [zone["lon"]], [zone["lat"]])
    x0 = math.floor((cx - W_m / 2) / CELL) * CELL
    y1 = math.ceil((cy + H_m / 2) / CELL) * CELL
    W, H = int(W_m / CELL), int(H_m / CELL)
    tf = rasterio.Affine(CELL, 0, x0, 0, -CELL, y1)
    tf5 = rasterio.Affine(HAB, 0, x0, 0, -HAB, y1)
    print(f"[{zone['id']}] {W}×{H} cells at {CELL:.0f} m, habitat {W * 2}×{H * 2} at {HAB:.0f} m")

    img = ee.Image("ACA/reef_habitat/v2_0").select(["geomorphic", "benthic", "reef_mask"]).unmask(0).toUint8()
    hab = np.stack([ee_grid(img.select(b), CRS, tf5, W * 2, H * 2, "nearest") for b in ("geomorphic", "benthic", "reef_mask")]).astype(np.uint8)
    geo = block_mode(hab[0], 2)[:H, :W]
    height, land, mapped, source = build_heights(zone["island"], rasterio.crs.CRS.from_string(CRS), tf, CELL, W, H, geo, features[zone["island"]])
    print(f"  height {height.min():.1f}..{height.max():.1f} m, land {land.mean():.0%}, mapped reef {mapped.mean():.0%}, {source}")

    out = PUBLIC_DATA / zone["island"] / "zones" / zone["id"]
    out.mkdir(parents=True, exist_ok=True)
    enc = np.clip(np.round((height + OFFSET) * SCALE), 0, 65535).astype(np.uint16)
    rgb = np.zeros((H, W, 3), np.uint8)
    rgb[..., 0], rgb[..., 1] = enc >> 8, enc & 255
    Image.fromarray(rgb).save(out / "height.png", optimize=True)
    tex = np.stack([hab[1], hab[0], (hab[2] > 0).astype(np.uint8) * 255], -1)
    Image.fromarray(tex).save(out / "habitat.png", optimize=True)

    us, vs = np.meshgrid(np.linspace(0, 1, 7), np.linspace(0, 1, 7))
    ex, ny = x0 + us * W * CELL, y1 - vs * H * CELL
    lon, lat = transform(CRS, "EPSG:4326", ex.ravel().tolist(), ny.ravel().tolist())
    meta = {
        "id": zone["id"], "island": zone["island"], "name": zone["name"],
        "size_m": [W * CELL, H * CELL], "cell_m": CELL, "habitat_cell_m": HAB,
        "height": {"file": "height.png", "width": W, "height": H, "min_m": round(float(height.min()), 1), "max_m": round(float(height.max()), 1)},
        "habitat": {"file": "habitat.png", "width": W * 2, "height": H * 2},
        "bathymetry_source": source,
        "center": {"lat": zone["lat"], "lon": zone["lon"]},
        "geo": fit(us.ravel(), vs.ravel(), np.array(lon), np.array(lat)),
    }
    (out / "meta.json").write_text(json.dumps(meta, indent=1))
    for f in ("height.png", "habitat.png"):
        print(f"  {f}: {(out / f).stat().st_size / 1024:.0f} KB")


def main() -> None:
    zones = json.loads((ROOT / "pipeline" / "zones.json").read_text())
    want = set(sys.argv[1:])
    gj = json.loads((PUBLIC_DATA / "islands.geojson").read_text())
    features = {f["properties"]["id"]: f for f in gj["features"]}
    ee.Initialize(project=PROJECT)
    for z in zones:
        if not want or z["id"] in want:
            build(z, features)
    index = {}
    for z in zones:
        index.setdefault(z["island"], []).append({"id": z["id"], "name": z["name"], "name_es": z.get("name_es", z["name"]), "lat": z["lat"], "lon": z["lon"], "size_m": z["size_m"]})
    for island, zs in index.items():
        (PUBLIC_DATA / island / "zones" / "index.json").write_text(json.dumps(zs, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()

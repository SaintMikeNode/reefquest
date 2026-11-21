"""Boat-mode zone tiles without Earth Engine: cut from the island's own model.

zone_tiles.py builds a zone at full detail (10 m relief, 5 m habitat) but needs Earth Engine, and
the sign-in expires. This builds the same files for a zone by resampling data already in the repo:
the island's terrain.png (40–68 m cells, bilinear) and habitat.png (20–34 m cells, nearest). The
result is coarser (the seafloor is smoother, habitat patches are blockier), which is fine for open
water and good enough to sail over a reef. meta.json says so in `detail`, and a zone built here can
be rebuilt at full detail later with zone_tiles.py (same id, same files).

Zones are listed in pipeline/zones.json; this script only builds the ones named on the command line,
and refreshes the island's zones/index.json from zones.json.

Usage: ~/.venvs/reefquest/bin/python zone_from_island.py <zone-id> [<zone-id> ...]
"""
import json
import math
import sys

import numpy as np
import rasterio
from PIL import Image
from rasterio.warp import transform

from common import PUBLIC_DATA, ROOT

CELL = 10.0
HAB = 5.0
CRS = "EPSG:32616"
OFFSET, SCALE = 3000, 10  # h = (R*256 + G) / 10 - 3000, as terrain.py and zone_tiles.py


def fit(us, vs, lon, lat):
    A = np.c_[lon, lat, np.ones(len(lon))]
    B = np.c_[us, vs, np.ones(us.size)]
    return {
        "lonlat_to_uv": [np.linalg.lstsq(A, us, rcond=None)[0].tolist(), np.linalg.lstsq(A, vs, rcond=None)[0].tolist()],
        "uv_to_lonlat": [np.linalg.lstsq(B, lon, rcond=None)[0].tolist(), np.linalg.lstsq(B, lat, rcond=None)[0].tolist()],
    }


def island(name: str):
    base = PUBLIC_DATA / name
    meta = json.loads((base / "meta.json").read_text())
    rgb = np.asarray(Image.open(base / meta["terrain"]["file"]).convert("RGB"), dtype=np.float64)
    height = (rgb[..., 0] * 256 + rgb[..., 1]) / SCALE - OFFSET
    habitat = np.asarray(Image.open(base / meta["habitat"]["file"]).convert("RGB"), dtype=np.uint8)
    return meta, height, habitat


def island_uv(meta: dict, lon: np.ndarray, lat: np.ndarray):
    fu, fv = meta["geo"]["lonlat_to_uv"]
    return fu[0] * lon + fu[1] * lat + fu[2], fv[0] * lon + fv[1] * lat + fv[2]


def grid_lonlat(x0: float, y1: float, cell: float, w: int, h: int):
    """Longitude and latitude of the cell centers of a UTM grid."""
    xs = x0 + (np.arange(w) + 0.5) * cell
    ys = y1 - (np.arange(h) + 0.5) * cell
    X, Y = np.meshgrid(xs, ys)
    lon, lat = transform(CRS, "EPSG:4326", X.ravel().tolist(), Y.ravel().tolist())
    return np.array(lon).reshape(h, w), np.array(lat).reshape(h, w)


def build(zone: dict) -> None:
    meta_i, height_i, habitat_i = island(zone["island"])
    (cx,), (cy,) = transform("EPSG:4326", CRS, [zone["lon"]], [zone["lat"]])
    W_m, H_m = zone["size_m"]
    x0 = math.floor((cx - W_m / 2) / CELL) * CELL
    y1 = math.ceil((cy + H_m / 2) / CELL) * CELL
    W, H = int(W_m / CELL), int(H_m / CELL)

    # Heights: bilinear from the island's heightmap.
    lon, lat = grid_lonlat(x0, y1, CELL, W, H)
    u, v = island_uv(meta_i, lon, lat)
    if u.min() < 0 or u.max() > 1 or v.min() < 0 or v.max() > 1:
        raise SystemExit(f"[{zone['id']}] reaches outside {zone['island']}'s model (u {u.min():.2f}..{u.max():.2f}, v {v.min():.2f}..{v.max():.2f})")
    hi, wi = height_i.shape
    fx, fy = np.clip(u * wi - 0.5, 0, wi - 1), np.clip(v * hi - 0.5, 0, hi - 1)
    ix, iy = np.floor(fx).astype(int), np.floor(fy).astype(int)
    jx, jy = np.minimum(ix + 1, wi - 1), np.minimum(iy + 1, hi - 1)
    tx, ty = fx - ix, fy - iy
    height = (height_i[iy, ix] * (1 - tx) + height_i[iy, jx] * tx) * (1 - ty) + (height_i[jy, ix] * (1 - tx) + height_i[jy, jx] * tx) * ty

    # Habitat: nearest from the island's habitat map (R benthic, G geomorphic, B reef mask), at 5 m.
    lon5, lat5 = grid_lonlat(x0, y1, HAB, W * 2, H * 2)
    u5, v5 = island_uv(meta_i, lon5, lat5)
    hh, hw = habitat_i.shape[:2]
    tex = habitat_i[np.clip((v5 * hh).astype(int), 0, hh - 1), np.clip((u5 * hw).astype(int), 0, hw - 1)]

    out = PUBLIC_DATA / zone["island"] / "zones" / zone["id"]
    out.mkdir(parents=True, exist_ok=True)
    enc = np.clip(np.round((height + OFFSET) * SCALE), 0, 65535).astype(np.uint16)
    rgb = np.zeros((H, W, 3), np.uint8)
    rgb[..., 0], rgb[..., 1] = enc >> 8, enc & 255
    Image.fromarray(rgb).save(out / "height.png", optimize=True)
    Image.fromarray(np.ascontiguousarray(tex)).save(out / "habitat.png", optimize=True)

    us, vs = np.meshgrid(np.linspace(0, 1, 7), np.linspace(0, 1, 7))
    ex, ny = x0 + us * W * CELL, y1 - vs * H * CELL
    glon, glat = transform(CRS, "EPSG:4326", ex.ravel().tolist(), ny.ravel().tolist())
    meta = {
        "id": zone["id"], "island": zone["island"], "name": zone["name"],
        "size_m": [W * CELL, H * CELL], "cell_m": CELL, "habitat_cell_m": HAB,
        "height": {"file": "height.png", "width": W, "height": H, "min_m": round(float(height.min()), 1), "max_m": round(float(height.max()), 1)},
        "habitat": {"file": "habitat.png", "width": W * 2, "height": H * 2},
        "bathymetry_source": meta_i.get("bathymetry_source", "island model"),
        "detail": f"resampled from the island model ({meta_i['cell_m']:.0f} m relief), not the 10 m build",
        "center": {"lat": zone["lat"], "lon": zone["lon"]},
        "geo": fit(us.ravel(), vs.ravel(), np.array(glon), np.array(glat)),
    }
    (out / "meta.json").write_text(json.dumps(meta, indent=1))
    land = float((height > 0).mean())
    reef = float((tex[..., 2] > 0).mean())
    sizes = ", ".join(f"{f} {(out / f).stat().st_size / 1024:.0f} KB" for f in ("height.png", "habitat.png"))
    print(f"[{zone['id']}] {W}×{H} cells, depth {height.min():.0f}..{height.max():.0f} m, land {land:.0%}, mapped reef {reef:.0%}; {sizes}")


def write_index(zones: list[dict], name: str) -> None:
    rows = [{k: z[k] for k in ("id", "name", "name_es", "lat", "lon", "size_m") if k in z} for z in zones if z["island"] == name]
    built = [r for r in rows if (PUBLIC_DATA / name / "zones" / r["id"] / "meta.json").exists()]
    (PUBLIC_DATA / name / "zones" / "index.json").write_text(json.dumps(built, ensure_ascii=False))
    print(f"  {name}/zones/index.json: {len(built)} zone(s)")


def main() -> None:
    zones = json.loads((ROOT / "pipeline" / "zones.json").read_text())
    want = sys.argv[1:]
    if not want:
        raise SystemExit(__doc__)
    by_id = {z["id"]: z for z in zones}
    for zid in want:
        if zid not in by_id:
            raise SystemExit(f"{zid}: not in pipeline/zones.json")
        build(by_id[zid])
    for name in sorted({by_id[z]["island"] for z in want}):
        write_index(zones, name)


if __name__ == "__main__":
    main()

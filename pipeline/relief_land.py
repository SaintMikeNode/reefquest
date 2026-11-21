"""Island land for the footer's elevation grid (public/data/relief.bin), from each island's own DEM.

region_relief.py writes relief.bin from GEBCO as 2 × 2 block means (~860 m cells). That is fine for
the seafloor, but Roatán is only 2–4 km wide with deep water close by: averaging land with sea left
most of the island below zero, and the footer's contour landscape (ui/SkyIslands) drew it as a few
islets ("Roatán feels mostly underwater", Tulio). This step keeps GEBCO for the sea and takes the
land from data already in the repo: each island's terrain.png, built by terrain.py from the
Copernicus DEM (40–68 m cells). No download and no Earth Engine needed.

Run after region_relief.py (it reads that script's output and is safe to run again):

  ~/.venvs/reefquest/bin/python relief_land.py

Output: public/data/relief.bin at 0.004° (~430 m), int16 meters, rows north to south, and the
"relief" entry of public/data/region.json. From this step on, `west` and `north` are the position
of the first sample (the center of the first cell), not the edge of the box, and
`registration` says so.
"""
import json

import numpy as np
from PIL import Image

from common import PUBLIC_DATA

STEP = 0.004  # output step, degrees (~430 m): GEBCO's own 15 arc-second step
ISLANDS = ["roatan", "utila", "guanaja", "cayos-cochinos"]
LAND_M = 0.0  # a DEM pixel higher than this is land (0.5 m dropped a quarter of Utila: its mangrove flats)
LAND_SHARE = 0.4  # a cell is land when at least this share of its DEM pixels is
SEA_M = -2  # a cell GEBCO calls land but the island's DEM calls water


def base_grid(region: dict) -> tuple[np.ndarray, float, float]:
    """The current relief grid resampled to STEP (bilinear), with the box's west and north edges."""
    r = region["relief"]
    src = np.frombuffer((PUBLIC_DATA / r["file"]).read_bytes(), dtype="<i2").reshape(r["h"], r["w"]).astype(np.float64)
    step = r["step"]
    if r.get("registration") == "sample":  # written by this script: first sample at (west, north)
        west_edge, north_edge = r["west"] - step / 2, r["north"] + step / 2
    else:  # region_relief.py: cell means, (west, north) is the corner of the box
        west_edge, north_edge = r["west"], r["north"]
    w, h = round(r["w"] * step / STEP), round(r["h"] * step / STEP)
    lon = west_edge + (np.arange(w) + 0.5) * STEP
    lat = north_edge - (np.arange(h) + 0.5) * STEP
    fx = np.clip((lon - west_edge) / step - 0.5, 0, r["w"] - 1)
    fy = np.clip((north_edge - lat) / step - 0.5, 0, r["h"] - 1)
    x0, y0 = np.floor(fx).astype(int), np.floor(fy).astype(int)
    x1, y1 = np.minimum(x0 + 1, r["w"] - 1), np.minimum(y0 + 1, r["h"] - 1)
    tx, ty = (fx - x0)[None, :], (fy - y0)[:, None]
    top = src[y0][:, x0] * (1 - tx) + src[y0][:, x1] * tx
    bottom = src[y1][:, x0] * (1 - tx) + src[y1][:, x1] * tx
    return top * (1 - ty) + bottom * ty, west_edge, north_edge


def island_cells(island: str, west_edge: float, north_edge: float, w: int, h: int):
    """Per output cell: how many DEM pixels fall in it, how many are land, and the sum of land heights."""
    meta = json.loads((PUBLIC_DATA / island / "meta.json").read_text())
    rgb = np.asarray(Image.open(PUBLIC_DATA / island / meta["terrain"]["file"]).convert("RGB"), dtype=np.float64)
    height = (rgb[..., 0] * 256 + rgb[..., 1]) / 10 - 3000  # meta.terrain.decode
    H, W = height.shape
    u, v = np.meshgrid((np.arange(W) + 0.5) / W, (np.arange(H) + 0.5) / H)
    fl, fa = meta["geo"]["uv_to_lonlat"]
    lon = fl[0] * u + fl[1] * v + fl[2]
    lat = fa[0] * u + fa[1] * v + fa[2]
    i = np.floor((lon - west_edge) / STEP).astype(int)
    j = np.floor((north_edge - lat) / STEP).astype(int)
    ok = (i >= 0) & (i < w) & (j >= 0) & (j < h)
    k = (j * w + i)[ok]
    hh = height[ok]
    land = hh > LAND_M
    count = np.bincount(k, minlength=w * h).reshape(h, w)
    n_land = np.bincount(k[land], minlength=w * h).reshape(h, w)
    sum_land = np.bincount(k[land], weights=hh[land], minlength=w * h).reshape(h, w)
    # Pixels a full cell holds (the DEM's cell size against this grid's), to tell cells at the edge of the island's box.
    per_cell = (STEP * 110_570 / meta["cell_m"]) * (STEP * 111_320 * np.cos(np.radians(16.2)) / meta["cell_m"])
    return count, n_land, sum_land, per_cell, meta


def main() -> None:
    path = PUBLIC_DATA / "region.json"
    region = json.loads(path.read_text())
    grid, west_edge, north_edge = base_grid(region)
    h, w = grid.shape
    print(f"base: GEBCO grid resampled to {w}×{h} at {STEP}°")
    cell_km2 = (STEP * 110.57) * (STEP * 111.32 * np.cos(np.radians(16.2)))
    for island in ISLANDS:
        count, n_land, sum_land, per_cell, meta = island_cells(island, west_edge, north_edge, w, h)
        covered = count >= per_cell * 0.6
        land = covered & (n_land >= np.maximum(1, count) * LAND_SHARE)
        before = int((covered & (grid > 0)).sum())
        mean_land = np.divide(sum_land, n_land, out=np.zeros_like(sum_land), where=n_land > 0)
        grid[land] = np.maximum(2, mean_land[land])
        wet = covered & ~land & (grid > SEA_M)
        grid[wet] = SEA_M
        print(
            f"  {meta['name']:15s} land cells {before:4d} → {int(land.sum()):4d} (~{land.sum() * cell_km2:.0f} km²), "
            f"highest cell {grid[land].max():.0f} m (DEM max {meta['terrain']['max_m']:.0f} m)"
        )
    out = np.clip(np.round(grid), -32768, 32767).astype("<i2")
    (PUBLIC_DATA / "relief.bin").write_bytes(out.tobytes())
    region["relief"] = {
        "file": "relief.bin",
        "w": w,
        "h": h,
        "west": round(west_edge + STEP / 2, 6),
        "north": round(north_edge - STEP / 2, 6),
        "step": STEP,
        "registration": "sample",
        "land": "Copernicus DEM GLO-30, from each island's terrain.png; sea: GEBCO 2023",
    }
    path.write_text(json.dumps(region, separators=(",", ":")))
    print(f"relief.bin: {w}×{h}, {out.min()}..{out.max()} m, {out.nbytes / 1024:.0f} KB; region.json updated")


if __name__ == "__main__":
    main()

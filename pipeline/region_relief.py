"""Regional relief for the home page: GEBCO 2023 depth contours and the mainland coast.

GEBCO's global grid (~450 m) includes land elevation, so its 0 m line gives a coarse coast for the
Honduran mainland at the south edge of the Bay Islands box (the islands themselves are drawn from
OpenStreetMap, which is far more detailed). Contours are simplified for a small download.

Output: public/data/region.json
  { "source", "bbox", "levels": [...], "contours": {"<level>": [[[lon, lat], ...], ...]},
    "mainland": [[[lon, lat], ...], ...], "relief": {file, w, h, west, north, step} }
and public/data/relief.bin (coarse elevation grid, int16 meters, rows north to south).

Usage: ~/.venvs/reefquest/bin/python -W ignore region_relief.py   (needs Earth Engine auth)
"""
import json

import contourpy
import ee
import numpy as np
import rasterio
import shapely
from shapely.geometry import LineString, Polygon

from common import BBOX, PUBLIC_DATA
from terrain import PROJECT, ee_grid

STEP = 0.004  # degrees (~430 m), close to GEBCO's 15 arc-second cells
LEVELS = [-20, -50, -100, -200, -400, -600, -800, -1000, -1500, -2000, -2500, -3000]
TOL = 0.0025  # simplification tolerance, degrees (~270 m)


def main() -> None:
    ee.Initialize(project=PROJECT)
    w = round((BBOX["east"] - BBOX["west"]) / STEP)
    h = round((BBOX["north"] - BBOX["south"]) / STEP)
    tf = rasterio.Affine(STEP, 0, BBOX["west"], 0, -STEP, BBOX["north"])
    img = ee.ImageCollection("projects/sat-io/open-datasets/gebco/gebco_grid").mosaic().setDefaultProjection("EPSG:4326", None, 15 / 3600)
    print(f"downloading GEBCO {w}×{h} at {STEP}° (nearest)…")
    z = ee_grid(img, "EPSG:4326", tf, w, h, resample="nearest")
    print(f"  elevation {z.min():.0f}..{z.max():.0f} m")
    lon = BBOX["west"] + (np.arange(w) + 0.5) * STEP
    lat = BBOX["north"] - (np.arange(h) + 0.5) * STEP
    gen = contourpy.contour_generator(lon, lat, z, line_type=contourpy.LineType.Separate, fill_type=contourpy.FillType.OuterOffset)

    contours: dict[str, list] = {}
    total = 0
    for lv in LEVELS:
        lines = []
        for seg in gen.lines(lv):
            ls = LineString(seg).simplify(TOL)
            if ls.length < 0.02:  # drop specks shorter than ~2 km
                continue
            lines.append([[round(x, 4), round(y, 4)] for x, y in ls.coords])
        contours[str(lv)] = lines
        total += sum(len(l) for l in lines)
        print(f"  {lv:>6} m: {len(lines)} lines")

    # Mainland: land polygons (elevation > 0) whose centroid is on the southern edge of the box.
    mainland = []
    polys, offsets = gen.filled(0.0, 1e5)
    for pts, offs in zip(polys, offsets):
        outer = Polygon(pts[offs[0]:offs[1]])
        if outer.area < 0.002 or outer.centroid.y > 15.97:
            continue
        s = shapely.simplify(outer, TOL)
        mainland.append([[round(x, 4), round(y, 4)] for x, y in s.exterior.coords])
    print(f"  mainland polygons: {len(mainland)}")

    # Coarse elevation grid (land and seafloor, meters) for the home page's braille ridgeline scene:
    # 2 × 2 block means of the GEBCO grid (~860 m cells), int16 little-endian, rows north to south.
    rw, rh = w // 2, h // 2
    relief = z[: rh * 2, : rw * 2].reshape(rh, 2, rw, 2).mean(axis=(1, 3))
    (PUBLIC_DATA / "relief.bin").write_bytes(np.round(relief).astype("<i2").tobytes())
    print(f"  relief.bin: {rw}×{rh}, {relief.min():.0f}..{relief.max():.0f} m, {rw * rh * 2 / 1024:.0f} KB")

    out = {
        "source": "GEBCO Compilation Group (2023) GEBCO 2023 Grid, doi:10.5285/f98b053b-0cbc-6c23-e053-6c86abc0af7b",
        "relief": {"file": "relief.bin", "w": rw, "h": rh, "west": BBOX["west"], "north": BBOX["north"], "step": STEP * 2},
        "bbox": BBOX,
        "levels": LEVELS,
        "contours": contours,
        "mainland": mainland,
    }
    path = PUBLIC_DATA / "region.json"
    path.write_text(json.dumps(out, separators=(",", ":")))
    print(f"  {path.relative_to(PUBLIC_DATA.parent.parent)}: {path.stat().st_size / 1024:.0f} KB, {total} contour points")


if __name__ == "__main__":
    main()

"""Build the web terrain for one island scene: land + shallow reef seafloor + deep-water fill.

Inputs (all on one 40 m grid in UTM 16N, aligned with the Allen Coral Atlas habitat GeoTIFF from
aca_habitat.py, which must exist first):
  - Land: Copernicus DEM GLO-30 (2024 release) via Earth Engine, inside OpenStreetMap island outlines.
  - Shallow seafloor: Allen Coral Atlas bathymetry if a file is in data/raw/aca/ (TODO when the
    download arrives); until then, nominal depths per Allen Coral Atlas geomorphic zone (a model,
    labeled as such in the app).
  - Deep water: GEBCO 2023 (~450 m), only to fade the reef into deep water.

Outputs in public/data/<island>/:
  terrain.png   heights packed in R (high byte) and G (low byte): h = (R*256 + G) / 10 - 3000 m
  habitat.png   R = benthic class, G = geomorphic class, B = 255 where reef_mask (20 m → texture)
  meta.json     grid size, bounds, encoding, geo transform, stats

Usage: python pipeline/terrain.py roatan
"""
import argparse
import json
import math

import ee
import numpy as np
import rasterio
import requests
from PIL import Image
from rasterio.features import rasterize
from rasterio.io import MemoryFile
from rasterio.warp import transform, transform_geom
from scipy import ndimage

from common import PUBLIC_DATA, RAW, USER_AGENT

PROJECT = "reefquest"
CELL = 40.0  # meters
OFFSET, SCALE = 3000.0, 10.0  # height encoding: (h + 3000) * 10 → uint16
MAX_TERRAIN_W = 1024  # web heightmap width cap
MAX_TEXTURE_W = 2048  # web habitat texture width cap

# Nominal depths (m, negative = below sea level) per ACA geomorphic zone. Used only until the
# Atlas's satellite-derived bathymetry is available. Rough values from the zone definitions
# (reef flats ~0–2 m, crests ~1 m, lagoons 2–10 m, slopes 5–15 m).
NOMINAL_DEPTH = {11: -3.0, 12: -8.0, 13: -1.2, 14: -2.0, 15: -1.0, 16: -0.6, 21: -9.0, 22: -12.0,
                 23: -10.0, 24: -5.0, 25: -4.0}
REEF_EDGE_DEPTH = -16.0  # where mapped reef ends and open water begins
FADE_M = 1500.0  # distance over which the reef edge fades into GEBCO depths


def ee_grid(img: ee.Image, crs: str, tf: rasterio.Affine, w: int, h: int, resample: str = "bilinear") -> np.ndarray:
    img = img.resample(resample) if resample != "nearest" else img
    url = img.getDownloadURL({"crs": crs, "crs_transform": [tf.a, tf.b, tf.c, tf.d, tf.e, tf.f],
                              "dimensions": f"{w}x{h}", "format": "GEO_TIFF"})
    r = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=600)
    r.raise_for_status()
    with MemoryFile(r.content) as mf, mf.open() as ds:
        return ds.read(1).astype(np.float32)


def block_mode(a: np.ndarray, k: int) -> np.ndarray:
    """k×k majority of nonzero classes (0 wins only if the whole block is 0)."""
    h, w = a.shape[0] // k * k, a.shape[1] // k * k
    blocks = a[:h, :w].reshape(h // k, k, w // k, k).transpose(0, 2, 1, 3).reshape(h // k, w // k, k * k)
    out = np.zeros(blocks.shape[:2], np.uint8)
    best = np.zeros(blocks.shape[:2], np.int32)
    for c in np.unique(a):
        if c == 0:
            continue
        n = (blocks == c).sum(-1)
        better = n > best
        out[better], best[better] = c, n[better]
    return out


def resize_nearest(a: np.ndarray, w: int) -> np.ndarray:
    h = round(a.shape[0] * w / a.shape[1])
    return np.asarray(Image.fromarray(a).resize((w, h), Image.NEAREST))


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("island")
    a = p.parse_args()
    islands = json.loads((PUBLIC_DATA / "islands.json").read_text())["islands"]
    info = islands[a.island]
    gj = json.loads((PUBLIC_DATA / "islands.geojson").read_text())
    feature = next(f for f in gj["features"] if f["properties"]["id"] == a.island)

    with rasterio.open(RAW / "aca" / f"{a.island}_habitat_20m.tif") as src:
        crs = src.crs
        hab = src.read()  # geomorphic, benthic, reef_mask at 20 m
        tf20 = src.transform
    k = int(CELL / tf20.a)
    tf = rasterio.Affine(CELL, 0, tf20.c, 0, -CELL, tf20.f)
    H, W = hab.shape[1] // k, hab.shape[2] // k
    print(f"grid {W}×{H} at {CELL:.0f} m ({W * CELL / 1000:.1f} × {H * CELL / 1000:.1f} km), {crs}")

    geo40 = block_mode(hab[0], k)[:H, :W]

    print("downloading Copernicus DEM and GEBCO from Earth Engine…")
    ee.Initialize(project=PROJECT)
    # A mosaic forgets its source projection; without setDefaultProjection, "bilinear" resampling runs
    # on a 1° default grid and flattens the island into a ramp.
    dem_col = ee.ImageCollection("COPERNICUS/DEM/GLO30_2024_1").select("DEM")
    dem = ee_grid(dem_col.mosaic().setDefaultProjection(dem_col.first().projection()), crs.to_string(), tf, W, H)
    # GEBCO: fetch at ~400 m with nearest sampling (Earth Engine's bicubic resampling returns wrong
    # values for this collection), then interpolate smoothly to the 40 m grid here.
    f = 10
    tf_c = rasterio.Affine(CELL * f, 0, tf.c, 0, -CELL * f, tf.f)
    g = ee_grid(ee.ImageCollection("projects/sat-io/open-datasets/gebco/gebco_grid").mosaic(), crs.to_string(), tf_c,
                math.ceil(W / f) + 1, math.ceil(H / f) + 1, "nearest")
    yy, xx = np.mgrid[0:H, 0:W]
    gebco = ndimage.map_coordinates(g, [(yy + .5) / f - .5, (xx + .5) / f - .5], order=3, mode="nearest").astype(np.float32)
    print(f"  DEM {dem.min():.1f}..{dem.max():.1f} m, GEBCO {gebco.min():.0f}..{gebco.max():.0f} m")

    # Land mask from OSM outlines (more reliable at the shore than DEM noise over water).
    geom = transform_geom("EPSG:4326", crs, feature["geometry"])
    land = rasterize([(geom, 1)], out_shape=(H, W), transform=tf, all_touched=False, dtype=np.uint8).astype(bool)

    # Ocean depths: GEBCO, forced below the reef edge depth (its 450 m cells smear islands into the sea).
    deep = np.minimum(gebco, REEF_EDGE_DEPTH)
    mapped = (geo40 > 0) & ~land
    shallow = np.zeros_like(dem)
    for c, d in NOMINAL_DEPTH.items():
        shallow[geo40 == c] = d
    # Real shallow depths: the Allen Coral Atlas satellite-derived bathymetry (cm, positive down,
    # 10 m), when its file is present. Over open water it saturates into noise (the bottom isn't
    # visible), so it is trusted only inside the mapped reef habitat. Median filtering removes speckle.
    bathy_files = sorted(p for p in (RAW / "aca").glob(f"atlas_{a.island}/Bathymetry*/*.tif") if not p.name.startswith("._"))
    source = "nominal-by-zone"
    if bathy_files:
        from rasterio.warp import Resampling, reproject
        with rasterio.open(bathy_files[0]) as bs:
            raw = bs.read(1).astype(np.float32)
            raw[raw <= 0] = np.nan
            raw = ndimage.median_filter(np.nan_to_num(raw, nan=0), 5)
            raw[raw <= 0] = np.nan
            bathy = np.full((H, W), np.nan, np.float32)
            reproject(raw, bathy, src_transform=bs.transform, src_crs=bs.crs, dst_transform=tf, dst_crs=crs,
                      resampling=Resampling.average, src_nodata=np.nan, dst_nodata=np.nan)
        bathy = -bathy / 100.0  # cm → m, negative down
        ok = mapped & np.isfinite(bathy)
        print(f"  Atlas bathymetry: {ok.sum()} of {mapped.sum()} mapped cells, depth {np.nanmin(bathy[ok]):.1f}..{np.nanmax(bathy[ok]):.1f} m")
        shallow = np.where(ok, bathy, shallow)
        source = "aca-bathymetry"

    # Smooth inside the mapped reef so zones blend instead of terracing.
    wsum = ndimage.gaussian_filter(mapped.astype(np.float32), 1.2)
    shallow_s = np.where(mapped, ndimage.gaussian_filter(shallow * mapped, 1.2) / np.maximum(wsum, 1e-3), 0)

    # Unmapped water: fade from the nearest reef-edge depth (or shore) into GEBCO with distance.
    near = mapped | land
    dist, (iy, ix) = ndimage.distance_transform_edt(~near, return_indices=True)
    dist = dist * CELL
    edge = np.where(land, -1.0, shallow_s)[iy, ix]
    edge = np.minimum(edge, -1.0)
    t = np.clip(dist / FADE_M, 0, 1)
    t = t * t * (3 - 2 * t)
    fade = edge * (1 - t) + np.minimum(deep, edge) * t
    ocean = np.where(mapped, shallow_s, fade)
    # Final gentle smoothing of the whole seafloor (keeps the land untouched).
    sea = ~land
    ocean_s = ndimage.gaussian_filter(np.where(sea, ocean, -0.5), 1.0)
    ocean_s = np.minimum(ocean_s, -0.3)

    land_h = np.maximum(ndimage.median_filter(dem, 3), 0.5)
    height = np.where(land, land_h, ocean_s).astype(np.float32)
    print(f"  height {height.min():.1f}..{height.max():.1f} m; land cells {land.sum()}, mapped reef cells {mapped.sum()}")

    # Web outputs.
    out = PUBLIC_DATA / a.island
    out.mkdir(parents=True, exist_ok=True)
    tw = min(MAX_TERRAIN_W, W)
    th = round(H * tw / W)
    hz = np.asarray(Image.fromarray(height).resize((tw, th), Image.BILINEAR))
    enc = np.clip(np.round((hz + OFFSET) * SCALE), 0, 65535).astype(np.uint16)
    rgb = np.zeros((th, tw, 3), np.uint8)
    rgb[..., 0], rgb[..., 1] = enc >> 8, enc & 255
    Image.fromarray(rgb).save(out / "terrain.png", optimize=True)

    xw = min(MAX_TEXTURE_W, hab.shape[2])
    tex = np.stack([resize_nearest(hab[1], xw), resize_nearest(hab[0], xw), resize_nearest(hab[2], xw) * 255], -1)
    Image.fromarray(tex.astype(np.uint8)).save(out / "habitat.png", optimize=True)

    # Geo reference: grid corners in UTM and lat/lon, plus an affine lat/lon ↔ grid-fraction fit
    # (error < ~30 m over a 70 km scene) so the browser needs no projection library.
    x0, y0 = tf.c, tf.f
    x1, y1 = x0 + W * CELL, y0 - H * CELL
    us, vs = np.meshgrid(np.linspace(0, 1, 9), np.linspace(0, 1, 9))
    ex, ny = x0 + us * (x1 - x0), y0 + vs * (y1 - y0)
    lon, lat = transform(crs, "EPSG:4326", ex.ravel().tolist(), ny.ravel().tolist())
    A = np.c_[np.array(lon), np.array(lat), np.ones(len(lon))]
    fit_u = np.linalg.lstsq(A, us.ravel(), rcond=None)[0]
    fit_v = np.linalg.lstsq(A, vs.ravel(), rcond=None)[0]
    B = np.c_[us.ravel(), vs.ravel(), np.ones(us.size)]
    fit_lon = np.linalg.lstsq(B, np.array(lon), rcond=None)[0]
    fit_lat = np.linalg.lstsq(B, np.array(lat), rcond=None)[0]
    err = np.hypot((B @ fit_lon - lon) * 111320 * math.cos(math.radians(16.3)), (B @ fit_lat - lat) * 110570).max()

    meta = {
        "island": a.island, "name": info["name"],
        "crs": crs.to_string(), "cell_m": CELL * W / tw, "size_m": [W * CELL, H * CELL],
        "terrain": {"file": "terrain.png", "width": tw, "height": th, "decode": "h = (R*256 + G) / 10 - 3000",
                    "min_m": round(float(height.min()), 1), "max_m": round(float(height.max()), 1)},
        "habitat": {"file": "habitat.png", "width": tex.shape[1], "height": tex.shape[0],
                    "channels": {"r": "benthic", "g": "geomorphic", "b": "reef_mask"}},
        "bathymetry_source": source,
        "geo": {"lonlat_to_uv": [list(map(float, fit_u)), list(map(float, fit_v))],
                "uv_to_lonlat": [list(map(float, fit_lon)), list(map(float, fit_lat))],
                "fit_error_m": round(float(err), 1)},
        "bounds_lonlat": info["analysis_box"],
    }
    (out / "meta.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False))
    for f in ("terrain.png", "habitat.png", "meta.json"):
        print(f"  {f}: {(out / f).stat().st_size / 1024:.0f} KB")
    print(f"  lat/lon fit error {err:.1f} m")

    # Preview for checking.
    from matplotlib import cm
    shade = ndimage.sobel(height, 1) * 0.02 + 0.5
    norm = np.clip((height + 60) / 320, 0, 1)
    img = (cm.terrain(norm)[..., :3] * np.clip(shade, .3, 1)[..., None] * 255).astype(np.uint8)
    img[~land] = (cm.Blues_r(np.clip(-height[~land] / 400, 0, 1))[..., :3] * 255).astype(np.uint8)
    Image.fromarray(img).save(RAW.parent.parent / "docs" / "phase0" / f"terrain_{a.island}_preview.png")


if __name__ == "__main__":
    main()

"""Export Allen Coral Atlas v2.0 habitat maps (geomorphic + benthic + reef mask) for one island.

Source: Earth Engine image ACA/reef_habitat/v2_0 (5 m, PlanetScope 2018–2020 composites),
CC BY 4.0, © Allen Coral Atlas Partnership / Arizona State University.
Needs Earth Engine credentials for Cloud project "reefquest" (run `earthengine authenticate` once).

Usage: python pipeline/aca_habitat.py roatan [--scale 20]
Writes data/raw/aca/<island>_habitat_<scale>m.tif (UTM 16N, uint8, 3 bands) and prints class areas.
"""
import argparse
import json

import ee
import requests

from common import PUBLIC_DATA, RAW, USER_AGENT

PROJECT = "reefquest"
ASSET = "ACA/reef_habitat/v2_0"
CRS = "EPSG:32616"  # UTM zone 16N covers the whole Bay Islands box

GEOMORPHIC = {0: "Unmapped", 11: "Shallow Lagoon", 12: "Deep Lagoon", 13: "Inner Reef Flat", 14: "Outer Reef Flat",
              15: "Reef Crest", 16: "Terrestrial Reef Flat", 21: "Sheltered Reef Slope", 22: "Reef Slope",
              23: "Plateau", 24: "Back Reef Slope", 25: "Patch Reef"}
BENTHIC = {0: "Unmapped", 11: "Sand", 12: "Rubble", 13: "Rock", 14: "Seagrass", 15: "Coral/Algae", 18: "Microalgal Mats"}


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("island")
    p.add_argument("--scale", type=int, default=20, help="output pixel size in meters (source is 5 m)")
    a = p.parse_args()
    info = json.loads((PUBLIC_DATA / "islands.json").read_text())["islands"][a.island]
    b = info["analysis_box"]
    ee.Initialize(project=PROJECT)
    region = ee.Geometry.Rectangle([b["west"], b["south"], b["east"], b["north"]], proj="EPSG:4326", geodesic=False)

    img = ee.Image(ASSET).select(["geomorphic", "benthic", "reef_mask"]).unmask(0).toUint8().clip(region)

    # Class areas at full 5 m resolution, computed server-side.
    area = ee.Image.pixelArea().divide(1e6)
    for band, names in (("geomorphic", GEOMORPHIC), ("benthic", BENTHIC)):
        stats = area.addBands(img.select(band)).reduceRegion(
            reducer=ee.Reducer.sum().group(groupField=1, groupName="cls"),
            geometry=region, scale=5, crs=CRS, maxPixels=1e10, bestEffort=False).getInfo()
        print(f"\n{band} (km² at 5 m):")
        for g in sorted(stats["groups"], key=lambda g: g["cls"]):
            if g["cls"]:
                print(f"  {g['cls']:3d} {names.get(g['cls'], '?'):22s} {g['sum']:8.2f}")

    # Download a GeoTIFF, resampled 5 m → scale by nearest pixel (classes are categorical, so no
    # averaging). A server-side mode reduction would be nicer but is refused as too large for one request.
    url = img.getDownloadURL({"region": region, "scale": a.scale, "crs": CRS, "format": "GEO_TIFF"})
    out = RAW / "aca" / f"{a.island}_habitat_{a.scale}m.tif"
    out.parent.mkdir(parents=True, exist_ok=True)
    r = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=600)
    r.raise_for_status()
    out.write_bytes(r.content)
    print(f"\nwrote {out.relative_to(RAW.parent.parent)} ({len(r.content) / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()

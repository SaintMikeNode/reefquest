"""Derive the four island groups, their land polygons and per-island boxes from OSM coastlines.

Source: OpenStreetMap natural=coastline ways inside BBOX, via the Overpass API (cached in
data/raw/osm/coastline.json). Islands are closed coastline rings; the mainland coast is open
(it crosses the box edge) and is dropped, as are mainland near-shore islets.

Outputs:
  public/data/islands.geojson   simplified land polygons, one MultiPolygon per island group
  public/data/islands.json      per-island land bounds and analysis boxes (land + reef buffer,
                                snapped outward to the 0.05° CRW grid)
OSM data © OpenStreetMap contributors, ODbL.
"""
import json
import math

import requests
from shapely.geometry import MultiPolygon, Polygon, mapping
from shapely.ops import unary_union

from common import BBOX, PUBLIC_DATA, RAW, USER_AGENT

CACHE = RAW / "osm" / "coastline.json"
OVERPASS = "https://overpass-api.de/api/interpreter"
REEF_BUFFER = 0.05  # degrees (~5.3 km) around land: fringing reefs, banks and at least a few CRW cells
SIMPLIFY = 0.0002   # degrees (~20 m) for the web GeoJSON

GROUPS = {
    "utila": "Utila",
    "roatan": "Roatán",
    "guanaja": "Guanaja",
    "cayos-cochinos": "Cayos Cochinos",
}


def classify(lon: float, lat: float) -> str | None:
    if lat < 15.95 and lon > -86.3:
        return None  # mainland near-shore islets (Trujillo / Cabo de Honduras area)
    if lon < -86.75:
        return "utila"
    if lat < 16.08 and -86.65 < lon < -86.35:
        return "cayos-cochinos"
    if -86.75 <= lon < -86.05 and lat >= 16.2:
        return "roatan"
    if lon >= -86.05 and lat >= 16.3:
        return "guanaja"
    return None


def fetch() -> dict:
    if CACHE.exists():
        return json.loads(CACHE.read_text())
    q = f"""[out:json][timeout:120];
way["natural"="coastline"]({BBOX['south']},{BBOX['west']},{BBOX['north']},{BBOX['east']});
out geom;"""
    r = requests.post(OVERPASS, data={"data": q}, headers={"User-Agent": USER_AGENT}, timeout=300)
    r.raise_for_status()
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    CACHE.write_text(r.text)
    return r.json()


def rings(osm: dict) -> tuple[list[Polygon], int]:
    """Join coastline ways end to end into closed rings (an island's coast can be split in several ways)."""
    segs = [[(p["lon"], p["lat"]) for p in w["geometry"]] for w in osm["elements"] if w["type"] == "way"]
    polys, open_count = [], 0
    by_start = {}
    for s in segs:
        by_start.setdefault(s[0], []).append(s)
    used = set()
    for s in segs:
        if id(s) in used:
            continue
        used.add(id(s))
        line = list(s)
        while line[0] != line[-1]:
            nxt = next((c for c in by_start.get(line[-1], []) if id(c) not in used), None)
            if nxt is None:
                break
            used.add(id(nxt))
            line += nxt[1:]
        if line[0] == line[-1] and len(line) >= 4:
            polys.append(Polygon(line))
        else:
            open_count += 1
    return polys, open_count


def snap_out(box: dict) -> dict:
    f = lambda v: math.floor(v * 20) / 20
    c = lambda v: math.ceil(v * 20) / 20
    return {"south": round(f(box["south"]), 2), "north": round(c(box["north"]), 2),
            "west": round(f(box["west"]), 2), "east": round(c(box["east"]), 2)}


def main() -> None:
    osm = fetch()
    polys, open_count = rings(osm)
    print(f"coastline ways: {len(osm['elements'])}, closed rings: {len(polys)}, open (mainland) pieces: {open_count}")
    groups = {k: [] for k in GROUPS}
    dropped = 0
    for p in polys:
        g = classify(p.centroid.x, p.centroid.y)
        if g:
            groups[g].append(p)
        else:
            dropped += 1
    print(f"dropped {dropped} rings (mainland or near-shore)")

    features, meta = [], {}
    for gid, name in GROUPS.items():
        land = unary_union(groups[gid])
        w, s, e, n = land.bounds
        km2 = land.area * (111.32 ** 2) * math.cos(math.radians((s + n) / 2))
        land_box = {"south": round(s, 4), "north": round(n, 4), "west": round(w, 4), "east": round(e, 4)}
        buf = {"south": s - REEF_BUFFER, "north": n + REEF_BUFFER, "west": w - REEF_BUFFER, "east": e + REEF_BUFFER}
        analysis = snap_out(buf)
        # Never leave the project box.
        analysis = {"south": max(analysis["south"], BBOX["south"]), "north": min(analysis["north"], BBOX["north"]),
                    "west": max(analysis["west"], BBOX["west"]), "east": min(analysis["east"], BBOX["east"])}
        center = land.centroid
        meta[gid] = {"name": name, "rings": len(groups[gid]), "land_km2": round(km2, 1),
                     "center": {"lat": round(center.y, 4), "lon": round(center.x, 4)},
                     "land_bounds": land_box, "analysis_box": analysis}
        simple = land.simplify(SIMPLIFY, preserve_topology=True)
        if isinstance(simple, Polygon):
            simple = MultiPolygon([simple])
        geom = json.loads(json.dumps(mapping(simple)), parse_float=lambda x: round(float(x), 5))
        features.append({"type": "Feature", "properties": {"id": gid, "name": name}, "geometry": geom})
        print(f"{name:15s} rings {len(groups[gid]):3d}  land {km2:7.1f} km²  land {land_box}  analysis {analysis}")

    PUBLIC_DATA.mkdir(parents=True, exist_ok=True)
    gj = {"type": "FeatureCollection", "attribution": "© OpenStreetMap contributors, ODbL", "features": features}
    (PUBLIC_DATA / "islands.geojson").write_text(json.dumps(gj, separators=(",", ":")))
    (PUBLIC_DATA / "islands.json").write_text(json.dumps({"bbox": BBOX, "source": "OpenStreetMap coastlines (ODbL)", "islands": meta}, indent=2, ensure_ascii=False))
    for f in ("islands.geojson", "islands.json"):
        print(f"{f}: {(PUBLIC_DATA / f).stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    main()

"""Write the per-island analysis boxes as GeoJSON files to upload to the Allen Coral Atlas
("My Areas" → upload) for the bathymetry download. One file per island plus one with all four.
Reads public/data/islands.json (made by islands.py)."""
import json

from common import PUBLIC_DATA, ROOT

meta = json.loads((PUBLIC_DATA / "islands.json").read_text())["islands"]
out = ROOT / "pipeline" / "areas"
out.mkdir(exist_ok=True)


def feature(gid, info):
    b = info["analysis_box"]
    ring = [[b["west"], b["south"]], [b["east"], b["south"]], [b["east"], b["north"]], [b["west"], b["north"]], [b["west"], b["south"]]]
    return {"type": "Feature", "properties": {"name": f"ReefQuest {info['name']}", "id": gid},
            "geometry": {"type": "Polygon", "coordinates": [ring]}}


feats = [feature(g, i) for g, i in meta.items()]
for f in feats:
    (out / f"{f['properties']['id']}.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": [f]}, indent=1, ensure_ascii=False))
(out / "bay-islands-all.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": feats}, indent=1, ensure_ascii=False))
print("wrote", sorted(p.name for p in out.glob("*.geojson") if not p.name.startswith("._")))

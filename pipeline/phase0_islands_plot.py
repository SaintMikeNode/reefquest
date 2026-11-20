"""Phase 0 check: island polygons and analysis boxes over the CRW max-DHW map, plus a first
per-island DHW summary (all ocean cells whose centers fall in the island's analysis box)."""
import json
import sys

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import xarray as xr
from matplotlib.patches import Rectangle

from common import BBOX, PUBLIC_DATA, RAW, REPORTS

year = int(sys.argv[1]) if len(sys.argv) > 1 else 2023
meta = json.loads((PUBLIC_DATA / "islands.json").read_text())["islands"]
gj = json.loads((PUBLIC_DATA / "islands.geojson").read_text())
d = xr.open_dataset(RAW / "crw" / f"{year}.nc").CRW_DHW

fig, ax = plt.subplots(figsize=(11, 6.5))
m = ax.pcolormesh(d.longitude, d.latitude, d.max("time"), cmap="YlOrRd", shading="nearest", alpha=.85)
fig.colorbar(m, label=f"max DHW {year} (°C-weeks)")
for f in gj["features"]:
    for poly in f["geometry"]["coordinates"]:
        xs, ys = zip(*poly[0])
        ax.fill(xs, ys, color="#2d6a4f", lw=.4, ec="k")
print(f"{'island':15s} cells  peak-mean  peak-max  peak date   days≥4  days≥8")
for gid, info in meta.items():
    b = info["analysis_box"]
    ax.add_patch(Rectangle((b["west"], b["south"]), b["east"] - b["west"], b["north"] - b["south"], fill=False, lw=1.6, ec="#023e8a"))
    ax.text(b["west"] + .01, b["north"] - .03, info["name"], fontsize=9, color="#023e8a", weight="bold")
    sub = d.sel(latitude=slice(b["north"], b["south"]), longitude=slice(b["west"], b["east"]))
    n = int(sub.notnull().any("time").sum())
    mean, mx = sub.mean(["latitude", "longitude"]), sub.max(["latitude", "longitude"])
    print(f"{info['name']:15s} {n:5d}  {float(mean.max()):9.2f}  {float(mx.max()):8.2f}  {str(mean.idxmax().values)[:10]}  "
          f"{int((mean >= 4).sum()):6d}  {int((mean >= 8).sum()):6d}")
ax.add_patch(Rectangle((BBOX["west"], BBOX["south"]), BBOX["east"] - BBOX["west"], BBOX["north"] - BBOX["south"], fill=False, lw=1, ls="--", ec="k"))
ax.set_aspect(1 / np.cos(np.deg2rad(16.2))); ax.set_facecolor("#bbbbbb")
ax.set_title(f"Island groups (OSM land) and analysis boxes over CRW max DHW {year}")
fig.tight_layout(); fig.savefig(REPORTS / "islands_boxes.png", dpi=110)

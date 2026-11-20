"""Turn the raw NOAA CRW yearly files into compact web data for ReefQuest.

Reads data/raw/crw/<year>.nc (from crw_download.py) and public/data/islands.json (from islands.py).

Writes public/data/heat/:
  index.json         grid geometry, list of years (first date, number of days), encoding
  grid/<year>.bin    one byte per cell per day: DHW × 10 (0–250), 255 = land / no data.
                     Row-major per day, rows north → south (16 × 28 = 448 cells per day).
  islands.json       per island, daily since 1985-04-01: mean DHW, max DHW, mean SST (all × 10, ints)
  latest.json        small file for the home screen: latest date, per-island status, last 120 days of
                     mean DHW, and the yearly maximum DHW (for the "heat stripes")

Island values average every ocean cell whose center lies inside the island's analysis box. That is
a regional 5 km ocean signal, not a measurement on any one reef (the app says so).

Usage: python pipeline/heat_products.py
"""
import datetime as dt
import json

import numpy as np
import xarray as xr

from common import PUBLIC_DATA, RAW

OUT = PUBLIC_DATA / "heat"
NODATA = 255


def load_years() -> list[xr.Dataset]:
    files = sorted(p for p in (RAW / "crw").glob("*.nc") if not p.name.startswith("._"))
    return [xr.open_dataset(p)[["CRW_DHW", "CRW_SST"]].load() for p in files]


def main() -> None:
    years = load_years()
    if not years:
        raise SystemExit("no CRW files; run crw_download.py first")
    lat = years[0].latitude.values
    lon = years[0].longitude.values
    meta_islands = json.loads((PUBLIC_DATA / "islands.json").read_text())["islands"]
    (OUT / "grid").mkdir(parents=True, exist_ok=True)

    # One continuous daily axis; fill any missing day by carrying the previous day forward.
    ds = xr.concat(years, "time")
    ds = ds.assign_coords(time=ds.time.dt.floor("D")).drop_duplicates("time").sortby("time")
    full = np.arange(ds.time.values[0], ds.time.values[-1] + np.timedelta64(1, "D"), np.timedelta64(1, "D"))
    missing = len(full) - ds.sizes["time"]
    if missing > 30:
        print(f"WARNING: {missing} days missing — download incomplete? (years on disk: {[y.time.dt.year.values[0] for y in years]})")
    ds = ds.reindex(time=full).ffill("time")
    dates = [str(t)[:10] for t in ds.time.values]
    print(f"{dates[0]} → {dates[-1]}: {len(dates)} days ({missing} missing days filled forward)")

    dhw = ds.CRW_DHW.values  # (time, lat, lon)
    sst = ds.CRW_SST.values
    ocean = np.isfinite(dhw).any(0)

    # Yearly grids.
    index_years = []
    year_of = np.array([int(d[:4]) for d in dates])
    for y in np.unique(year_of):
        sel = year_of == y
        g = np.where(np.isfinite(dhw[sel]), np.clip(np.round(dhw[sel] * 10), 0, 250), NODATA).astype(np.uint8)
        g.tofile(OUT / "grid" / f"{y}.bin")
        first = dates[int(np.argmax(sel))]
        index_years.append({"year": int(y), "first": first, "days": int(sel.sum())})
    (OUT / "index.json").write_text(json.dumps({
        "source": "NOAA Coral Reef Watch v3.1, 5 km daily (ERDDAP dhw_5km)",
        "rows": len(lat), "cols": len(lon),
        "lat": [round(float(lat[0]), 3), round(float(lat[-1]), 3)],  # first row (north), last row
        "lon": [round(float(lon[0]), 3), round(float(lon[-1]), 3)],
        "cell_deg": 0.05, "encoding": "uint8 DHW*10, 255 = no data, day-major, rows north→south",
        "first": dates[0], "last": dates[-1], "years": index_years,
    }, indent=1))

    # Per-island daily series.
    series, latest = {}, {"date": dates[-1], "islands": {}}
    for gid, info in meta_islands.items():
        b = info["analysis_box"]
        rows = (lat <= b["north"]) & (lat >= b["south"])
        cols = (lon >= b["west"]) & (lon <= b["east"])
        m = ocean & rows[:, None] & cols[None, :]
        d = dhw[:, m]
        s = sst[:, m]
        mean = np.nanmean(d, 1)
        mx = np.nanmax(d, 1)
        sm = np.nanmean(s, 1)
        series[gid] = {
            "cells": int(m.sum()),
            "dhw_mean": np.round(mean * 10).astype(int).tolist(),
            "dhw_max": np.round(mx * 10).astype(int).tolist(),
            "sst_mean": np.round(sm * 10).astype(int).tolist(),
        }
        yearly = []
        for y in np.unique(year_of):
            sel = year_of == y
            yearly.append(round(float(mean[sel].max()), 1))
        latest["islands"][gid] = {
            "name": info["name"],
            "dhw": round(float(mean[-1]), 2), "dhw_max": round(float(mx[-1]), 2),
            "sst": round(float(sm[-1]), 2),
            "dhw_7d_ago": round(float(mean[-8]), 2),
            "recent_dhw": np.round(mean[-120:] * 10).astype(int).tolist(),
            "year_max_dhw": yearly,
        }
        rec = int(np.argmax(yearly))
        print(f"{info['name']:15s} cells {m.sum():3d}  now {mean[-1]:5.2f}  record year {int(np.unique(year_of)[rec])} ({yearly[rec]})")
    latest["years"] = [int(y) for y in np.unique(year_of)]
    # Last day's full grid for the home-screen map (same encoding as grid/<year>.bin).
    last = dhw[-1]
    latest["grid"] = np.where(np.isfinite(last), np.clip(np.round(last * 10), 0, 250), NODATA).astype(int).ravel().tolist()
    (OUT / "islands.json").write_text(json.dumps({"first": dates[0], "last": dates[-1], "scale": 10, "islands": series}, separators=(",", ":")))
    (OUT / "latest.json").write_text(json.dumps(latest, separators=(",", ":")))
    total = sum(p.stat().st_size for p in (OUT / "grid").glob("*.bin") if not p.name.startswith("._"))
    for f in ("index.json", "islands.json", "latest.json"):
        print(f"  {f}: {(OUT / f).stat().st_size / 1024:.0f} KB")
    print(f"  grid/*.bin: {len(index_years)} files, {total / 1e6:.1f} MB total")


if __name__ == "__main__":
    main()

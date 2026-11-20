"""Phase 0 check: open one year of CRW data, print grid facts and plot it.

Usage: python pipeline/crw_inspect.py 2023
Writes docs/phase0/crw_<year>_timeseries.png and crw_<year>_maxdhw_map.png.
"""
import sys

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import xarray as xr

from common import RAW, REPORTS

year = int(sys.argv[1])
ds = xr.open_dataset(RAW / "crw" / f"{year}.nc")
print(ds)
lat, lon = ds.latitude.values, ds.longitude.values
print(f"\nlat {lat.min():.3f}..{lat.max():.3f} ({len(lat)} rows, first {lat[0]:.3f}) "
      f"lon {lon.min():.3f}..{lon.max():.3f} ({len(lon)} cols); days {ds.sizes['time']} "
      f"{str(ds.time.values[0])[:10]} → {str(ds.time.values[-1])[:10]}")
dhw = ds.CRW_DHW
ocean = dhw.notnull().any("time")
print(f"cells: {ocean.size}, with ocean data: {int(ocean.sum())}, land/no-data: {int((~ocean).sum())}")
gaps = dhw.where(ocean).isnull().sum().item()
print(f"missing ocean cell-days: {gaps}")
print(f"DHW max anywhere: {float(dhw.max()):.2f} on {str(dhw.max('latitude').max('longitude').idxmax().values)[:10]}")
print(f"SST range: {float(ds.CRW_SST.min()):.2f}..{float(ds.CRW_SST.max()):.2f} °C")
baa = ds.CRW_BAA.max(["latitude", "longitude"]).to_series()
for lvl, name in enumerate(["no stress", "watch", "warning", "alert 1", "alert 2"]):
    print(f"  days with box-max BAA = {lvl} ({name}): {(baa == lvl).sum()}")

fig, (a1, a2) = plt.subplots(2, 1, figsize=(10, 6.5), sharex=True)
t = ds.time.values
a1.fill_between(t, dhw.min(["latitude", "longitude"]), dhw.max(["latitude", "longitude"]), color="#f4a582", alpha=.5, label="min–max over box")
a1.plot(t, dhw.mean(["latitude", "longitude"]), color="#b2182b", label="box mean")
for y, lbl in [(4, "Alert 1 (~4)"), (8, "Alert 2 (~8)")]:
    a1.axhline(y, ls="--", lw=.8, color="k"); a1.text(t[5], y + .2, lbl, fontsize=8)
a1.set_ylabel("DHW (°C-weeks)"); a1.legend(loc="upper left"); a1.set_title(f"NOAA CRW 5 km, Bay Islands box, {year}")
a2.plot(t, ds.CRW_SST.mean(["latitude", "longitude"]), color="#2166ac", label="SST mean")
a2.set_ylabel("SST (°C)"); a2.legend(loc="upper left")
fig.tight_layout(); fig.savefig(REPORTS / f"crw_{year}_timeseries.png", dpi=110)

fig, ax = plt.subplots(figsize=(9, 5.5))
m = ax.pcolormesh(lon, lat, dhw.max("time"), cmap="YlOrRd", shading="nearest")
ax.set_aspect(1 / np.cos(np.deg2rad(16.2)))
fig.colorbar(m, label=f"max DHW {year} (°C-weeks)")
ax.set_title(f"Max DHW per 5 km cell, {year} (grey = land / no data)"); ax.set_facecolor("#bbbbbb")
fig.tight_layout(); fig.savefig(REPORTS / f"crw_{year}_maxdhw_map.png", dpi=110)
print("plots written")

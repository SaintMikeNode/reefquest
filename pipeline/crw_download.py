"""Download NOAA Coral Reef Watch v3.1 daily 5 km heat-stress grids for the Bay Islands box.

Source: ERDDAP griddap dataset dhw_5km. CoastWatch (NOAA_DHW) and upwell both redirect to the
PacIOOS ERDDAP, which serves the full record (1985-04-01 → ~2 days ago), so it is tried first.
Latitude is stored north → south, so the query brackets go north first. The grid is 0.05° with
cell centers at x.x25 / x.x75; we ask for the centers that lie inside BBOX, because asking for an
edge value (e.g. -87.1) makes ERDDAP snap to the cell just outside the box.
One NetCDF file per year goes to data/raw/crw/<year>.nc (git-ignored).

Usage:  python pipeline/crw_download.py 2023 [2024 ...]   or   --all   (1985 → latest)
"""
import argparse
import datetime as dt
import sys
import time

import requests

from common import BBOX, RAW, USER_AGENT

SERVERS = [
    ("https://pae-paha.pacioos.hawaii.edu/erddap/griddap/dhw_5km", "PacIOOS"),
    ("https://coastwatch.pfeg.noaa.gov/erddap/griddap/NOAA_DHW", "CoastWatch"),
]
HALF_CELL = 0.025
VARIABLES = ["CRW_DHW", "CRW_BAA", "CRW_BAA_7D_MAX", "CRW_SST", "CRW_SSTANOMALY", "CRW_HOTSPOT"]
FIRST_DAY = dt.date(1985, 4, 1)
OUT_DIR = RAW / "crw"


def query(year: int, last_day: dt.date) -> str:
    start = max(dt.date(year, 1, 1), FIRST_DAY)
    end = min(dt.date(year, 12, 31), last_day)
    t = f"[({start}T12:00:00Z):1:({end}T12:00:00Z)]"
    n, s_ = BBOX["north"] - HALF_CELL, BBOX["south"] + HALF_CELL
    w, e = BBOX["west"] + HALF_CELL, BBOX["east"] - HALF_CELL
    box = f"[({n:.3f}):1:({s_:.3f})][({w:.3f}):1:({e:.3f})]"
    return ",".join(f"{v}{t}{box}" for v in VARIABLES)


def latest_day() -> dt.date:
    """Last date the server has (it lags real time by ~2 days)."""
    for base, name in SERVERS:
        try:
            r = requests.get(f"{base}.csv?time[(last)]", headers={"User-Agent": USER_AGENT}, timeout=120)
            r.raise_for_status()
            return dt.date.fromisoformat(r.text.strip().splitlines()[-1][:10])
        except requests.RequestException as e:
            print(f"latest date: {name} failed: {e}", file=sys.stderr)
    raise SystemExit("could not reach any ERDDAP server")


def download(year: int, last_day: dt.date, force: bool = False) -> None:
    out = OUT_DIR / f"{year}.nc"
    current_year = year == last_day.year
    if out.exists() and not force and not current_year:
        print(f"{year}: already have {out.name} ({out.stat().st_size / 1e6:.1f} MB), skipping")
        return
    q = query(year, last_day)
    for base, name in SERVERS:
        for attempt in range(1, 4):
            try:
                t0 = time.time()
                r = requests.get(f"{base}.nc?{q}", headers={"User-Agent": USER_AGENT}, timeout=900)
                r.raise_for_status()
                tmp = out.with_suffix(".part")
                tmp.write_bytes(r.content)
                tmp.replace(out)
                print(f"{year}: {len(r.content) / 1e6:.1f} MB from {name} in {time.time() - t0:.0f} s")
                return
            except requests.RequestException as e:
                print(f"{year}: {name} attempt {attempt} failed: {e}", file=sys.stderr)
                time.sleep(5 * attempt)
    raise RuntimeError(f"{year}: all servers failed")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("years", nargs="*", type=int)
    p.add_argument("--all", action="store_true", help="every year from 1985 to the latest")
    p.add_argument("--force", action="store_true", help="re-download years already on disk")
    a = p.parse_args()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    last = latest_day()
    years = list(range(1985, last.year + 1)) if a.all else a.years
    if not years:
        p.error("give one or more years, or --all")
    print(f"Latest day on server: {last}. Downloading {len(years)} year(s).")
    failed = []
    for i, y in enumerate(years, 1):
        try:
            download(y, last, a.force)
        except RuntimeError as e:
            print(e, file=sys.stderr)
            failed.append(y)
        print(f"  progress: {i}/{len(years)} years done")
    if failed:
        raise SystemExit(f"failed years (rerun to retry): {failed}")


if __name__ == "__main__":
    main()

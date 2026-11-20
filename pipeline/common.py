"""Shared constants for the ReefQuest data pipeline.

Hard scope limit: the Bay Islands department of Honduras. Every data pull is clipped to BBOX.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
PUBLIC_DATA = ROOT / "public" / "data"
REPORTS = ROOT / "docs" / "phase0"

# Degrees. West/east are negative (western hemisphere).
BBOX = {"south": 15.8, "north": 16.6, "west": -87.1, "east": -85.7}

USER_AGENT = "ReefQuest-data-pipeline/0.1 (educational, noncommercial)"

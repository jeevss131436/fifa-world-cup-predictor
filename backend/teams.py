"""Team metadata helpers: canonical WC2026 names, aliasing, and group parsing.

`data/schedule.csv` is the single source of truth for which teams play in the
group stage and which group each belongs to. The raw stat files spell country
names inconsistently (USA vs United States, Czechia vs Czech Republic,
Cabo Verde vs Cape Verde Islands, ...), so `normalize_country()` maps every
known variant onto the exact name used in the schedule. That lets the frontend
dropdowns, the schedule, and the model features all agree on one name per team.
"""
from __future__ import annotations

import os
from functools import lru_cache

import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA_DIR = os.path.join(ROOT, "data")
SCHEDULE_CSV = os.path.join(DATA_DIR, "schedule.csv")

# Group-stage matchdays in the schedule (knockout rows have a blank matchday).
GROUP_STAGE_MATCHDAYS = {"1", "2", "3"}

# Lowercased raw-data variant -> canonical schedule name.
# Only teams whose raw spelling differs from the schedule need an entry here.
_ALIASES: dict[str, str] = {
    "usa": "USA",
    "united states": "USA",
    "czechia": "Czech Republic",
    "korea republic": "South Korea",
    "korea dpr": "North Korea",
    "ir iran": "Iran",
    "cote d'ivoire": "Ivory Coast",
    "côte d'ivoire": "Ivory Coast",
    "bosnia and herzegovina": "Bosnia & Herzegovina",
    "bosnia-herzegovina": "Bosnia & Herzegovina",
    "cabo verde": "Cape Verde Islands",
    "cape verde": "Cape Verde Islands",
    "democratic republic of the congo": "Congo DR",
    "dr congo": "Congo DR",
    "curaçao": "Curacao",
    "türkiye": "Turkiye",
    "turkey": "Turkiye",
}


def normalize_country(name: object) -> object:
    """Map a raw country string onto its canonical schedule name.

    Unknown names pass through unchanged (stripped), so non-WC countries in the
    raw data simply never match a schedule team.
    """
    if not isinstance(name, str):
        return name
    cleaned = name.strip()
    return _ALIASES.get(cleaned.lower(), cleaned)


@lru_cache(maxsize=1)
def load_schedule() -> pd.DataFrame:
    return pd.read_csv(SCHEDULE_CSV, dtype=str).fillna("")


def group_stage_matches() -> pd.DataFrame:
    """All group-stage fixtures, with a normalized `group` column kept as-is."""
    df = load_schedule()
    mask = df["matchday"].str.strip().isin(GROUP_STAGE_MATCHDAYS)
    return df[mask].copy()


@lru_cache(maxsize=1)
def get_groups() -> dict[str, list[str]]:
    """Return {group_letter: [team, ...]} parsed from the group-stage schedule."""
    groups: dict[str, set[str]] = {}
    for _, row in group_stage_matches().iterrows():
        group = row["group"].strip()
        if not group:
            continue
        groups.setdefault(group, set()).update(
            {row["home_team"].strip(), row["away_team"].strip()}
        )
    return {group: sorted(groups[group]) for group in sorted(groups)}


@lru_cache(maxsize=1)
def schedule_team_names() -> list[str]:
    """Sorted, unique list of every team that appears in the group stage."""
    return sorted({team for teams in get_groups().values() for team in teams})

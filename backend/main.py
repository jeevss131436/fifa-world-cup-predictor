"""FastAPI service that exposes the World Cup match simulator.

Run from the repo root so simulator.py's relative data paths resolve:

  uvicorn backend.main:app --reload --port 8000

Endpoints (the Next.js app reaches these via the /api/py/* rewrite):
  POST /predict  {home_team, away_team} -> match prediction
  GET  /teams                            -> teams selectable in the UI
  GET  /groups                           -> {group: [team, ...]}
  GET  /schedule                         -> group-stage fixtures
  GET  /health                           -> liveness probe
"""
from __future__ import annotations

import os
import sys

# --- Make the app runnable from anywhere -----------------------------------
# simulator.py loads "data/...", "scaler.pkl" and "world_cup_model.pth" with
# paths relative to the working directory, so pin the CWD to the repo root
# before importing it. Also expose both the repo root and this package on the
# import path. UTF-8 keeps simulator.py's emoji startup logs from crashing on
# Windows' cp1252 console.
os.environ.setdefault("PYTHONUTF8", "1")
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
sys.path.insert(0, ROOT)
os.chdir(ROOT)

import pandas as pd  # noqa: E402
from fastapi import FastAPI, HTTPException  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from pydantic import BaseModel  # noqa: E402

import simulator  # noqa: E402  (loads the model + datasets once, on import)
from teams import get_groups, group_stage_matches, schedule_team_names  # noqa: E402

app = FastAPI(title="World Cup 2026 Simulator API", version="1.0.0")

# The Next.js dev server proxies through its own origin, but allow direct
# browser access during development too.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class PredictionRequest(BaseModel):
    home_team: str
    away_team: str


def _teams_with_data() -> set[str]:
    """Countries present in every dataset the simulator needs for a prediction.

    Guarantees the UI never offers a team that would raise "team not found".
    """
    have_value = set(simulator.df_values["country"])
    have_rank = set(simulator.df_momentum["country"])
    have_strength = set(simulator.pos_averages["country"])
    return have_value & have_rank & have_strength


def _available_teams() -> list[str]:
    with_data = _teams_with_data()
    return [team for team in schedule_team_names() if team in with_data]


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/teams")
def teams() -> dict[str, list[str]]:
    """Sorted, unique list of group-stage teams that have full model data."""
    return {"teams": _available_teams()}


@app.get("/groups")
def groups() -> dict[str, dict[str, list[str]]]:
    """Group-stage teams keyed by group letter (A-L), parsed from the schedule."""
    with_data = _teams_with_data()
    grouped = {
        group: [team for team in members if team in with_data]
        for group, members in get_groups().items()
    }
    return {"groups": grouped}


@app.get("/schedule")
def schedule() -> dict[str, list[dict[str, str]]]:
    """All group-stage fixtures in chronological order, as listed in the CSV."""
    fixtures = group_stage_matches().to_dict(orient="records")
    return {"fixtures": fixtures}


@app.post("/predict")
def predict(req: PredictionRequest) -> dict:
    if req.home_team == req.away_team:
        raise HTTPException(status_code=400, detail="A team cannot play itself.")

    result = simulator.get_match_prediction(req.home_team, req.away_team)

    # simulator.py signals an unknown team with an {"error": ...} dict.
    if isinstance(result, dict) and "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result

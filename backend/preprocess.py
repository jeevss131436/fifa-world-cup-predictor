"""Generate the processed CSVs that simulator.py loads at startup.

simulator.py reads three derived files (all keyed on the canonical schedule
country name):

  data/squad_values.csv             -> country, market_value
  data/processed_momentum.csv       -> country, current_rank
  data/processed_squad_strength.csv -> country, weighted_squad_strength

These are built here from the raw exports (team_value.csv, fifa_ranking.csv,
player_rating.csv). Re-run whenever the raw data changes:

  python backend/preprocess.py

NOTE: these derivations are a sensible reconstruction so the model pipeline runs
end to end. If you still have the exact dataframes used to train the model, drop
those CSVs in instead — the only contract simulator.py cares about is the file
names and the column names above.
"""
from __future__ import annotations

import os
import sys

import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

from teams import DATA_DIR, normalize_country, schedule_team_names  # noqa: E402


def _read(name: str) -> pd.DataFrame:
    return pd.read_csv(os.path.join(DATA_DIR, name))


def build_squad_values() -> pd.DataFrame:
    df = _read("team_value.csv").rename(
        columns={"Country": "country", "Market Value": "market_value"}
    )
    df["country"] = df["country"].map(normalize_country)
    df["market_value"] = pd.to_numeric(
        df["market_value"].astype(str).str.replace(",", "", regex=False),
        errors="coerce",
    )
    df = df.dropna(subset=["market_value"])
    # Collapse any duplicate spellings that normalized to the same team.
    return df.groupby("country", as_index=False)["market_value"].max()


def build_momentum() -> pd.DataFrame:
    df = _read("fifa_ranking.csv")
    df["country"] = df["country"].map(normalize_country)
    df["current_rank"] = pd.to_numeric(df["rank"], errors="coerce")
    df["rank_date"] = pd.to_datetime(df["rank_date"], errors="coerce")
    df = df.dropna(subset=["current_rank"])
    # Keep each country's most recent ranking row.
    latest = df.sort_values("rank_date").groupby("country", as_index=False).tail(1)
    return latest[["country", "current_rank"]].reset_index(drop=True)


def build_squad_strength() -> pd.DataFrame:
    df = _read("player_rating.csv")
    df["country"] = df["country"].map(normalize_country)
    df["overall"] = pd.to_numeric(df["overall"], errors="coerce")
    df = df.dropna(subset=["overall"])

    rows: list[dict[str, object]] = []
    for country, grp in df.groupby("country"):
        ratings = grp["overall"].sort_values(ascending=False)
        top11 = ratings.head(11)
        bench = ratings.iloc[11:23]
        # Weight the projected starting XI more heavily than the bench.
        if len(bench) > 0:
            strength = 0.65 * top11.mean() + 0.35 * bench.mean()
        else:
            strength = top11.mean()
        rows.append(
            {"country": country, "weighted_squad_strength": round(float(strength), 4)}
        )
    return pd.DataFrame(rows)


def main() -> None:
    outputs = {
        "squad_values.csv": build_squad_values(),
        "processed_momentum.csv": build_momentum(),
        "processed_squad_strength.csv": build_squad_strength(),
    }
    for name, frame in outputs.items():
        path = os.path.join(DATA_DIR, name)
        frame.to_csv(path, index=False)
        print(f"  wrote {name:<32} ({len(frame)} rows)")

    # Report any group-stage team missing from a derived file -- those would
    # raise "team not found" in the simulator and should be dropped from the UI.
    teams = set(schedule_team_names())
    for name, frame in outputs.items():
        missing = sorted(teams - set(frame["country"]))
        label = name.replace(".csv", "")
        print(f"  {label:<28} missing {len(missing)}: {missing}")


if __name__ == "__main__":
    print("Building processed datasets...")
    main()
    print("Done.")

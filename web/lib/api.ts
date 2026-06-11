// Thin client for the FastAPI backend. Every call goes through the Next.js
// rewrite (/api/py/* -> FastAPI), so there is no CORS and no hard-coded host.

export type Prediction = {
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  expected_goals_home: number;
  expected_goals_away: number;
  total_predicted_goals: number;
  rating_gap: number;
};

// Group letter (A-L) -> teams in that group.
export type Groups = Record<string, string[]>;

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`/api/py${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

export async function fetchGroups(): Promise<Groups> {
  const data = await getJson<{ groups: Groups }>("/groups");
  return data.groups;
}

export async function predictMatch(
  homeTeam: string,
  awayTeam: string,
): Promise<Prediction> {
  const res = await fetch("/api/py/predict", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ home_team: homeTeam, away_team: awayTeam }),
  });
  if (!res.ok) {
    const detail = await res
      .json()
      .then((d) => d.detail)
      .catch(() => null);
    throw new Error(detail || `Prediction failed (${res.status})`);
  }
  return res.json();
}

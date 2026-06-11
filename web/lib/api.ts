import type { Fixture, Groups, Prediction } from "./types";

export type { Fixture, Groups, Prediction };

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`/api/py${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

export async function fetchGroups(): Promise<Groups> {
  const data = await getJson<{ groups: Groups }>("/groups");
  return data.groups;
}

export async function fetchSchedule(): Promise<Fixture[]> {
  const data = await getJson<{ fixtures: Fixture[] }>("/schedule");
  return data.fixtures;
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
      .then((d: { detail?: string }) => d.detail)
      .catch(() => null);
    throw new Error(detail ?? `Prediction failed (${res.status})`);
  }
  return res.json();
}

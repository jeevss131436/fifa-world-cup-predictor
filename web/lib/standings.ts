import type { CompletedMatch, Groups, TeamStats } from "./types";

export type { CompletedMatch, TeamStats };

export function calculateStandings(
  matches: CompletedMatch[],
  groups: Groups,
): Record<string, TeamStats[]> {
  const stats: Record<string, TeamStats> = {};

  for (const teams of Object.values(groups)) {
    for (const team of teams) {
      stats[team] = {
        team,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        gf: 0,
        ga: 0,
        gd: 0,
        points: 0,
      };
    }
  }

  for (const match of matches) {
    const { home_team, away_team } = match.fixture;
    const { home_score, away_score } = match;
    if (!stats[home_team] || !stats[away_team]) continue;

    stats[home_team].played++;
    stats[away_team].played++;
    stats[home_team].gf += home_score;
    stats[home_team].ga += away_score;
    stats[away_team].gf += away_score;
    stats[away_team].ga += home_score;

    if (home_score > away_score) {
      stats[home_team].won++;
      stats[home_team].points += 3;
      stats[away_team].lost++;
    } else if (away_score > home_score) {
      stats[away_team].won++;
      stats[away_team].points += 3;
      stats[home_team].lost++;
    } else {
      stats[home_team].drawn++;
      stats[home_team].points++;
      stats[away_team].drawn++;
      stats[away_team].points++;
    }
  }

  const result: Record<string, TeamStats[]> = {};
  for (const [group, teams] of Object.entries(groups)) {
    const rows = teams.map((t) => ({
      ...stats[t],
      gd: stats[t].gf - stats[t].ga,
    }));
    // FIFA tiebreaker order: points → GD → GF → alphabetical
    rows.sort(
      (a, b) =>
        b.points - a.points ||
        b.gd - a.gd ||
        b.gf - a.gf ||
        a.team.localeCompare(b.team),
    );
    result[group] = rows;
  }

  return result;
}

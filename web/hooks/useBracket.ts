"use client";

import { useCallback, useRef, useState } from "react";

import { predictMatch } from "@/lib/api";
import type { Prediction, TeamStats } from "@/lib/types";

/**
 * State layer for the 48-team 2026 World Cup knockout bracket (Matches 73–104).
 *
 * This file owns three things and nothing else (no UI):
 *   1. The MatchNode shape.
 *   2. INITIAL_2026_SCHEDULE — the 32 knockout fixtures and how they wire together.
 *   3. useBracket() — React state + advanceWinner() that propagates results
 *      forward through the tree.
 *
 * Bracket wiring (winner -> nextMatchId):
 *   R32 (73–88) ┐
 *               ├─ R16 (89–96) ┐
 *               │              ├─ QF (97–100) ┐
 *               │              │               ├─ SF (101–102) ┬─ Final (104)
 *               │              │               │               └─ 3rd place (103) ← SF losers
 * The 73 & 75 → 90 crossing FIFA published is encoded below; the remaining
 * R32→R16 slot assignments and the dates/stadiums are a best-effort transcription
 * of the official schedule and should be sanity-checked against FIFA before launch.
 * The propagation logic itself is source-agnostic — fix a row and it still flows.
 */

export type KnockoutStage =
  | "Round of 32"
  | "Round of 16"
  | "Quarter-final"
  | "Semi-final"
  | "Third-place"
  | "Final";

/** Which side of a downstream match an advancing team lands in. */
export type Slot = "home" | "away";

export interface MatchNode {
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  /** ISO date, e.g. "2026-06-28". */
  date: string;
  /** "Stadium, City". */
  stadium: string;
  stage: KnockoutStage;
  /** Match the WINNER advances to (null only for the Final). */
  nextMatchId: number | null;
  /** Which slot of nextMatchId the winner fills. */
  nextSlot: Slot | null;
  /**
   * Where the LOSER goes — set only for the semi-finals (101, 102), which feed
   * the third-place play-off (103). Undefined everywhere else.
   */
  loserNextMatchId?: number | null;
  loserNextSlot?: Slot | null;
  /**
   * Set when a level scoreline was settled by a shootout, so the UI can mark
   * "(won on penalties)". Undefined for matches decided in normal time.
   */
  shootoutWinner?: Slot | null;
}

/**
 * The 32 knockout fixtures. Team names are placeholders ("Winner Group A",
 * "Winner Match 73", …) that advanceWinner() overwrites as results come in.
 */
export const INITIAL_2026_SCHEDULE: MatchNode[] = [
  // ── Round of 32 — Jun 28 → Jul 3 ──────────────────────────────────────────
  {
    matchId: 73,
    homeTeam: "Runner-up Group A",
    awayTeam: "Runner-up Group B",
    homeScore: null,
    awayScore: null,
    date: "2026-06-28",
    stadium: "SoFi Stadium, Los Angeles",
    stage: "Round of 32",
    nextMatchId: 90,
    nextSlot: "home",
  },
  {
    matchId: 74,
    homeTeam: "Winner Group E",
    awayTeam: "3rd Place A/B/C/D/F",
    homeScore: null,
    awayScore: null,
    date: "2026-06-28",
    stadium: "Gillette Stadium, Boston",
    stage: "Round of 32",
    nextMatchId: 89,
    nextSlot: "home",
  },
  {
    matchId: 75,
    homeTeam: "Winner Group F",
    awayTeam: "Runner-up Group C",
    homeScore: null,
    awayScore: null,
    date: "2026-06-29",
    stadium: "Estadio BBVA, Monterrey",
    stage: "Round of 32",
    nextMatchId: 90,
    nextSlot: "away",
  },
  {
    matchId: 76,
    homeTeam: "Winner Group C",
    awayTeam: "Runner-up Group F",
    homeScore: null,
    awayScore: null,
    date: "2026-06-29",
    stadium: "NRG Stadium, Houston",
    stage: "Round of 32",
    nextMatchId: 91,
    nextSlot: "home",
  },
  {
    matchId: 77,
    homeTeam: "Winner Group I",
    awayTeam: "3rd Place C/D/F/G/H",
    homeScore: null,
    awayScore: null,
    date: "2026-06-29",
    stadium: "MetLife Stadium, New York/New Jersey",
    stage: "Round of 32",
    nextMatchId: 89,
    nextSlot: "away",
  },
  {
    matchId: 78,
    homeTeam: "Runner-up Group E",
    awayTeam: "Runner-up Group I",
    homeScore: null,
    awayScore: null,
    date: "2026-06-30",
    stadium: "AT&T Stadium, Dallas",
    stage: "Round of 32",
    nextMatchId: 91,
    nextSlot: "away",
  },
  {
    matchId: 79,
    homeTeam: "Winner Group A",
    awayTeam: "3rd Place C/E/F/H/I",
    homeScore: null,
    awayScore: null,
    date: "2026-06-30",
    stadium: "Arrowhead Stadium, Kansas City",
    stage: "Round of 32",
    nextMatchId: 92,
    nextSlot: "home",
  },
  {
    matchId: 80,
    homeTeam: "Winner Group L",
    awayTeam: "3rd Place E/H/I/J/K",
    homeScore: null,
    awayScore: null,
    date: "2026-06-30",
    stadium: "Lumen Field, Seattle",
    stage: "Round of 32",
    nextMatchId: 93,
    nextSlot: "home",
  },
  {
    matchId: 81,
    homeTeam: "Runner-up Group D",
    awayTeam: "Runner-up Group G",
    homeScore: null,
    awayScore: null,
    date: "2026-07-01",
    stadium: "Mercedes-Benz Stadium, Atlanta",
    stage: "Round of 32",
    nextMatchId: 92,
    nextSlot: "away",
  },
  {
    matchId: 82,
    homeTeam: "Winner Group K",
    awayTeam: "3rd Place D/E/I/J/L",
    homeScore: null,
    awayScore: null,
    date: "2026-07-01",
    stadium: "Levi's Stadium, San Francisco Bay Area",
    stage: "Round of 32",
    nextMatchId: 93,
    nextSlot: "away",
  },
  {
    matchId: 83,
    homeTeam: "Winner Group D",
    awayTeam: "3rd Place B/E/F/I/J",
    homeScore: null,
    awayScore: null,
    date: "2026-07-01",
    stadium: "BMO Field, Toronto",
    stage: "Round of 32",
    nextMatchId: 94,
    nextSlot: "home",
  },
  {
    matchId: 84,
    homeTeam: "Winner Group G",
    awayTeam: "3rd Place A/E/H/I/J",
    homeScore: null,
    awayScore: null,
    date: "2026-07-02",
    stadium: "Hard Rock Stadium, Miami",
    stage: "Round of 32",
    nextMatchId: 95,
    nextSlot: "home",
  },
  {
    matchId: 85,
    homeTeam: "Runner-up Group H",
    awayTeam: "Runner-up Group J",
    homeScore: null,
    awayScore: null,
    date: "2026-07-02",
    stadium: "Estadio Akron, Guadalajara",
    stage: "Round of 32",
    nextMatchId: 94,
    nextSlot: "away",
  },
  {
    matchId: 86,
    homeTeam: "Winner Group B",
    awayTeam: "3rd Place E/F/G/I/J",
    homeScore: null,
    awayScore: null,
    date: "2026-07-02",
    stadium: "BC Place, Vancouver",
    stage: "Round of 32",
    nextMatchId: 95,
    nextSlot: "away",
  },
  {
    matchId: 87,
    homeTeam: "Winner Group H",
    awayTeam: "Runner-up Group K",
    homeScore: null,
    awayScore: null,
    date: "2026-07-03",
    stadium: "Lincoln Financial Field, Philadelphia",
    stage: "Round of 32",
    nextMatchId: 96,
    nextSlot: "home",
  },
  {
    matchId: 88,
    homeTeam: "Winner Group J",
    awayTeam: "Runner-up Group L",
    homeScore: null,
    awayScore: null,
    date: "2026-07-03",
    stadium: "Estadio Azteca, Mexico City",
    stage: "Round of 32",
    nextMatchId: 96,
    nextSlot: "away",
  },

  // ── Round of 16 — Jul 4 → Jul 7 ───────────────────────────────────────────
  {
    matchId: 89,
    homeTeam: "Winner Match 74",
    awayTeam: "Winner Match 77",
    homeScore: null,
    awayScore: null,
    date: "2026-07-04",
    stadium: "NRG Stadium, Houston",
    stage: "Round of 16",
    nextMatchId: 97,
    nextSlot: "home",
  },
  {
    matchId: 90,
    homeTeam: "Winner Match 73",
    awayTeam: "Winner Match 75",
    homeScore: null,
    awayScore: null,
    date: "2026-07-04",
    stadium: "Estadio Azteca, Mexico City",
    stage: "Round of 16",
    nextMatchId: 97,
    nextSlot: "away",
  },
  {
    matchId: 91,
    homeTeam: "Winner Match 76",
    awayTeam: "Winner Match 78",
    homeScore: null,
    awayScore: null,
    date: "2026-07-05",
    stadium: "AT&T Stadium, Dallas",
    stage: "Round of 16",
    nextMatchId: 98,
    nextSlot: "home",
  },
  {
    matchId: 92,
    homeTeam: "Winner Match 79",
    awayTeam: "Winner Match 81",
    homeScore: null,
    awayScore: null,
    date: "2026-07-05",
    stadium: "Mercedes-Benz Stadium, Atlanta",
    stage: "Round of 16",
    nextMatchId: 98,
    nextSlot: "away",
  },
  {
    matchId: 93,
    homeTeam: "Winner Match 80",
    awayTeam: "Winner Match 82",
    homeScore: null,
    awayScore: null,
    date: "2026-07-06",
    stadium: "Lincoln Financial Field, Philadelphia",
    stage: "Round of 16",
    nextMatchId: 99,
    nextSlot: "home",
  },
  {
    matchId: 94,
    homeTeam: "Winner Match 83",
    awayTeam: "Winner Match 85",
    homeScore: null,
    awayScore: null,
    date: "2026-07-06",
    stadium: "Lumen Field, Seattle",
    stage: "Round of 16",
    nextMatchId: 99,
    nextSlot: "away",
  },
  {
    matchId: 95,
    homeTeam: "Winner Match 84",
    awayTeam: "Winner Match 86",
    homeScore: null,
    awayScore: null,
    date: "2026-07-07",
    stadium: "SoFi Stadium, Los Angeles",
    stage: "Round of 16",
    nextMatchId: 100,
    nextSlot: "home",
  },
  {
    matchId: 96,
    homeTeam: "Winner Match 87",
    awayTeam: "Winner Match 88",
    homeScore: null,
    awayScore: null,
    date: "2026-07-07",
    stadium: "MetLife Stadium, New York/New Jersey",
    stage: "Round of 16",
    nextMatchId: 100,
    nextSlot: "away",
  },

  // ── Quarter-finals — Jul 9 → Jul 11 ───────────────────────────────────────
  {
    matchId: 97,
    homeTeam: "Winner Match 89",
    awayTeam: "Winner Match 90",
    homeScore: null,
    awayScore: null,
    date: "2026-07-09",
    stadium: "Gillette Stadium, Boston",
    stage: "Quarter-final",
    nextMatchId: 101,
    nextSlot: "home",
  },
  {
    matchId: 98,
    homeTeam: "Winner Match 91",
    awayTeam: "Winner Match 92",
    homeScore: null,
    awayScore: null,
    date: "2026-07-10",
    stadium: "Arrowhead Stadium, Kansas City",
    stage: "Quarter-final",
    nextMatchId: 101,
    nextSlot: "away",
  },
  {
    matchId: 99,
    homeTeam: "Winner Match 93",
    awayTeam: "Winner Match 94",
    homeScore: null,
    awayScore: null,
    date: "2026-07-10",
    stadium: "Hard Rock Stadium, Miami",
    stage: "Quarter-final",
    nextMatchId: 102,
    nextSlot: "home",
  },
  {
    matchId: 100,
    homeTeam: "Winner Match 95",
    awayTeam: "Winner Match 96",
    homeScore: null,
    awayScore: null,
    date: "2026-07-11",
    stadium: "SoFi Stadium, Los Angeles",
    stage: "Quarter-final",
    nextMatchId: 102,
    nextSlot: "away",
  },

  // ── Semi-finals — Jul 14 → Jul 15 ─────────────────────────────────────────
  // Winner -> Final (104); loser -> Third-place play-off (103).
  {
    matchId: 101,
    homeTeam: "Winner Match 97",
    awayTeam: "Winner Match 98",
    homeScore: null,
    awayScore: null,
    date: "2026-07-14",
    stadium: "AT&T Stadium, Dallas",
    stage: "Semi-final",
    nextMatchId: 104,
    nextSlot: "home",
    loserNextMatchId: 103,
    loserNextSlot: "home",
  },
  {
    matchId: 102,
    homeTeam: "Winner Match 99",
    awayTeam: "Winner Match 100",
    homeScore: null,
    awayScore: null,
    date: "2026-07-15",
    stadium: "Mercedes-Benz Stadium, Atlanta",
    stage: "Semi-final",
    nextMatchId: 104,
    nextSlot: "away",
    loserNextMatchId: 103,
    loserNextSlot: "away",
  },

  // ── Third-place play-off — Jul 18 ─────────────────────────────────────────
  {
    matchId: 103,
    homeTeam: "Loser Match 101",
    awayTeam: "Loser Match 102",
    homeScore: null,
    awayScore: null,
    date: "2026-07-18",
    stadium: "Hard Rock Stadium, Miami",
    stage: "Third-place",
    nextMatchId: null,
    nextSlot: null,
  },

  // ── Final — Jul 19 ────────────────────────────────────────────────────────
  {
    matchId: 104,
    homeTeam: "Winner Match 101",
    awayTeam: "Winner Match 102",
    homeScore: null,
    awayScore: null,
    date: "2026-07-19",
    stadium: "MetLife Stadium, New York/New Jersey",
    stage: "Final",
    nextMatchId: null,
    nextSlot: null,
  },
];

export interface UseBracketResult {
  matches: MatchNode[];
  /** True while a simulateRound() request is in flight. */
  isSimulating: boolean;
  /** Last simulation error, or null. Cleared at the start of each round. */
  simulationError: string | null;
  /** Look up a single node by its matchId. */
  getMatch: (matchId: number) => MatchNode | undefined;
  /**
   * Record a result and propagate it. Sets the scores on `matchId`, decides the
   * winner, writes that team into its nextMatchId slot, and (for semi-finals)
   * drops the loser into the third-place play-off. A level scoreline is only
   * resolved when `shootoutWinner` is supplied; otherwise the scores are stored
   * and no team advances (knockout ties need a shootout).
   */
  advanceWinner: (
    matchId: number,
    homeScore: number,
    awayScore: number,
    shootoutWinner?: Slot,
  ) => void;
  /**
   * Simulate every still-unplayed, fully-resolved match in `stageName` against
   * the backend model, then push the winners into the next round. Matches whose
   * slots are still placeholders (an earlier round hasn't been simulated yet)
   * are skipped. Resolves once all winners have been propagated.
   */
  simulateRound: (stageName: KnockoutStage) => Promise<void>;
  /**
   * Fill every R32 placeholder slot from finished group-stage standings.
   * "Winner Group X" / "Runner-up Group X" slots map directly; the eight
   * "3rd Place …" slots are filled by the best 8 third-place finishers
   * (ranked by pts → GD → GF), assigned greedily to the first eligible slot.
   */
  populateFromStandings: (standings: Record<string, TeamStats[]>) => void;
  /** Restore every node to its placeholder, scoreless state. */
  resetBracket: () => void;
}

function cloneSchedule(source: MatchNode[]): MatchNode[] {
  return source.map((node) => ({ ...node }));
}

/** Placeholder slots ("Winner Group A", "Loser Match 101", …) the model can't predict. */
export function isPlaceholder(team: string): boolean {
  return /^(Winner|Runner-up|Loser|3rd Place)\b/.test(team);
}

/** Parse group letters out of "3rd Place A/B/C/D/F" → ["A","B","C","D","F"] */
function parseThirdPlaceGroups(placeholder: string): string[] {
  const m = placeholder.match(/^3rd Place ([A-L/]+)$/);
  return m ? m[1].split("/") : [];
}

/**
 * Pick a winner for a level scoreline: better expected goals, then the rating
 * edge, then the home side. Mirrors how a real knockout tie would break before
 * resorting to a coin-flip.
 */
export function decideShootout(prediction: Prediction): Slot {
  if (prediction.expected_goals_home !== prediction.expected_goals_away) {
    return prediction.expected_goals_home > prediction.expected_goals_away
      ? "home"
      : "away";
  }
  if (prediction.rating_gap !== 0) {
    return prediction.rating_gap > 0 ? "home" : "away";
  }
  return "home";
}

export function useBracket(
  initial: MatchNode[] = INITIAL_2026_SCHEDULE,
): UseBracketResult {
  const [matches, setMatches] = useState<MatchNode[]>(() =>
    cloneSchedule(initial),
  );
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationError, setSimulationError] = useState<string | null>(null);

  // Mirror of `matches` that's readable synchronously inside async loops, so a
  // simulateRound() call sees winners written by the round before it.
  const matchesRef = useRef(matches);
  matchesRef.current = matches;

  const getMatch = useCallback(
    (matchId: number) => matches.find((m) => m.matchId === matchId),
    [matches],
  );

  const advanceWinner = useCallback(
    (
      matchId: number,
      homeScore: number,
      awayScore: number,
      shootoutWinner?: Slot,
    ) => {
      setMatches((prev) => {
        // Work on fresh clones so React sees new references for every node.
        const byId = new Map(prev.map((m) => [m.matchId, { ...m }]));
        const match = byId.get(matchId);
        if (!match) return prev;

        match.homeScore = homeScore;
        match.awayScore = awayScore;

        let homeWon: boolean;
        if (homeScore === awayScore) {
          // Level after normal time — only a shootout result can break it.
          if (!shootoutWinner) return Array.from(byId.values());
          homeWon = shootoutWinner === "home";
          match.shootoutWinner = shootoutWinner;
        } else {
          homeWon = homeScore > awayScore;
          match.shootoutWinner = null;
        }

        const winner = homeWon ? match.homeTeam : match.awayTeam;
        const loser = homeWon ? match.awayTeam : match.homeTeam;

        // Winner flows into the downstream match's home/away slot.
        if (match.nextMatchId != null && match.nextSlot) {
          const next = byId.get(match.nextMatchId);
          if (next) {
            if (match.nextSlot === "home") next.homeTeam = winner;
            else next.awayTeam = winner;
          }
        }

        // Semi-final losers drop into the third-place play-off (Match 103).
        if (match.loserNextMatchId != null && match.loserNextSlot) {
          const consolation = byId.get(match.loserNextMatchId);
          if (consolation) {
            if (match.loserNextSlot === "home") consolation.homeTeam = loser;
            else consolation.awayTeam = loser;
          }
        }

        return Array.from(byId.values());
      });
    },
    [],
  );

  const simulateRound = useCallback(
    async (stageName: KnockoutStage) => {
      // Only unplayed matches whose two teams are both resolved (not placeholders).
      const pending = matchesRef.current.filter(
        (m) =>
          m.stage === stageName &&
          m.homeScore === null &&
          !isPlaceholder(m.homeTeam) &&
          !isPlaceholder(m.awayTeam),
      );
      if (pending.length === 0) return;

      setIsSimulating(true);
      setSimulationError(null);
      try {
        // Matches within one stage are independent, so fan the requests out.
        const settled = await Promise.allSettled(
          pending.map((m) => predictMatch(m.homeTeam, m.awayTeam)),
        );

        const failures: string[] = [];
        settled.forEach((result, i) => {
          const match = pending[i];
          if (result.status === "rejected") {
            failures.push(
              `Match ${match.matchId} (${match.homeTeam} vs ${match.awayTeam}): ${
                result.reason instanceof Error
                  ? result.reason.message
                  : String(result.reason)
              }`,
            );
            return;
          }

          const prediction = result.value;
          const shootoutWinner =
            prediction.home_score === prediction.away_score
              ? decideShootout(prediction)
              : undefined;
          advanceWinner(
            match.matchId,
            prediction.home_score,
            prediction.away_score,
            shootoutWinner,
          );
        });

        if (failures.length > 0) {
          setSimulationError(
            `Could not simulate ${failures.length} match(es): ${failures.join("; ")}`,
          );
        }
      } finally {
        setIsSimulating(false);
      }
    },
    [advanceWinner],
  );

  const populateFromStandings = useCallback(
    (standings: Record<string, TeamStats[]>) => {
      // Build ranked list of 3rd-place finishers, best 8 qualify for R32.
      const allThird = Object.entries(standings)
        .flatMap(([group, teams]) => {
          const t = teams[2];
          return t ? [{ group, team: t.team, pts: t.points, gd: t.gd, gf: t.gf }] : [];
        })
        .sort(
          (a, b) =>
            b.pts - a.pts ||
            b.gd - a.gd ||
            b.gf - a.gf ||
            a.team.localeCompare(b.team),
        )
        .slice(0, 8);

      const assignedGroups = new Set<string>();

      setMatches((prev) => {
        const byId = new Map(prev.map((m) => [m.matchId, { ...m }]));

        for (const m of byId.values()) {
          if (m.stage !== "Round of 32") continue;

          for (const side of ["home", "away"] as const) {
            const placeholder = side === "home" ? m.homeTeam : m.awayTeam;
            if (!isPlaceholder(placeholder)) continue;

            const winnerMatch = placeholder.match(/^Winner Group ([A-L])$/);
            if (winnerMatch) {
              const team = standings[winnerMatch[1]]?.[0]?.team;
              if (team) side === "home" ? (m.homeTeam = team) : (m.awayTeam = team);
              continue;
            }

            const runnerMatch = placeholder.match(/^Runner-up Group ([A-L])$/);
            if (runnerMatch) {
              const team = standings[runnerMatch[1]]?.[1]?.team;
              if (team) side === "home" ? (m.homeTeam = team) : (m.awayTeam = team);
              continue;
            }

            if (placeholder.startsWith("3rd Place")) {
              const eligible = parseThirdPlaceGroups(placeholder);
              const pick = allThird.find(
                (t) => eligible.includes(t.group) && !assignedGroups.has(t.group),
              );
              if (pick) {
                assignedGroups.add(pick.group);
                side === "home" ? (m.homeTeam = pick.team) : (m.awayTeam = pick.team);
              }
            }
          }
        }

        return Array.from(byId.values());
      });
    },
    [],
  );

  const resetBracket = useCallback(() => {
    setMatches(cloneSchedule(initial));
    setSimulationError(null);
  }, [initial]);

  return {
    matches,
    isSimulating,
    simulationError,
    getMatch,
    advanceWinner,
    simulateRound,
    populateFromStandings,
    resetBracket,
  };
}

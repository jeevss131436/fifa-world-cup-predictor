"use client";

import { useEffect, useRef, useState } from "react";
import { fetchGroups, fetchSchedule, predictMatch } from "@/lib/api";
import type { Fixture, Groups, Prediction } from "@/lib/types";
import { calculateStandings } from "@/lib/standings";
import type { CompletedMatch } from "@/lib/standings";
import GroupTable from "@/components/GroupTable";
import KnockoutBracket from "@/components/KnockoutBracket";
import MatchCard from "@/components/MatchCard";

const STORAGE_KEY = "wc2026_sim_v1";

type SimState = {
  completedMatches: CompletedMatch[];
  currentIndex: number;
};

const INITIAL_STATE: SimState = { completedMatches: [], currentIndex: 0 };

export default function Home() {
  const [groups, setGroups] = useState<Groups>({});
  const [schedule, setSchedule] = useState<Fixture[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  const [sim, setSim] = useState<SimState>(INITIAL_STATE);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [predLoading, setPredLoading] = useState(false);
  const [predError, setPredError] = useState<string | null>(null);

  const [simAllLoading, setSimAllLoading] = useState(false);

  const [confirmReset, setConfirmReset] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore from localStorage once on mount.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setSim(JSON.parse(saved) as SimState);
    } catch {
      // Corrupt storage — start fresh.
    }
  }, []);

  // Persist on every sim change.
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sim));
  }, [sim]);

  // Load schedule + groups from FastAPI once.
  useEffect(() => {
    Promise.all([fetchGroups(), fetchSchedule()])
      .then(([g, s]) => {
        setGroups(g);
        setSchedule(s);
      })
      .catch(() =>
        setDataError(
          "Could not reach the prediction server. Make sure the FastAPI backend is running on port 8000.",
        ),
      )
      .finally(() => setDataLoading(false));
  }, []);

  const currentFixture: Fixture | null = schedule[sim.currentIndex] ?? null;
  const isComplete =
    schedule.length > 0 && sim.currentIndex >= schedule.length;
  const progress =
    schedule.length > 0 ? (sim.currentIndex / schedule.length) * 100 : 0;

  const currentMatchday = currentFixture?.matchday ?? "";
  const standings = calculateStandings(sim.completedMatches, groups);

  // Group completed matches by matchday for the "Recent" section.
  const recentMatches = sim.completedMatches.slice(-6).reverse();

  async function handleSimulateAll() {
    const remaining = schedule.slice(sim.currentIndex);
    if (remaining.length === 0 || simAllLoading) return;
    setSimAllLoading(true);
    setPredError(null);
    try {
      // Fan all predictions out in parallel — they're stateless model calls.
      const results = await Promise.allSettled(
        remaining.map((f) => predictMatch(f.home_team, f.away_team)),
      );
      const newMatches: CompletedMatch[] = [];
      results.forEach((r, i) => {
        if (r.status === "fulfilled") {
          newMatches.push({
            fixture: remaining[i],
            home_score: r.value.home_score,
            away_score: r.value.away_score,
            expected_goals_home: r.value.expected_goals_home,
            expected_goals_away: r.value.expected_goals_away,
          });
        }
      });
      setSim((prev) => ({
        completedMatches: [...prev.completedMatches, ...newMatches],
        currentIndex: prev.currentIndex + newMatches.length,
      }));
      setPrediction(null);
    } catch (e) {
      setPredError(e instanceof Error ? e.message : "Simulation failed.");
    } finally {
      setSimAllLoading(false);
    }
  }

  async function handlePredict() {
    if (!currentFixture || predLoading) return;
    setPredLoading(true);
    setPredError(null);
    try {
      setPrediction(await predictMatch(currentFixture.home_team, currentFixture.away_team));
    } catch (e) {
      setPredError(e instanceof Error ? e.message : "Prediction failed.");
    } finally {
      setPredLoading(false);
    }
  }

  function handleNext() {
    if (!prediction || !currentFixture) return;
    const match: CompletedMatch = {
      fixture: currentFixture,
      home_score: prediction.home_score,
      away_score: prediction.away_score,
      expected_goals_home: prediction.expected_goals_home,
      expected_goals_away: prediction.expected_goals_away,
    };
    setSim((prev) => ({
      completedMatches: [...prev.completedMatches, match],
      currentIndex: prev.currentIndex + 1,
    }));
    setPrediction(null);
    setPredError(null);
  }

  function handleResetClick() {
    if (!confirmReset) {
      setConfirmReset(true);
      // Auto-cancel confirmation after 4 s.
      resetTimerRef.current = setTimeout(() => setConfirmReset(false), 4000);
      return;
    }
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    setConfirmReset(false);
    setSim(INITIAL_STATE);
    setPrediction(null);
    setPredError(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  if (dataLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-400">
        Loading schedule…
      </div>
    );
  }

  if (dataError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
        <p className="font-semibold text-red-700">Server unreachable</p>
        <p className="mt-1 text-sm text-red-500">{dataError}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Page header ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Group Stage Simulation
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isComplete
              ? "All 72 group-stage matches simulated."
              : `Match ${sim.currentIndex + 1} of ${schedule.length} · Matchday ${currentMatchday}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isComplete && (
            <button
              onClick={handleSimulateAll}
              disabled={simAllLoading || isComplete}
              className="mt-1 rounded-lg bg-pitch-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-pitch-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            >
              {simAllLoading ? "Simulating…" : "Simulate All"}
            </button>
          )}
          <button
            onClick={handleResetClick}
            disabled={simAllLoading}
            className={`mt-1 rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-40 ${
              confirmReset
                ? "bg-red-100 text-red-600 hover:bg-red-200"
                : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            }`}
          >
            {confirmReset ? "Tap again to reset" : "Reset"}
          </button>
        </div>
      </div>

      {/* ── Progress bar ────────────────────────────────────────── */}
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-pitch-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* ── Current match predictor ──────────────────────────────── */}
      {isComplete ? (
        <div className="rounded-2xl border border-pitch-100 bg-pitch-50 px-8 py-12 text-center">
          <div className="text-4xl">🏆</div>
          <p className="mt-3 text-xl font-bold text-pitch-700">
            Group Stage Complete!
          </p>
          <p className="mt-1 text-sm text-slate-500">
            All 72 matches have been simulated. Check the final standings below.
          </p>
          <button
            onClick={handleResetClick}
            className="mt-6 rounded-xl border border-pitch-200 px-5 py-2.5 text-sm font-semibold text-pitch-700 transition hover:bg-pitch-100"
          >
            Simulate Again
          </button>
        </div>
      ) : currentFixture ? (
        <div className="mx-auto max-w-2xl">
          <MatchCard
            fixture={currentFixture}
            prediction={prediction}
            loading={predLoading}
            error={predError}
            onPredict={handlePredict}
            onNext={handleNext}
          />

          {/* Up next preview */}
          {schedule[sim.currentIndex + 1] && (
            <UpNext fixtures={schedule.slice(sim.currentIndex + 1, sim.currentIndex + 4)} />
          )}
        </div>
      ) : null}

      {/* ── Recent results strip ─────────────────────────────────── */}
      {recentMatches.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Recent Results
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {recentMatches.map((m, i) => (
              <RecentResult key={i} match={m} />
            ))}
          </div>
        </section>
      )}

      {/* ── Group standings ──────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Group Standings
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Object.keys(groups)
            .sort()
            .map((group) => (
              <GroupTable
                key={group}
                group={group}
                teams={standings[group] ?? []}
              />
            ))}
        </div>
      </section>

      {/* ── Knockout bracket — unlocks after all 72 group matches ── */}
      {isComplete && (
        <div className="border-t border-slate-200 pt-8">
          <KnockoutBracket standings={standings} />
        </div>
      )}
    </div>
  );
}

function UpNext({ fixtures }: { fixtures: Fixture[] }) {
  return (
    <div className="mt-3 space-y-1.5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        Coming up
      </p>
      {fixtures.map((f, i) => (
        <div
          key={i}
          className="flex items-center justify-between rounded-xl border border-slate-100 bg-white/60 px-4 py-2.5 text-sm"
        >
          <span className="flex items-center gap-2 text-slate-500">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-slate-100 text-[10px] font-bold text-slate-500">
              {f.group}
            </span>
            <span>{f.date} · MD{f.matchday}</span>
          </span>
          <span className="font-medium text-slate-700">
            {f.home_team}{" "}
            <span className="text-slate-300">vs</span> {f.away_team}
          </span>
        </div>
      ))}
    </div>
  );
}

function RecentResult({ match }: { match: CompletedMatch }) {
  const { fixture: f, home_score, away_score } = match;
  const homeWon = home_score > away_score;
  const awayWon = away_score > home_score;

  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-4 py-3 text-sm shadow-sm">
      <span className={`flex-1 truncate text-right font-medium ${homeWon ? "text-pitch-700" : "text-slate-500"}`}>
        {f.home_team}
      </span>
      <span className="mx-3 shrink-0 rounded-lg bg-slate-50 px-3 py-1 text-center text-base font-bold tabular-nums text-slate-800">
        {home_score} – {away_score}
      </span>
      <span className={`flex-1 truncate text-left font-medium ${awayWon ? "text-pitch-700" : "text-slate-500"}`}>
        {f.away_team}
      </span>
    </div>
  );
}

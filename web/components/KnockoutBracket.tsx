"use client";

import { useEffect, useMemo, useState } from "react";

import { predictMatch } from "@/lib/api";
import type { Prediction, TeamStats } from "@/lib/types";
import {
  decideShootout,
  isPlaceholder,
  useBracket,
  type KnockoutStage,
  type MatchNode,
  type Slot,
} from "@/hooks/useBracket";

const BRACKET_FLOW: KnockoutStage[] = [
  "Round of 32",
  "Round of 16",
  "Quarter-final",
  "Semi-final",
  "Final",
];

const SIMULATION_ORDER: KnockoutStage[] = [
  "Round of 32",
  "Round of 16",
  "Quarter-final",
  "Semi-final",
  "Third-place",
  "Final",
];

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function stageIsReady(matches: MatchNode[], stage: KnockoutStage): boolean {
  return matches.some(
    (m) =>
      m.stage === stage &&
      m.homeScore === null &&
      !isPlaceholder(m.homeTeam) &&
      !isPlaceholder(m.awayTeam),
  );
}

export default function KnockoutBracket({
  standings,
}: {
  standings: Record<string, TeamStats[]>;
}) {
  const {
    matches,
    isSimulating,
    simulationError,
    advanceWinner,
    simulateRound,
    populateFromStandings,
    resetBracket,
  } = useBracket();

  // Populate R32 from standings on mount (and if standings ever update).
  useEffect(() => {
    if (Object.keys(standings).length > 0) {
      populateFromStandings(standings);
    }
  }, [standings, populateFromStandings]);

  const byStage = useMemo(() => {
    const map = new Map<KnockoutStage, MatchNode[]>();
    for (const m of matches) {
      const list = map.get(m.stage) ?? [];
      list.push(m);
      map.set(m.stage, list);
    }
    return map;
  }, [matches]);

  const thirdPlace = byStage.get("Third-place")?.[0] ?? null;
  const playedCount = matches.filter((m) => m.homeScore !== null).length;

  // ── Match-by-match state ────────────────────────────────────────────────
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [predLoading, setPredLoading] = useState(false);
  const [predError, setPredError] = useState<string | null>(null);

  const selectedMatch = useMemo(
    () => matches.find((m) => m.matchId === selectedId) ?? null,
    [matches, selectedId],
  );

  function selectMatch(matchId: number) {
    setSelectedId(matchId);
    setPrediction(null);
    setPredError(null);
  }

  function clearSelection() {
    setSelectedId(null);
    setPrediction(null);
    setPredError(null);
  }

  async function handlePredict() {
    if (!selectedMatch || predLoading) return;
    setPredLoading(true);
    setPredError(null);
    try {
      const result = await predictMatch(selectedMatch.homeTeam, selectedMatch.awayTeam);
      setPrediction(result);
    } catch (e) {
      setPredError(e instanceof Error ? e.message : "Prediction failed.");
    } finally {
      setPredLoading(false);
    }
  }

  function handleConfirm() {
    if (!prediction || !selectedMatch) return;
    let shootout: Slot | undefined;
    if (prediction.home_score === prediction.away_score) {
      shootout = decideShootout(prediction);
    }
    advanceWinner(
      selectedMatch.matchId,
      prediction.home_score,
      prediction.away_score,
      shootout,
    );
    clearSelection();
  }

  // ── Simulate all ────────────────────────────────────────────────────────
  async function handleSimulateAll() {
    clearSelection();
    for (const stage of SIMULATION_ORDER) {
      await simulateRound(stage);
    }
  }

  return (
    <section className="space-y-6">
      {/* ── Controls ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Knockout Stage
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {playedCount} of {matches.length} matches simulated · 2026 World Cup
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSimulateAll}
            disabled={isSimulating}
            className="rounded-xl bg-pitch-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-pitch-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            {isSimulating ? "Simulating…" : "Simulate All Rounds"}
          </button>
          <button
            onClick={() => { resetBracket(); clearSelection(); populateFromStandings(standings); }}
            disabled={isSimulating}
            className="rounded-xl px-3 py-2 text-xs font-medium text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
          >
            Reset
          </button>
        </div>
      </div>

      {simulationError && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {simulationError}
        </p>
      )}

      {/* ── Match predictor panel ─────────────────────────────────── */}
      {selectedMatch && (
        <MatchPredictorPanel
          match={selectedMatch}
          prediction={prediction}
          loading={predLoading}
          error={predError}
          onPredict={handlePredict}
          onConfirm={handleConfirm}
          onDismiss={clearSelection}
        />
      )}

      {/* ── Bracket columns ──────────────────────────────────────── */}
      <div className="overflow-x-auto pb-4">
        <div className="flex min-w-max gap-5">
          {BRACKET_FLOW.map((stage) => (
            <RoundColumn
              key={stage}
              stage={stage}
              matches={byStage.get(stage) ?? []}
              ready={stageIsReady(matches, stage)}
              busy={isSimulating}
              selectedId={selectedId}
              onSelectMatch={selectMatch}
              onSimulate={() => simulateRound(stage)}
            />
          ))}
        </div>
      </div>

      {/* ── Third-place play-off ─────────────────────────────────── */}
      {thirdPlace && (
        <div className="max-w-sm space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Third-place Play-off
          </h3>
          <BracketMatch
            match={thirdPlace}
            selected={selectedId === thirdPlace.matchId}
            onClick={
              !isPlaceholder(thirdPlace.homeTeam) &&
              !isPlaceholder(thirdPlace.awayTeam) &&
              thirdPlace.homeScore === null
                ? () => selectMatch(thirdPlace.matchId)
                : undefined
            }
          />
        </div>
      )}
    </section>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function RoundColumn({
  stage,
  matches,
  ready,
  busy,
  selectedId,
  onSelectMatch,
  onSimulate,
}: {
  stage: KnockoutStage;
  matches: MatchNode[];
  ready: boolean;
  busy: boolean;
  selectedId: number | null;
  onSelectMatch: (id: number) => void;
  onSimulate: () => void;
}) {
  return (
    <div className="flex w-64 flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {stage}
        </span>
        <button
          onClick={onSimulate}
          disabled={!ready || busy}
          className="rounded-md px-2 py-1 text-[11px] font-semibold text-pitch-600 transition hover:bg-pitch-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
        >
          Simulate Round
        </button>
      </div>
      <div className="flex flex-1 flex-col justify-around gap-3">
        {matches.map((m) => {
          const clickable =
            !isPlaceholder(m.homeTeam) &&
            !isPlaceholder(m.awayTeam) &&
            m.homeScore === null;
          return (
            <BracketMatch
              key={m.matchId}
              match={m}
              selected={selectedId === m.matchId}
              onClick={clickable ? () => onSelectMatch(m.matchId) : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}

function BracketMatch({
  match,
  selected,
  onClick,
}: {
  match: MatchNode;
  selected: boolean;
  onClick?: () => void;
}) {
  const decided = match.homeScore !== null && match.awayScore !== null;
  const homeWon =
    decided &&
    (match.homeScore! > match.awayScore! || match.shootoutWinner === "home");
  const awayWon =
    decided &&
    (match.awayScore! > match.homeScore! || match.shootoutWinner === "away");

  return (
    <div
      onClick={onClick}
      className={[
        "rounded-xl border bg-white shadow-card transition-all",
        onClick ? "cursor-pointer hover:border-pitch-300 hover:shadow-md" : "",
        selected ? "border-pitch-400 ring-1 ring-pitch-300" : "border-slate-200",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-1.5 text-[10px] text-slate-400">
        <span className="font-medium text-slate-500">M{match.matchId}</span>
        <span className="truncate">
          {formatDate(match.date)} · {match.stadium.split(",")[0]}
        </span>
        {onClick && (
          <span className="ml-1 shrink-0 rounded bg-pitch-50 px-1 py-0.5 text-[9px] font-semibold text-pitch-600">
            Predict
          </span>
        )}
      </div>
      <div className="divide-y divide-slate-50">
        <TeamRow name={match.homeTeam} score={match.homeScore} won={homeWon} pens={match.shootoutWinner === "home"} />
        <TeamRow name={match.awayTeam} score={match.awayScore} won={awayWon} pens={match.shootoutWinner === "away"} />
      </div>
    </div>
  );
}

function TeamRow({
  name,
  score,
  won,
  pens,
}: {
  name: string;
  score: number | null;
  won: boolean;
  pens: boolean;
}) {
  const placeholder = isPlaceholder(name);
  return (
    <div className={`flex items-center gap-2 px-3 py-2 ${won ? "bg-pitch-50/60" : ""}`}>
      <div className={`h-4 w-1 flex-shrink-0 rounded-full ${won ? "bg-pitch-400" : "bg-slate-100"}`} />
      <span
        className={`flex-1 truncate text-sm ${
          placeholder
            ? "italic text-slate-300"
            : won
              ? "font-semibold text-slate-900"
              : "text-slate-500"
        }`}
      >
        {name}
      </span>
      {pens && (
        <span className="text-[9px] font-semibold uppercase text-pitch-500">pens</span>
      )}
      <span className={`w-5 text-right text-sm font-bold tabular-nums ${won ? "text-pitch-700" : "text-slate-400"}`}>
        {score ?? "–"}
      </span>
    </div>
  );
}

function MatchPredictorPanel({
  match,
  prediction,
  loading,
  error,
  onPredict,
  onConfirm,
  onDismiss,
}: {
  match: MatchNode;
  prediction: Prediction | null;
  loading: boolean;
  error: string | null;
  onPredict: () => void;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  const shootoutWinner =
    prediction && prediction.home_score === prediction.away_score
      ? decideShootout(prediction)
      : null;

  const homeWins = prediction
    ? prediction.home_score > prediction.away_score || shootoutWinner === "home"
    : false;
  const awayWins = prediction
    ? prediction.away_score > prediction.home_score || shootoutWinner === "away"
    : false;

  const homeShare =
    prediction && prediction.total_predicted_goals > 0
      ? (prediction.expected_goals_home / prediction.total_predicted_goals) * 100
      : 50;

  return (
    <div className="rounded-2xl border border-pitch-200 bg-white p-6 shadow-card">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-pitch-600 px-2.5 py-1 text-xs font-bold text-white">
            {match.stage}
          </span>
          <span className="text-xs text-slate-400">
            Match {match.matchId} · {formatDate(match.date)} · {match.stadium}
          </span>
        </div>
        <button
          onClick={onDismiss}
          className="text-slate-300 transition hover:text-slate-500"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {/* Score display */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <div className="text-right">
          <p className={`text-xl font-bold leading-tight sm:text-2xl ${homeWins ? "text-slate-900" : "text-slate-500"}`}>
            {match.homeTeam}
          </p>
          <p className="mt-1 text-xs text-slate-400">Home</p>
        </div>

        <div className="text-center">
          {!prediction ? (
            <span className="text-3xl font-bold text-slate-200">vs</span>
          ) : (
            <>
              <div className="text-4xl font-bold tabular-nums text-slate-900 sm:text-5xl">
                {prediction.home_score}
                <span className="mx-1.5 text-slate-200">–</span>
                {prediction.away_score}
              </div>
              {shootoutWinner && (
                <div className="mt-1 text-xs font-semibold text-pitch-600">
                  {shootoutWinner === "home" ? match.homeTeam : match.awayTeam} win on penalties
                </div>
              )}
              {!shootoutWinner && (
                <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-pitch-600">
                  {homeWins ? `${match.homeTeam} win` : `${match.awayTeam} win`}
                </div>
              )}
            </>
          )}
        </div>

        <div className="text-left">
          <p className={`text-xl font-bold leading-tight sm:text-2xl ${awayWins ? "text-slate-900" : "text-slate-500"}`}>
            {match.awayTeam}
          </p>
          <p className="mt-1 text-xs text-slate-400">Away</p>
        </div>
      </div>

      {/* xG bar */}
      {prediction && (
        <div className="mt-6">
          <div className="mb-1.5 flex justify-between text-xs text-slate-400">
            <span>xG {prediction.expected_goals_home.toFixed(2)}</span>
            <span>xG {prediction.expected_goals_away.toFixed(2)}</span>
          </div>
          <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="bg-pitch-500 transition-all duration-500"
              style={{ width: `${homeShare}%` }}
            />
            <div className="flex-1 bg-slate-300" />
          </div>
          <div className="mt-3 flex justify-center gap-6 text-xs text-slate-400">
            <span>
              Total xG:{" "}
              <strong className="text-slate-600">
                {prediction.total_predicted_goals.toFixed(2)}
              </strong>
            </span>
            <span>
              Rating gap:{" "}
              <strong className="text-slate-600">
                {prediction.rating_gap > 0 ? "+" : ""}
                {prediction.rating_gap.toFixed(2)}
              </strong>
            </span>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* Actions */}
      <div className="mt-6 flex gap-3">
        {!prediction ? (
          <button
            onClick={onPredict}
            disabled={loading}
            className="flex-1 rounded-xl bg-pitch-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-pitch-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            {loading ? "Simulating…" : "Predict Match"}
          </button>
        ) : (
          <>
            <button
              onClick={onPredict}
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-500 transition hover:bg-slate-50"
            >
              Re-roll
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 rounded-xl bg-pitch-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-pitch-700"
            >
              Confirm & Advance →
            </button>
          </>
        )}
      </div>
    </div>
  );
}

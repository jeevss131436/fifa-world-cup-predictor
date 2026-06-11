"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchGroups,
  predictMatch,
  type Groups,
  type Prediction,
} from "@/lib/api";

export default function Home() {
  const [groups, setGroups] = useState<Groups>({});
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [result, setResult] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the group -> teams map once for both dropdowns.
  useEffect(() => {
    fetchGroups()
      .then(setGroups)
      .catch(() => setError("Could not reach the prediction server."));
  }, []);

  const sameTeam = homeTeam !== "" && homeTeam === awayTeam;
  const canPredict = homeTeam !== "" && awayTeam !== "" && !sameTeam && !loading;

  async function onPredict() {
    if (!canPredict) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await predictMatch(homeTeam, awayTeam));
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : "Prediction failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          Single Match Predictor
        </h1>
        <p className="text-slate-500">
          Pick two nations from the group stage and let the model call the
          scoreline.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card sm:p-8">
        <div className="grid items-end gap-4 sm:grid-cols-[1fr_auto_1fr]">
          <TeamSelect
            label="Home"
            value={homeTeam}
            groups={groups}
            disabledTeam={awayTeam}
            onChange={setHomeTeam}
          />

          <div className="hidden pb-3 text-center text-sm font-semibold uppercase tracking-wide text-slate-400 sm:block">
            vs
          </div>

          <TeamSelect
            label="Away"
            value={awayTeam}
            groups={groups}
            disabledTeam={homeTeam}
            onChange={setAwayTeam}
          />
        </div>

        {sameTeam && (
          <p className="mt-3 text-sm text-amber-600">
            Choose two different teams.
          </p>
        )}

        <button
          onClick={onPredict}
          disabled={!canPredict}
          className="mt-6 w-full rounded-xl bg-pitch-600 px-5 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-pitch-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          {loading ? "Simulating…" : "Predict Match"}
        </button>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}
      </section>

      {result && <ResultCard result={result} />}
    </div>
  );
}

function TeamSelect({
  label,
  value,
  groups,
  disabledTeam,
  onChange,
}: {
  label: string;
  value: string;
  groups: Groups;
  disabledTeam: string;
  onChange: (team: string) => void;
}) {
  const groupLetters = useMemo(() => Object.keys(groups).sort(), [groups]);

  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-600">
        {label}
      </span>
      <select
        className="select-field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select a team…</option>
        {groupLetters.map((letter) => (
          <optgroup key={letter} label={`Group ${letter}`}>
            {groups[letter].map((team) => (
              <option key={team} value={team} disabled={team === disabledTeam}>
                {team}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

function ResultCard({ result }: { result: Prediction }) {
  const homeShare =
    result.total_predicted_goals > 0
      ? (result.expected_goals_home / result.total_predicted_goals) * 100
      : 50;

  const verdict =
    result.home_score > result.away_score
      ? `${result.home_team} win`
      : result.away_score > result.home_score
        ? `${result.away_team} win`
        : "Draw";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card sm:p-8">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <TeamColumn name={result.home_team} align="text-right" />
        <div className="text-center">
          <div className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            {result.home_score}
            <span className="mx-2 text-slate-300">–</span>
            {result.away_score}
          </div>
          <div className="mt-1 text-xs font-medium uppercase tracking-wide text-pitch-600">
            {verdict}
          </div>
        </div>
        <TeamColumn name={result.away_team} align="text-left" />
      </div>

      {/* Expected-goals split bar */}
      <div className="mt-6">
        <div className="flex justify-between text-xs font-medium text-slate-500">
          <span>xG {result.expected_goals_home.toFixed(2)}</span>
          <span>xG {result.expected_goals_away.toFixed(2)}</span>
        </div>
        <div className="mt-1.5 flex h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="bg-pitch-500"
            style={{ width: `${homeShare}%` }}
            aria-hidden
          />
          <div className="flex-1 bg-slate-300" aria-hidden />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 text-center sm:grid-cols-2">
        <Stat label="Total goals" value={result.total_predicted_goals.toFixed(2)} />
        <Stat label="Rating gap" value={result.rating_gap.toFixed(2)} />
      </div>
    </section>
  );
}

function TeamColumn({ name, align }: { name: string; align: string }) {
  return (
    <div className={align}>
      <p className="text-lg font-semibold text-slate-900">{name}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3">
      <p className="text-xl font-semibold text-slate-900">{value}</p>
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
    </div>
  );
}

import type { Fixture } from "@/lib/types";
import type { Prediction } from "@/lib/types";

type Props = {
  fixture: Fixture;
  prediction: Prediction | null;
  loading: boolean;
  error: string | null;
  onPredict: () => void;
  onNext: () => void;
};

export default function MatchCard({
  fixture,
  prediction,
  loading,
  error,
  onPredict,
  onNext,
}: Props) {
  const homeShare =
    prediction && prediction.total_predicted_goals > 0
      ? (prediction.expected_goals_home / prediction.total_predicted_goals) * 100
      : 50;

  const verdict = prediction
    ? prediction.home_score > prediction.away_score
      ? `${fixture.home_team} win`
      : prediction.away_score > prediction.home_score
        ? `${fixture.away_team} win`
        : "Draw"
    : null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card sm:p-8">
      {/* Fixture metadata */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-pitch-600 text-xs font-bold text-white">
          {fixture.group}
        </span>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
          Matchday {fixture.matchday}
        </span>
        <span className="text-xs text-slate-400">
          {fixture.date} · {fixture.time_est} EST
        </span>
        <span className="ml-auto text-right text-xs text-slate-400">
          {fixture.stadium}, {fixture.city}
        </span>
      </div>

      {/* Scoreline / vs */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <div className="text-right">
          <p className="text-xl font-bold leading-tight text-slate-900 sm:text-2xl">
            {fixture.home_team}
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
              <div className="mt-1.5 text-xs font-semibold uppercase tracking-wide text-pitch-600">
                {verdict}
              </div>
            </>
          )}
        </div>

        <div className="text-left">
          <p className="text-xl font-bold leading-tight text-slate-900 sm:text-2xl">
            {fixture.away_team}
          </p>
          <p className="mt-1 text-xs text-slate-400">Away</p>
        </div>
      </div>

      {/* xG bar — visible only after prediction */}
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
      <div className="mt-6">
        {!prediction ? (
          <button
            onClick={onPredict}
            disabled={loading}
            className="w-full rounded-xl bg-pitch-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-pitch-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            {loading ? "Simulating…" : "Predict Match"}
          </button>
        ) : (
          <button
            onClick={onNext}
            className="w-full rounded-xl bg-pitch-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-pitch-700"
          >
            Next Match →
          </button>
        )}
      </div>
    </div>
  );
}

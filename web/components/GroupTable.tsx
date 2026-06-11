import type { TeamStats } from "@/lib/standings";

export default function GroupTable({
  group,
  teams,
}: {
  group: string;
  teams: TeamStats[];
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-pitch-600 text-xs font-bold text-white">
          {group}
        </span>
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
          Group {group}
        </span>
        <span className="ml-auto text-[10px] text-slate-400">top 2 advance</span>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-100 text-slate-400">
            <th className="w-full px-3 py-2 text-left font-medium">Team</th>
            <th className="px-1.5 py-2 font-medium">P</th>
            <th className="px-1.5 py-2 font-medium">W</th>
            <th className="px-1.5 py-2 font-medium">D</th>
            <th className="px-1.5 py-2 font-medium">L</th>
            <th className="px-1.5 py-2 font-medium">GF</th>
            <th className="px-1.5 py-2 font-medium">GA</th>
            <th className="px-1.5 py-2 font-medium">GD</th>
            <th className="px-1.5 py-2 font-bold text-pitch-600">Pts</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((t, i) => {
            const advancing = i < 2;
            return (
              <tr
                key={t.team}
                className={`border-b border-slate-50 last:border-0 transition-colors ${
                  advancing ? "bg-pitch-50/50" : ""
                }`}
              >
                <td className="flex items-center gap-2 px-3 py-2.5">
                  <div
                    className={`h-4 w-1 flex-shrink-0 rounded-full ${
                      advancing ? "bg-pitch-400" : "bg-slate-100"
                    }`}
                  />
                  <span
                    className={`truncate font-medium ${
                      advancing ? "text-slate-800" : "text-slate-500"
                    }`}
                  >
                    {t.team}
                  </span>
                </td>
                <td className="px-1.5 py-2.5 text-center text-slate-500">
                  {t.played}
                </td>
                <td className="px-1.5 py-2.5 text-center text-slate-500">
                  {t.won}
                </td>
                <td className="px-1.5 py-2.5 text-center text-slate-500">
                  {t.drawn}
                </td>
                <td className="px-1.5 py-2.5 text-center text-slate-500">
                  {t.lost}
                </td>
                <td className="px-1.5 py-2.5 text-center text-slate-500">
                  {t.gf}
                </td>
                <td className="px-1.5 py-2.5 text-center text-slate-500">
                  {t.ga}
                </td>
                <td className="px-1.5 py-2.5 text-center text-slate-500">
                  {t.gd > 0 ? `+${t.gd}` : t.gd}
                </td>
                <td className="px-1.5 py-2.5 text-center font-bold text-pitch-700">
                  {t.points}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageShell } from "@/components/xbet/PageShell";
import { teamQuery } from "@/lib/sports-queries";
import type { Sport } from "@/lib/sports-types";

export const Route = createFileRoute("/team/$sport/$teamId")({
  head: () => ({
    meta: [
      { title: "Team Profile & Full Squad — BET PLUS+" },
      {
        name: "description",
        content:
          "Team profile with the complete squad list: shirt numbers, positions, ages, appearances, goals, assists and cards.",
      },
      { property: "og:title", content: "Team Profile & Full Squad — BET PLUS+" },
      {
        property: "og:description",
        content: "Squad list and player statistics from the live sports data feed.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
  const { sport, teamId } = Route.useParams();
  const s = (["football", "basketball", "tennis"].includes(sport) ? sport : "football") as Sport;
  const team = useQuery(teamQuery(s, Number(teamId)));
  const t = team.data?.[0];

  return (
    <PageShell title={t?.name ?? "Team"} subtitle={t?.coach ? `Coach: ${t.coach}` : "Squad list"}>
      <div className="overflow-hidden rounded-xl bg-xb-panel shadow-sm">
        {team.isLoading && (
          <div className="px-3 py-6 text-[13px] text-xb-text-muted">Loading squad…</div>
        )}
        {!team.isLoading && !t && (
          <div className="px-3 py-6 text-[13px] text-xb-text-muted">
            No profile published for this team.
          </div>
        )}
        {t && (
          <>
            <div className="flex items-center gap-3 border-b border-xb-line px-3 py-3">
              {t.logo ? (
                <img src={t.logo} alt={t.name} className="h-12 w-12 object-contain" />
              ) : (
                <span className="h-12 w-12 rounded-full bg-xb-odds" />
              )}
              <div className="min-w-0">
                <h2 className="truncate text-[15px] font-bold text-xb-text">{t.name}</h2>
                <p className="text-[12px] text-xb-text-muted">{t.players.length} players</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-xb-odds text-left text-xb-text-muted">
                    <th className="px-2 py-2">#</th>
                    <th className="px-2 py-2">Player</th>
                    <th className="px-2 py-2">Pos</th>
                    <th className="px-2 py-2">Age</th>
                    <th className="px-2 py-2">Apps</th>
                    <th className="px-2 py-2">G</th>
                    <th className="px-2 py-2">A</th>
                    <th className="px-2 py-2">Y/R</th>
                  </tr>
                </thead>
                <tbody>
                  {t.players.map((p, i) => (
                    <tr key={`${p.key}-${i}`} className="border-b border-xb-line">
                      <td className="px-2 py-2 text-xb-text-muted">{p.number}</td>
                      <td className="px-2 py-2 font-medium text-xb-text">{p.name}</td>
                      <td className="px-2 py-2">{p.position}</td>
                      <td className="px-2 py-2">{p.age}</td>
                      <td className="px-2 py-2">{p.matches}</td>
                      <td className="px-2 py-2">{p.goals}</td>
                      <td className="px-2 py-2">{p.assists}</td>
                      <td className="px-2 py-2">
                        {p.yellow}/{p.red}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
}

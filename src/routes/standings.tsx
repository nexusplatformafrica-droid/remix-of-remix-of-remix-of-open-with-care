import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageShell } from "@/components/xbet/PageShell";
import { LeaguePicker } from "@/components/xbet/LeaguePicker";
import { standingsQuery, seasonsQuery } from "@/lib/sports-queries";
import type { Sport } from "@/lib/sports-types";

type S = { sport: Sport; league: number };

export const Route = createFileRoute("/standings")({
  validateSearch: (search: Record<string, unknown>): Partial<S> => {
    const out: Partial<S> = {};
    const sp = search["sport"];
    if (sp === "football" || sp === "basketball" || sp === "tennis") out.sport = sp;
    if (Number(search["league"]) > 0) out.league = Number(search["league"]);
    return out;
  },
  head: () => ({
    meta: [
      { title: "Live League Standings & Tables — BET PLUS+" },
      {
        name: "description",
        content:
          "League tables for football, basketball and tennis competitions: points, wins, draws, losses and goal difference updated from the live data feed.",
      },
      { property: "og:title", content: "Live League Standings & Tables — BET PLUS+" },
      {
        property: "og:description",
        content: "Up-to-date standings for every competition covered by BET PLUS+.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/standings" }],
  }),
  component: StandingsPage,
});

function StandingsPage() {
  const { sport = "football", league = 0 } = Route.useSearch();
  const navigate = useNavigate({ from: "/standings" });
  const rows = useQuery(standingsQuery(sport, league));
  const seasons = useQuery(seasonsQuery(sport, league));

  return (
    <PageShell title="Standings" subtitle="Official league tables from the live sports feed">
      <div className="grid gap-2 md:grid-cols-[320px_minmax(0,1fr)]">
        <LeaguePicker
          sport={sport}
          leagueKey={league}
          onSport={(s) => navigate({ search: { sport: s } })}
          onLeague={(key) => navigate({ search: { sport, league: key } })}
        />

        <div className="overflow-hidden rounded-xl bg-xb-panel shadow-sm">
          {!league && (
            <div className="px-3 py-6 text-[13px] text-xb-text-muted">
              Pick a competition to load its table.
            </div>
          )}
          {league > 0 && rows.isLoading && (
            <div className="px-3 py-6 text-[13px] text-xb-text-muted">Loading table…</div>
          )}
          {league > 0 && !rows.isLoading && (rows.data?.length ?? 0) === 0 && (
            <div className="px-3 py-6 text-[13px] text-xb-text-muted">
              No standings published for this competition.
            </div>
          )}
          {(rows.data?.length ?? 0) > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-xb-odds text-left text-xb-text-muted">
                    <th className="px-2 py-2">#</th>
                    <th className="px-2 py-2">Team</th>
                    <th className="px-2 py-2">P</th>
                    <th className="px-2 py-2">W</th>
                    <th className="px-2 py-2">D</th>
                    <th className="px-2 py-2">L</th>
                    <th className="px-2 py-2">F</th>
                    <th className="px-2 py-2">A</th>
                    <th className="px-2 py-2 font-bold">PTS</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.data?.map((r) => (
                    <tr key={`${r.place}-${r.teamKey}`} className="border-b border-xb-line">
                      <td className="px-2 py-2 text-xb-text-muted">{r.place}</td>
                      <td className="px-2 py-2 font-medium text-xb-text">
                        {r.teamKey ? (
                          <Link
                            to="/team/$sport/$teamId"
                            params={{ sport, teamId: String(r.teamKey) }}
                            className="hover:underline"
                          >
                            {r.team}
                          </Link>
                        ) : (
                          r.team
                        )}
                      </td>
                      <td className="px-2 py-2">{r.played}</td>
                      <td className="px-2 py-2">{r.win}</td>
                      <td className="px-2 py-2">{r.draw}</td>
                      <td className="px-2 py-2">{r.loss}</td>
                      <td className="px-2 py-2">{r.goalsFor}</td>
                      <td className="px-2 py-2">{r.goalsAgainst}</td>
                      <td className="px-2 py-2 font-bold text-xb-text">{r.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {(seasons.data?.length ?? 0) > 0 && (
            <div className="border-t border-xb-line px-3 py-2 text-[11px] text-xb-text-muted">
              Seasons covered: {seasons.data?.map((s) => s.name || s.key).join(", ")}
            </div>
          )}

          {league > 0 && (
            <div className="flex gap-3 border-t border-xb-line px-3 py-2 text-[12px] font-bold text-xb-blue">
              <Link to="/topscorers" search={{ sport, league }} className="hover:underline">
                Top scorers
              </Link>
              <Link to="/teams" search={{ sport, league }} className="hover:underline">
                Teams
              </Link>
              <Link to="/" search={{ sport, league }} className="hover:underline">
                Odds &amp; fixtures
              </Link>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}

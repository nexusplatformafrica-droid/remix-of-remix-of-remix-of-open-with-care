import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageShell } from "@/components/xbet/PageShell";
import { LeaguePicker } from "@/components/xbet/LeaguePicker";
import { topScorersQuery } from "@/lib/sports-queries";
import type { Sport } from "@/lib/sports-types";

type S = { sport: Sport; league: number };

export const Route = createFileRoute("/topscorers")({
  validateSearch: (search: Record<string, unknown>): Partial<S> => {
    const out: Partial<S> = {};
    const sp = search["sport"];
    if (sp === "football" || sp === "basketball" || sp === "tennis") out.sport = sp;
    if (Number(search["league"]) > 0) out.league = Number(search["league"]);
    return out;
  },
  head: () => ({
    meta: [
      { title: "Top Scorers & Assists By Competition — BET PLUS+" },
      {
        name: "description",
        content:
          "Golden boot races for every league: goals and assists per player, straight from the live sports data feed.",
      },
      { property: "og:title", content: "Top Scorers & Assists By Competition — BET PLUS+" },
      {
        property: "og:description",
        content: "See who leads the scoring charts in any competition covered by BET PLUS+.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/topscorers" }],
  }),
  component: TopScorersPage,
});

function TopScorersPage() {
  const { sport = "football", league = 0 } = Route.useSearch();
  const navigate = useNavigate({ from: "/topscorers" });
  const rows = useQuery(topScorersQuery(sport, league));

  return (
    <PageShell title="Top scorers" subtitle="Goals and assists leaders per competition">
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
              Pick a competition to load its scoring charts.
            </div>
          )}
          {league > 0 && rows.isLoading && (
            <div className="px-3 py-6 text-[13px] text-xb-text-muted">Loading scorers…</div>
          )}
          {league > 0 && !rows.isLoading && (rows.data?.length ?? 0) === 0 && (
            <div className="px-3 py-6 text-[13px] text-xb-text-muted">
              No scorer data published for this competition.
            </div>
          )}
          {rows.data?.map((s, i) => (
            <div
              key={`${s.playerKey}-${i}`}
              className="flex items-center gap-2 border-b border-xb-line px-3 py-2"
            >
              <span className="w-6 text-[12px] text-xb-text-muted">{s.place || i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-xb-text">
                {s.player}
              </span>
              <span className="hidden min-w-0 max-w-[40%] truncate text-[12px] text-xb-text-muted sm:block">
                {s.teamKey ? (
                  <Link
                    to="/team/$sport/$teamId"
                    params={{ sport, teamId: String(s.teamKey) }}
                    className="hover:underline"
                  >
                    {s.team}
                  </Link>
                ) : (
                  s.team
                )}
              </span>
              <span className="w-10 text-right text-[13px] font-bold text-xb-text">{s.goals}</span>
              <span className="w-10 text-right text-[12px] text-xb-text-muted">{s.assists}a</span>
            </div>
          ))}

          {league > 0 && (
            <div className="flex gap-3 px-3 py-2 text-[12px] font-bold text-xb-blue">
              <Link to="/standings" search={{ sport, league }} className="hover:underline">
                Standings
              </Link>
              <Link to="/teams" search={{ sport, league }} className="hover:underline">
                Teams
              </Link>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageShell } from "@/components/xbet/PageShell";
import { LeaguePicker } from "@/components/xbet/LeaguePicker";
import { teamsQuery } from "@/lib/sports-queries";
import type { Sport } from "@/lib/sports-types";

type S = { sport: Sport; league: number };

export const Route = createFileRoute("/teams")({
  validateSearch: (search: Record<string, unknown>): Partial<S> => {
    const out: Partial<S> = {};
    const sp = search["sport"];
    if (sp === "football" || sp === "basketball" || sp === "tennis") out.sport = sp;
    if (Number(search["league"]) > 0) out.league = Number(search["league"]);
    return out;
  },
  head: () => ({
    meta: [
      { title: "Teams & Squads By Competition — BET PLUS+" },
      {
        name: "description",
        content:
          "Browse every club in a competition, open a team page and see the full squad with numbers, positions, goals and cards.",
      },
      { property: "og:title", content: "Teams & Squads By Competition — BET PLUS+" },
      {
        property: "og:description",
        content: "Club directory and squad lists powered by the live sports data feed.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/teams" }],
  }),
  component: TeamsPage,
});

function TeamsPage() {
  const { sport = "football", league = 0 } = Route.useSearch();
  const navigate = useNavigate({ from: "/teams" });
  const teams = useQuery(teamsQuery(sport, league));

  return (
    <PageShell title="Teams" subtitle="Clubs and squads for every competition">
      <div className="grid gap-2 md:grid-cols-[320px_minmax(0,1fr)]">
        <LeaguePicker
          sport={sport}
          leagueKey={league}
          onSport={(s) => navigate({ search: { sport: s } })}
          onLeague={(key) => navigate({ search: { sport, league: key } })}
        />

        <div className="rounded-xl bg-xb-panel p-2 shadow-sm">
          {!league && (
            <div className="px-1 py-6 text-[13px] text-xb-text-muted">
              Pick a competition to list its teams.
            </div>
          )}
          {league > 0 && teams.isLoading && (
            <div className="px-1 py-6 text-[13px] text-xb-text-muted">Loading teams…</div>
          )}
          {league > 0 && !teams.isLoading && (teams.data?.length ?? 0) === 0 && (
            <div className="px-1 py-6 text-[13px] text-xb-text-muted">
              No team data published for this competition.
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {teams.data?.map((t) => (
              <Link
                key={t.key}
                to="/team/$sport/$teamId"
                params={{ sport, teamId: String(t.key) }}
                className="flex flex-col items-center gap-2 rounded-lg bg-xb-odds p-3 text-center transition-colors hover:bg-xb-odds-hover"
              >
                {t.logo ? (
                  <img src={t.logo} alt={t.name} loading="lazy" className="h-10 w-10 object-contain" />
                ) : (
                  <span className="h-10 w-10 rounded-full bg-xb-panel" />
                )}
                <span className="line-clamp-2 text-[12px] font-medium text-xb-text">{t.name}</span>
                <span className="text-[11px] text-xb-text-muted">{t.players.length} players</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </PageShell>
  );
}

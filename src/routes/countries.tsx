import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Search } from "lucide-react";
import { PageShell } from "@/components/xbet/PageShell";
import { leagueActivityQuery, leaguesQuery, type LeagueActivity } from "@/lib/sports-queries";
import { SPORTS, SPORT_LABELS, type Sport } from "@/lib/sports-types";

export const Route = createFileRoute("/countries")({
  head: () => ({
    meta: [
      { title: "Countries & Leagues With Matches — BET PLUS+" },
      {
        name: "description",
        content:
          "Browse every country and competition that has matches right now: football, basketball and tennis fixtures with live odds on BET PLUS+.",
      },
      { property: "og:title", content: "Countries & Leagues With Matches — BET PLUS+" },
      {
        property: "og:description",
        content:
          "Every active country and league with upcoming fixtures and live odds, sorted by how many matches are on.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/countries" }],
  }),
  component: CountriesPage,
});

type CountryGroup = {
  country: string;
  countryKey: number;
  countryLogo: string | null;
  leagues: LeagueActivity[];
  matches: number;
};

function CountryCard({ group, sport }: { group: CountryGroup; sport: Sport }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl bg-xb-panel shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-xb-odds"
      >
        {group.countryLogo ? (
          <img src={group.countryLogo} alt="" className="h-5 w-5 rounded-full object-contain" />
        ) : (
          <span className="h-5 w-5 rounded-full bg-xb-odds-hover" />
        )}
        <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-xb-text">
          {group.country || "International"}
        </span>
        <span className="shrink-0 text-[11px] text-xb-text-muted">
          {group.leagues.length} leagues · {group.matches} matches
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-xb-text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="bg-xb-panel-alt">
          {group.leagues.map((l) => (
            <Link
              key={l.leagueKey}
              to="/"
              search={{ sport, league: l.leagueKey }}
              className="flex items-center gap-2 border-t border-xb-line px-4 py-2 text-[12px] text-xb-text-muted hover:text-xb-blue"
            >
              {l.leagueLogo ? (
                <img
                  src={l.leagueLogo}
                  alt=""
                  className="h-4 w-4 shrink-0 rounded-full object-contain"
                />
              ) : (
                <span className="h-4 w-4 shrink-0 rounded-full bg-xb-odds-hover" />
              )}
              <span className="truncate">{l.league}</span>
              <span className="ml-auto shrink-0 text-[11px]">{l.matches}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function CountriesPage() {
  const [sport, setSport] = useState<Sport>("football");
  const [search, setSearch] = useState("");
  const activity = useQuery(leagueActivityQuery(sport, "upcoming"));
  const leagues = useQuery(leaguesQuery(sport));

  const groups = useMemo<CountryGroup[]>(() => {
    const q = search.trim().toLowerCase();
    const counts = new Map((activity.data ?? []).map((a) => [a.leagueKey, a]));

    // The full provider catalogue is listed; the activity feed only adds match
    // counts, so no country or competition is ever hidden.
    const source: LeagueActivity[] = (leagues.data ?? []).map((l) => {
      const a = counts.get(l.key);
      return {
        leagueKey: l.key,
        league: l.name,
        leagueLogo: l.logo,
        country: l.country,
        countryKey: l.countryKey,
        countryLogo: l.countryLogo,
        matches: a?.matches ?? 0,
        live: a?.live ?? 0,
        sport,
      };
    });
    const known = new Set(source.map((l) => l.leagueKey));
    for (const a of activity.data ?? []) if (!known.has(a.leagueKey)) source.push(a);

    const map = new Map<string, CountryGroup>();
    for (const l of source) {
      if (q && !`${l.country} ${l.league}`.toLowerCase().includes(q)) continue;
      const key = l.country || "International";
      const g =
        map.get(key) ??
        ({
          country: key,
          countryKey: l.countryKey,
          countryLogo: l.countryLogo,
          leagues: [],
          matches: 0,
        } satisfies CountryGroup);
      g.leagues.push(l);
      g.matches += l.matches;
      map.set(key, g);
    }
    for (const g of map.values())
      g.leagues.sort((a, b) => b.matches - a.matches || a.league.localeCompare(b.league));
    return [...map.values()].sort((a, b) => b.matches - a.matches || a.country.localeCompare(b.country));
  }, [activity.data, leagues.data, search, sport]);

  return (
    <PageShell
      title="Countries & leagues"
      subtitle="Every country and competition available from our sports feed."
    >

      <div className="mb-2 flex flex-wrap items-center gap-2">
        {SPORTS.map((s) => (
          <button
            key={s}
            onClick={() => setSport(s)}
            className={`rounded-lg px-3 py-1.5 text-[12px] font-bold transition-colors ${
              sport === s
                ? "bg-xb-blue text-xb-on-dark"
                : "bg-xb-panel text-xb-text-muted hover:text-xb-text"
            }`}
          >
            {SPORT_LABELS[s]}
          </button>
        ))}
        <div className="ml-auto flex min-w-[200px] items-center gap-2 rounded-lg bg-xb-panel px-3 py-1.5">
          <Search className="h-3.5 w-3.5 text-xb-blue" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search country or league"
            className="w-full bg-transparent text-[12px] text-xb-text outline-none placeholder:text-xb-text-muted"
          />
        </div>
      </div>

      {activity.isPending && (
        <p className="px-1 py-6 text-[12px] text-xb-text-muted">Loading competitions…</p>
      )}
      {!activity.isPending && groups.length === 0 && (
        <p className="px-1 py-6 text-[12px] text-xb-text-muted">
          No {SPORT_LABELS[sport].toLowerCase()} competitions have matches right now.
        </p>
      )}

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => (
          <CountryCard key={g.country} group={g} sport={sport} />
        ))}
      </div>
    </PageShell>
  );
}

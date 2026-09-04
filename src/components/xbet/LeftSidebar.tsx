import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Star,
  Trophy,
  Globe,
  Search,
} from "lucide-react";
import { useBetSlip } from "./BetSlipContext";
import { useSportFilters } from "./SportFilterContext";
import { LiveEventSkeleton, LeagueListSkeleton } from "./Skeletons";
import {
  leaguesQuery,
  liveCountsQuery,
  matchesQuery,
  leagueActivityQuery,
  type League,
} from "@/lib/sports-queries";
import { SPORTS, SPORT_LABELS, type Sport } from "@/lib/sports-types";
import { useFavorites } from "@/lib/favorites";


function CountryGroup({
  country,
  leagues,
  activeLeague,
  counts,
  onPick,
}: {
  country: string;
  leagues: League[];
  activeLeague: number | null;
  counts: Map<number, number>;
  onPick: (l: League) => void;
}) {

  const [open, setOpen] = useState(false);
  const first = leagues[0];
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between border-b border-xb-line px-3 py-2 text-left text-[13px] text-xb-text transition-colors hover:bg-xb-odds"
      >
        <span className="flex items-center gap-2 truncate">
          {first?.countryLogo ? (
            <img src={first.countryLogo} alt="" className="h-4 w-4 rounded-full object-contain" />
          ) : (
            <span className="h-4 w-4 rounded-full bg-xb-odds-hover" />
          )}
          <span className="truncate">
            {country || "International"} ({leagues.length})
          </span>
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-xb-text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="bg-xb-panel-alt">
          {leagues.map((l) => (
            <button
              key={l.key}
              onClick={() => onPick(l)}
              className={`flex w-full items-center gap-2 border-b border-xb-line px-4 py-1.5 text-left text-[12px] hover:text-xb-blue ${
                activeLeague === l.key ? "text-xb-blue" : "text-xb-text-muted"
              }`}
            >
              {l.logo ? (
                <img src={l.logo} alt="" className="h-4 w-4 shrink-0 rounded-full object-contain" />
              ) : (
                <span className="h-4 w-4 shrink-0 rounded-full bg-xb-odds-hover" />
              )}
              <span className="truncate">{l.name}</span>
              <span className="ml-auto shrink-0 text-[10px] text-xb-text-muted">
                {counts.get(l.key) ?? 0}
              </span>
            </button>

          ))}

        </div>
      )}
    </div>
  );
}

export function LeftSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [favOpen, setFavOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [game, setGame] = useState(0);
  const { toggle, has } = useBetSlip();
  const { sport, setSport, scope, setScope, leagueId, setLeague } = useSportFilters();
  const { favorites, isFavorite, toggleFavorite, removeFavorite } = useFavorites();

  const leagues = useQuery(leaguesQuery(sport));
  const counts = useQuery(liveCountsQuery());
  const top = useQuery(matchesQuery({ sport, scope: "live" }));
  const activity = useQuery(leagueActivityQuery(sport, scope));

  // Match counts per league for the current scope. Only competitions that
  // actually have fixtures are listed.
  const matchCounts = useMemo(() => {
    const m = new Map<number, number>();
    for (const a of activity.data ?? []) m.set(a.leagueKey, a.matches);
    return m;
  }, [activity.data]);

  const byCountry = useMemo(() => {
    const q = search.trim().toLowerCase();
    const map = new Map<string, League[]>();

    // Every country and competition the provider offers is listed, with the
    // activity feed only supplying the match counts and the ordering. Leagues
    // seen in the feed but missing from the catalogue are added too.
    const source: League[] = [...(leagues.data ?? [])];
    const known = new Set(source.map((l) => l.key));
    for (const a of activity.data ?? []) {
      if (known.has(a.leagueKey)) continue;
      known.add(a.leagueKey);
      source.push({
        key: a.leagueKey,
        name: a.league,
        country: a.country,
        countryKey: a.countryKey,
        logo: a.leagueLogo,
        countryLogo: a.countryLogo,
        sport: a.sport,
      });
    }

    for (const l of source) {
      if (q && !`${l.country} ${l.name}`.toLowerCase().includes(q)) continue;
      const list = map.get(l.country) ?? [];
      list.push(l);
      map.set(l.country, list);
    }
    for (const list of map.values())
      list.sort(
        (a, b) =>
          (matchCounts.get(b.key) ?? 0) - (matchCounts.get(a.key) ?? 0) ||
          a.name.localeCompare(b.name),
      );
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [leagues.data, activity.data, matchCounts, search]);



  const liveList = top.data ?? [];
  const g = liveList[game % Math.max(liveList.length, 1)];

  if (collapsed) {
    return (
      <aside className="w-[40px] shrink-0 font-xb">
        <button
          onClick={() => setCollapsed(false)}
          aria-label="Expand block"
          className="flex h-8 w-full items-center justify-center rounded-lg bg-xb-panel-alt text-xb-text-muted"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="h-full w-[262px] shrink-0 overflow-y-auto pb-4 font-xb">

      <button
        onClick={() => setCollapsed(true)}
        className="flex h-8 w-full items-center justify-center gap-1 rounded-lg bg-xb-panel-alt text-[12px] text-xb-text-muted transition-colors hover:bg-xb-odds-hover"
      >
        <ChevronLeft className="h-3 w-3" /> Collapse block
      </button>

      <div className="mt-2 overflow-hidden rounded-xl bg-xb-panel shadow-sm">
        <button
          onClick={() => setFavOpen((o) => !o)}
          className="flex w-full items-center justify-between bg-xb-odds px-3 py-2.5 text-[13px] font-medium text-xb-text transition-colors hover:bg-xb-odds-hover"
        >
          <span className="flex items-center gap-2">
            <Star className="h-4 w-4 fill-xb-blue text-xb-blue" /> Favorite matches
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${favOpen ? "rotate-180" : ""}`}
          />
        </button>
        {favOpen && (
          <div className="text-[12px]">
            {favorites.length === 0 && (
              <p className="px-3 py-2 text-xb-text-muted">You have no favorite matches yet.</p>
            )}
            {favorites.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-2 border-b border-xb-line px-3 py-1.5"
              >
                <Link
                  to="/match/$matchId"
                  params={{ matchId: f.id }}
                  search={{ sport: f.sport }}
                  className="min-w-0 flex-1"
                >
                  <span className="block truncate text-xb-text hover:text-xb-blue">
                    {f.home} — {f.away}
                  </span>
                  <span className="block truncate text-[10px] text-xb-text-muted">
                    {[f.country, f.league].filter(Boolean).join(". ")}
                  </span>
                </Link>
                <button
                  aria-label="Remove favorite"
                  onClick={() => removeFavorite(f.id)}
                  className="shrink-0 text-xb-text-muted hover:text-xb-blue"
                >
                  <Star className="h-3.5 w-3.5 fill-xb-blue text-xb-blue" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-0.5 flex items-center justify-between bg-xb-odds-hover px-3 py-2.5 text-[13px] font-medium text-xb-text">
          <span className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-xb-blue" /> Live now
          </span>
          {liveList.length > 0 && (
            <span className="flex items-center gap-1 text-[12px] text-xb-text-muted">
              <button
                aria-label="Previous game"
                onClick={() => setGame((p) => (p - 1 + liveList.length) % liveList.length)}
              >
                <ChevronLeft className="h-3 w-3 hover:text-xb-blue" />
              </button>
              {(game % liveList.length) + 1}/{liveList.length}
              <button
                aria-label="Next game"
                onClick={() => setGame((p) => (p + 1) % liveList.length)}
              >
                <ChevronRight className="h-3 w-3 hover:text-xb-blue" />
              </button>
            </span>
          )}
        </div>

        {top.isPending && <LiveEventSkeleton />}


        {!top.isPending && !g && (
          <div className="px-3 py-4 text-[12px] text-xb-text-muted">
            No live {SPORT_LABELS[sport].toLowerCase()} events right now.
          </div>
        )}

        {g && (
          <>
            <div className="border-b border-xb-line px-3 py-2 text-[12px]">
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5 truncate text-xb-text">
                  <span className="h-3 w-3 shrink-0 rounded-full bg-xb-blue-light" />
                  <span className="truncate">
                    {g.country}. {g.league}
                  </span>
                </span>
                <button
                  aria-label="Add to favorites"
                  onClick={() =>
                    toggleFavorite({
                      id: g.id,
                      sport: g.sport,
                      home: g.home,
                      away: g.away,
                      league: g.league,
                      country: g.country,
                      date: g.date,
                      time: g.time,
                    })
                  }
                  className="shrink-0 text-xb-text-muted hover:text-xb-blue"
                >
                  <Star
                    className={`h-3.5 w-3.5 ${isFavorite(g.id) ? "fill-xb-blue text-xb-blue" : ""}`}
                  />
                </button>
              </div>
              <Link
                to="/match/$matchId"
                params={{ matchId: g.id }}
                search={{ sport: g.sport }}
                className="block"
              >
                <div className="mt-1 text-[11px] text-xb-blue">{g.status || "Live"}</div>
                <div className="mt-1 flex justify-between text-xb-text">
                  <span className="truncate">{g.home}</span>
                  <span>{g.homeScore ?? "-"}</span>
                </div>
                <div className="flex justify-between text-xb-text">
                  <span className="truncate">{g.away}</span>
                  <span>{g.awayScore ?? "-"}</span>
                </div>
                <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-xb-blue hover:underline">
                  Detailed score <ChevronRight className="h-3 w-3" />
                </span>
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-px bg-xb-line">
              {(
                [
                  ["W1", g.odds.home],
                  ["X", g.odds.draw],
                  ["W2", g.odds.away],
                ] as const
              ).map(([k, v]) => {
                const id = `${g.id}-side-${k}`;
                return (
                  <button
                    key={k}
                    disabled={!v}
                    onClick={() =>
                      v &&
                      toggle({
                        id,
                        matchId: g.id,
                        event: `${g.home} — ${g.away}`,
                        market: k,
                        odd: v,
                        sport: g.sport,
                        league: `${g.country ?? ""} ${g.league ?? ""}`.trim(),
                        kickoff: g.kickoff,
                      })
                    }
                    className={`flex items-center justify-between px-2 py-2 text-[12px] transition-colors ${
                      has(id) ? "bg-xb-blue text-xb-on-dark" : "bg-xb-panel hover:bg-xb-odds"
                    } ${!v ? "cursor-not-allowed opacity-50" : ""}`}
                  >
                    <span className={has(id) ? "text-xb-on-dark/80" : "text-xb-text-muted"}>
                      {k}
                    </span>
                    <span className="font-medium">{v ? v.toFixed(2) : "—"}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="mt-2 grid grid-cols-2 overflow-hidden rounded-t-xl bg-xb-panel">
        {(["live", "today"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setScope(t)}
            className={`border-b-2 py-2.5 text-[13px] font-bold uppercase transition-colors ${
              scope === t
                ? "border-xb-blue bg-xb-odds text-xb-text"
                : "border-transparent text-xb-text-muted hover:text-xb-text"
            }`}
          >
            {t === "live" ? "◉ LIVE" : "SPORTS"}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-b-xl bg-xb-panel shadow-sm">
        <div className="flex items-center justify-between border-b border-xb-line px-3 py-2 text-[12px] font-bold text-xb-blue">
          <span>{byCountry.reduce((n, [, l]) => n + l.length, 0)} leagues</span>
          <Link to="/countries" className="flex items-center gap-1 hover:underline">
            All countries <Globe className="h-4 w-4 text-xb-text-muted" />
          </Link>
        </div>

        <div className="bg-xb-odds px-3 py-2 text-[13px] font-medium text-xb-text">Sports</div>
        {SPORTS.map((s: Sport) => (
          <button
            key={s}
            onClick={() => setSport(s)}
            className={`flex w-full items-center justify-between border-b border-xb-line px-3 py-2 text-left text-[13px] transition-colors hover:bg-xb-odds ${
              sport === s ? "bg-xb-odds text-xb-blue" : "text-xb-text"
            }`}
          >
            <span>{SPORT_LABELS[s]}</span>
            <span className="text-[11px] text-xb-text-muted">{counts.data?.[s] ?? 0} live</span>
          </button>
        ))}

        <div className="flex items-center gap-2 bg-xb-odds px-3 py-2">
          <Search className="h-3.5 w-3.5 text-xb-blue" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search country or league"
            className="w-full bg-transparent text-[12px] text-xb-text outline-none placeholder:text-xb-text-muted"
          />
        </div>

        <button
          onClick={() => setLeague(null)}
          className={`block w-full border-b border-xb-line px-3 py-2 text-left text-[12px] ${
            leagueId === null ? "text-xb-blue" : "text-xb-text-muted hover:text-xb-blue"
          }`}
        >
          All leagues
        </button>

        {leagues.isPending && <LeagueListSkeleton />}

        <div>

          {byCountry.map(([country, list]) => (
            <CountryGroup
              key={country || "intl"}
              country={country}
              leagues={list}
              activeLeague={leagueId}
              counts={matchCounts}
              onPick={(l) => setLeague(l.key, l.countryKey || null)}
            />
          ))}
        </div>
      </div>
    </aside>
  );
}

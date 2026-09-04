import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Search, Star, BarChart3, RefreshCw, ArrowUp, ArrowDown, Zap, Lock, ChevronRight, Home, Trophy } from "lucide-react";
import { SportIcon, SportGlyph } from "./SportIcon";

import { useBetSlip } from "./BetSlipContext";
import { useSportFilters } from "./SportFilterContext";
import { MatchesListSkeleton } from "./Skeletons";
import { useOddsFlash, oddsFlashClass } from "@/lib/use-odds-flash";

import {
  matchesQuery,
  leaguesQuery,
  matchOddsQuery,
  matchSearchQuery,
  type Match,
} from "@/lib/sports-queries";
import { leagueRank } from "@/lib/popular";
import { LeagueFilterBar, CountryFilterStrip } from "./LeagueFilterBar";
import blueBanner from "@/assets/blue-banner.jpg";
import { SPORTS, SPORT_LABELS, type MatchScope } from "@/lib/sports-types";
import { ugDateKey, ugDateLabel, ugTime } from "@/lib/time";
import { useFavorites } from "@/lib/favorites";
import { outcomeLocked, lockReason } from "@/lib/live-lock";

const tabs: { key: MatchScope; label: string }[] = [
  { key: "live", label: "Live" },
  { key: "today", label: "Today" },
  { key: "upcoming", label: "Upcoming" },
  
  { key: "boosted", label: "Boosted" },
  { key: "topbets", label: "Top Bets" },
];

function OddsScroller({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [canNext, setCanNext] = useState(false);

  const update = () => {
    const el = ref.current;
    if (!el) return;
    setCanNext(el.scrollWidth - el.clientWidth - el.scrollLeft > 4);
  };

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="relative -mx-2 w-[calc(100%+1rem)] md:mx-0 md:ml-auto md:w-auto">
      <div
        ref={ref}
        onScroll={update}
        className="xb-noscroll flex w-full gap-1 overflow-x-auto px-2 md:w-auto md:overflow-visible md:px-0"
      >
        {children}
      </div>
      {canNext && (
        <button
          type="button"
          aria-label="Show more odds"
          onClick={() => ref.current?.scrollBy({ left: 140, behavior: "smooth" })}
          className="absolute right-1 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full bg-xb-panel-alt/90 text-xb-text shadow ring-1 ring-xb-line md:hidden"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function OddsButton({

  match,
  label,
  shortLabel,
  value,
}: {
  match: Match;
  label: string;
  shortLabel?: string;
  value: number | null;
}) {
  const { toggle, has } = useBetSlip();
  const flash = useOddsFlash(value);
  const id = `${match.id}-${label}`;
  // From the 80th minute only the outcome the score has already settled (the
  // leading team, or the draw when level) is locked — everything else stays open.
  const lateLocked = outcomeLocked(match, label, label);
  if (!value || lateLocked) {
    return (
      <span
        title={lateLocked ? lockReason(match) : "Market not available"}
        aria-label={lateLocked ? "Betting closed" : "Odd not available"}
        className="flex w-[74px] shrink-0 flex-col items-center justify-center rounded-md bg-xb-odds py-1.5 text-xb-text-muted opacity-70 md:w-[74px] md:py-2.5"
      >
        <span className="text-[10px] font-medium md:hidden">{shortLabel ?? label}</span>
        <Lock className="h-3.5 w-3.5" />
      </span>
    );
  }
  return (
    <button
      onClick={() =>
        toggle({
          id,
          matchId: match.id,
          event: `${match.home} — ${match.away}`,
          market: label,
          odd: value,
          sport: match.sport,
          league: `${match.country ?? ""} ${match.league ?? ""}`.trim(),
          kickoff: match.kickoff,
        })
      }
      className={`w-[74px] shrink-0 rounded-md px-1 py-1.5 text-center transition-colors md:py-2.5 ${
        has(id) ? "bg-xb-blue text-xb-on-dark" : "bg-xb-odds text-xb-text hover:bg-xb-odds-hover"
      } ${oddsFlashClass(flash)}`}
    >
      <span
        className={`block truncate text-[10px] font-medium leading-tight md:hidden ${
          has(id) ? "text-xb-on-dark/80" : "text-xb-text-muted"
        }`}
      >
        {shortLabel ?? label}
      </span>
      <span className="inline-flex items-center gap-0.5 text-[13px] font-bold leading-tight">
        {value.toFixed(2)}
        {flash === "up" && <ArrowUp className="h-3 w-3" />}
        {flash === "down" && <ArrowDown className="h-3 w-3" />}
      </span>
    </button>
  );
}


export function MatchesPanel() {
  const { sport, setSport, scope, setScope, leagueIds, countryIds, clearFilters } =
    useSportFilters();
  const [query, setQuery] = useState("");
  // Real toggle: off = main result market only, on = every market column.
  const [allMarkets, setAllMarkets] = useState(true);
  const { isFavorite, toggleFavorite } = useFavorites();

  const matches = useQuery(matchesQuery({ sport, scope, leagueIds, countryIds }));
  const leagues = useQuery(leaguesQuery(sport));

  const activeLabels = useMemo(() => {
    const all = leagues.data ?? [];
    const names = leagueIds
      .map((id) => all.find((l) => l.key === id))
      .filter(Boolean)
      .map((l) => `${l!.country} · ${l!.name}`);
    const countries = countryIds
      .map((id) => all.find((l) => l.countryKey === id)?.country)
      .filter(Boolean) as string[];
    return [...names, ...[...new Set(countries)]];
  }, [leagues.data, leagueIds, countryIds]);

  const isFootball = sport === "football";
  const showExtra = isFootball && allMarkets;
  const marketCols = showExtra
    ? ["1", "X", "2", "Over 2.5", "Under 2.5", "GG", "NG"]
    : isFootball
      ? ["1", "X", "2"]
      : ["1", "2"];


  const filtered = leagueIds.length > 0 || countryIds.length > 0;

  // Typed search hits the provider directly (teams, players, leagues, countries),
  // so results are not limited to the rows already on screen.
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);
  const searching = debounced.length >= 2;
  const search = useQuery(matchSearchQuery(sport, debounced));

  // A new selection must never show the previous one's rows: while the fresh
  // list loads we render the match skeleton instead of stale data.
  const showSkeleton = searching
    ? search.isPending && !search.data
    : matches.isPending || (matches.isFetching && !matches.data);

  const baseList = useMemo(() => {
    // Every fixture the provider returns is listed, for every country and
    // league. Markets that have no price simply render as locked buttons, so a
    // missing odds feed no longer hides whole competitions.
    const list = matches.data ?? [];
    if (!searching) return list;
    const q = debounced.toLowerCase();
    const local = list.filter((m) =>
      `${m.home} ${m.away} ${m.league} ${m.country ?? ""}`.toLowerCase().includes(q),
    );
    // Local hits first, then everything else the provider knows about.
    return [...new Map([...local, ...(search.data ?? [])].map((m) => [m.id, m])).values()];
  }, [matches.data, search.data, searching, debounced]);

  // Upcoming / Top Bets group by day; big leagues first, then start time.
  const byTime = scope === "upcoming" || scope === "topbets";

  const sortedAll = useMemo(() => {
    const rank = (m: Match) => leagueRank(m.sport, m.league ?? "", m.country ?? "");
    return byTime
      ? [...baseList].sort((a, b) => rank(a) - rank(b) || a.kickoff.localeCompare(b.kickoff))
      : [...baseList].sort((a, b) => rank(a) - rank(b) || a.kickoff.localeCompare(b.kickoff));
  }, [baseList, byTime]);

  // Pagination: render a page at a time and load more as the user scrolls.
  const PAGE = 60;
  const [limit, setLimit] = useState(PAGE);
  useEffect(() => {
    setLimit(PAGE);
  }, [sport, scope, leagueIds.join(","), countryIds.join(","), debounced]);
  const pageList = useMemo(() => sortedAll.slice(0, limit), [sortedAll, limit]);
  const hasMore = sortedAll.length > pageList.length;

  const sentinel = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting))
          setLimit((n) => Math.min(n + PAGE, sortedAll.length));
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, sortedAll.length]);

  // Hydrate every rendered fixture from both Odds and FullOdds. A bulk row can
  // report a non-zero market count while still missing its main 1/X/2 prices.
  const oddsChunks = useMemo(() => {
    const ids = pageList.map((m) => m.id);
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += 60) chunks.push(ids.slice(i, i + 60));
    return chunks;
  }, [pageList]);

  const oddsResults = useQueries({
    queries: oddsChunks.map((ids) => matchOddsQuery(sport, ids)),
  });

  const visible = useMemo(() => {
    const byId = new Map<string, { odds: Match["odds"]; marketCount: number }>();
    for (const r of oddsResults)
      for (const p of r.data ?? []) byId.set(p.id, { odds: p.odds, marketCount: p.marketCount });
    if (byId.size === 0) return pageList;
    return pageList.map((m) => {
      const p = byId.get(m.id);
      if (!p) return m;
      // Never trade a priced row for an empty one: the row may already be
      // showing derived prices for a fixture the provider does not price.
      if (p.odds.home === null && p.odds.away === null) return m;
      return { ...m, odds: p.odds, marketCount: Math.max(p.marketCount, m.marketCount) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageList, oddsResults.map((r) => r.dataUpdatedAt).join(",")]);

  const grouped = useMemo(() => {
    const map = new Map<string, Match[]>();
    const rank = (m: Match) => leagueRank(m.sport, m.league ?? "", m.country ?? "");
    for (const m of visible) {
      const key = byTime ? ugDateKey(m.date, m.time) : m.league;
      const list = map.get(key) ?? [];
      list.push(m);
      map.set(key, list);
    }
    for (const list of map.values())
      list.sort((a, b) => rank(a) - rank(b) || a.kickoff.localeCompare(b.kickoff));
    return [...map.entries()];
  }, [visible, byTime]);



  return (
    <div className="mt-2 overflow-hidden rounded-xl bg-xb-panel font-xb shadow-sm">
      {/* Top bar — breadcrumb, scope tabs and search, 1xBet-style deep blue */}
      <div
        className="xb-noscroll flex items-center gap-4 overflow-x-auto bg-xb-bar bg-cover bg-center px-3 py-1.5 text-xb-on-dark"
        style={{ backgroundImage: `linear-gradient(color-mix(in oklab, var(--xb-bar) 82%, transparent), color-mix(in oklab, var(--xb-bar) 82%, transparent)), url(${blueBanner})` }}
      >
        <div className="hidden shrink-0 items-center gap-1 text-xb-on-dark-muted md:flex">
          <Home className="h-3.5 w-3.5" />
          <ChevronRight className="h-3 w-3 opacity-60" />
          <SportGlyph sport={sport} className="h-3.5 w-3.5" />
          <ChevronRight className="h-3 w-3 opacity-60" />
          <Trophy className="h-3.5 w-3.5" />
        </div>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setScope(t.key)}
            className={`relative flex shrink-0 items-center gap-1 py-1.5 text-[13px] transition-colors ${
              scope === t.key
                ? "font-bold text-xb-on-dark"
                : "text-xb-on-dark-muted hover:text-xb-on-dark"
            }`}
          >
            {t.key === "boosted" && <Zap className="h-3.5 w-3.5 text-xb-bar-accent" />}
            {t.label}
            {scope === t.key && (
              <span className="absolute inset-x-0 -bottom-0.5 h-0.5 rounded-full bg-xb-bar-accent" />
            )}
          </button>
        ))}
        <span className="mx-1 h-5 w-px shrink-0 bg-xb-bar-line" />
        <button
          onClick={() => matches.refetch()}
          aria-label="Refresh"
          className="flex shrink-0 items-center gap-1 text-xb-on-dark-muted hover:text-xb-on-dark"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${matches.isFetching ? "animate-spin" : ""}`} />
          {matches.isFetching && <span className="text-[11px]">Updating…</span>}
        </button>
        <div className="ml-auto hidden shrink-0 items-center gap-2 rounded-md bg-xb-bar-field px-3 py-1 md:flex">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search any match, team or league"
            className="w-40 bg-transparent text-[12px] text-xb-on-dark outline-none placeholder:text-xb-on-dark-muted"
          />
          <Search className="h-3.5 w-3.5 text-xb-on-dark-muted" />
        </div>
      </div>

      {/* Sports row — darker blue strip with icons */}
      <div className="xb-noscroll flex items-center gap-1 overflow-x-auto bg-xb-bar-alt px-3 text-xb-on-dark">
        <button
          type="button"
          role="switch"
          aria-checked={allMarkets}
          onClick={() => setAllMarkets((v) => !v)}
          className="mr-2 hidden shrink-0 items-center gap-2 py-2 md:flex"
        >
          <span
            className={`flex h-4 w-8 items-center rounded-full px-0.5 transition-colors ${
              allMarkets ? "bg-xb-bar-accent" : "bg-xb-bar-line"
            }`}
          >
            <span
              className={`h-3 w-3 rounded-full bg-xb-on-dark transition-transform ${
                allMarkets ? "translate-x-4" : ""
              }`}
            />
          </span>
          <span
            className={`whitespace-nowrap text-[12px] font-bold ${
              allMarkets ? "text-xb-on-dark" : "text-xb-on-dark-muted"
            }`}
          >
            All markets
          </span>
        </button>
        <span className="mr-2 hidden h-5 w-px shrink-0 bg-xb-bar-line md:block" />
        {SPORTS.map((s) => (
          <button
            key={s}
            onClick={() => setSport(s)}
            className={`flex shrink-0 items-center gap-1.5 px-2.5 py-2 text-[12.5px] font-bold transition-colors ${
              sport === s
                ? "text-xb-on-dark"
                : "text-xb-on-dark-muted hover:text-xb-on-dark"
            }`}
          >
            <SportGlyph sport={s} className="h-4 w-4" />
            {SPORT_LABELS[s]}
          </button>
        ))}
        <span className="mx-2 hidden h-5 w-px shrink-0 bg-xb-bar-line md:block" />
        <CountryFilterStrip />
        <div className="ml-2 hidden shrink-0 items-center gap-2 py-2 text-[12px] md:flex">
          {activeLabels.length > 0 ? (
            <button
              onClick={clearFilters}
              className="rounded-full bg-xb-bar-line px-2 py-1 font-medium text-xb-on-dark"
            >
              {activeLabels.slice(0, 2).join(", ")}
              {activeLabels.length > 2 ? ` +${activeLabels.length - 2}` : ""} ✕
            </button>
          ) : (
            <span className="text-xb-on-dark-muted">All leagues</span>
          )}
        </div>
      </div>

      <LeagueFilterBar />

      {showSkeleton && filtered && (
        <div className="border-b border-xb-line bg-xb-blue/10 px-3 py-2 text-[12px] font-bold text-xb-blue">
          Loading matches for your selected filters…
        </div>
      )}



      {scope === "boosted" && (
        <div className="flex items-center gap-2 bg-xb-green/10 px-3 py-2 text-[12px] text-xb-text">
          <Zap className="h-3.5 w-3.5 text-xb-green" />
          <span>
            <span className="font-bold">Boosted</span> — today's fixtures from the top leagues our AI
            rates as the biggest games to bet on.
          </span>
        </div>
      )}

      {scope === "topbets" && (
        <div className="flex items-center gap-2 bg-xb-blue/10 px-3 py-2 text-[12px] text-xb-text">
          <Zap className="h-3.5 w-3.5 text-xb-blue" />
          <span>
            <span className="font-bold">Top Bets</span> — Elite European Leagues, European Cups
            (Champions, Europa, Conference), South America, England EFL Cup, N. America Leagues Cup,
            Club Friendlies and Tennis.
          </span>
        </div>
      )}

      {showSkeleton && <MatchesListSkeleton groups={filtered ? 4 : 3} cols={showExtra ? 7 : isFootball ? 3 : 2} />}




      {matches.isError && (
        <div className="px-3 py-10 text-center text-[13px] text-xb-text-muted">
          Could not load matches right now.{" "}
          <button onClick={() => matches.refetch()} className="text-xb-blue underline">
            Retry
          </button>
        </div>
      )}

      {!showSkeleton && !matches.isError && visible.length === 0 && (
        <div className="px-3 py-10 text-center text-[13px] text-xb-text-muted">
          No {scope} {SPORT_LABELS[sport].toLowerCase()} events for the selected filters.
        </div>
      )}

      {!showSkeleton &&
        grouped.map(([groupKey, list]) => (
        <div key={groupKey}>
          <div className="bg-xb-odds px-3 py-2">
            <div className="flex items-center gap-2">
              {!byTime && list[0]?.leagueLogo && (
                <img src={list[0].leagueLogo} alt="" className="h-4 w-4 rounded-full object-contain" />
              )}
              <span className="text-[13px] font-bold text-xb-blue">
                {byTime ? ugDateLabel(groupKey) : `${list[0]?.country}. ${groupKey}`}
              </span>

              <div
                className={`ml-auto hidden gap-1 text-center text-[12px] text-xb-text md:grid ${
                  showExtra ? "grid-cols-7" : isFootball ? "grid-cols-3" : "grid-cols-2"
                }`}
              >
                {marketCols.map((c) => (
                  <span key={c} className="w-[74px]">
                    {c}
                  </span>
                ))}
              </div>
            </div>

          </div>


          {list.map((m) => (
            <div
              key={m.id}
              className="relative flex flex-col gap-2 border-b border-xb-line px-2 py-2.5 md:px-3 transition-colors hover:bg-xb-panel-alt md:flex-row md:items-start"
            >
              <button
                aria-label="Add to favorites"
                onClick={() =>
                  toggleFavorite({
                    id: m.id,
                    sport: m.sport,
                    home: m.home,
                    away: m.away,
                    league: m.league,
                    country: m.country,
                    date: m.date,
                    time: m.time,
                  })
                }
                className="absolute right-3 top-2.5 text-xb-text-muted md:static md:pt-1"
              >
                <Star
                  className={`h-3.5 w-3.5 ${
                    isFavorite(m.id) ? "fill-xb-blue text-xb-blue" : "hover:text-xb-blue"
                  }`}
                />
              </button>

              <div className="w-full pr-6 md:w-[330px] md:pr-0">
                <Link
                  to="/match/$matchId"
                  params={{ matchId: m.id }}
                  search={{ sport: m.sport }}
                  className="block hover:underline"
                >
                  {/* Mobile: home — vs — away on a single line */}
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-[12px] text-xb-text md:hidden">
                    <span className="flex min-w-0 items-center gap-1.5">
                      {m.homeLogo && (
                        <img src={m.homeLogo} alt="" className="h-4 w-4 shrink-0 rounded-full object-contain" />
                      )}
                      <span className="truncate font-medium">{m.home}</span>
                      {m.homeScore != null && <span className="shrink-0 font-bold">{m.homeScore}</span>}
                    </span>
                    <span className="shrink-0 text-[10px] font-bold text-xb-text-muted">vs</span>
                    <span className="flex min-w-0 items-center justify-end gap-1.5 text-right">
                      {m.awayScore != null && <span className="shrink-0 font-bold">{m.awayScore}</span>}
                      <span className="truncate font-medium">{m.away}</span>
                      {m.awayLogo && (
                        <img src={m.awayLogo} alt="" className="h-4 w-4 shrink-0 rounded-full object-contain" />
                      )}
                    </span>
                  </div>

                  <div className="hidden md:block">
                    <div className="flex items-center justify-between text-[13px] text-xb-text">
                      <span className="flex items-center gap-2">
                        {m.homeLogo && (
                          <img src={m.homeLogo} alt="" className="h-4 w-4 rounded-full object-contain" />
                        )}
                        {m.home}
                      </span>
                      <span className="font-bold">{m.homeScore ?? ""}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[13px] text-xb-text">
                      <span className="flex items-center gap-2">
                        {m.awayLogo && (
                          <img src={m.awayLogo} alt="" className="h-4 w-4 rounded-full object-contain" />
                        )}
                        {m.away}
                      </span>
                      <span className="font-bold">{m.awayScore ?? ""}</span>
                    </div>
                  </div>
                </Link>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-xb-text-muted">
                  {m.live && (
                    <span className="rounded bg-xb-green px-1.5 py-0.5 font-bold text-xb-on-dark">
                      LIVE
                    </span>
                  )}
                  <span>
                    {ugDateLabel(ugDateKey(m.date, m.time))} {ugTime(m.date, m.time)}
                  </span>
                  {byTime && m.league && (
                    <span>
                      · {m.country ? `${m.country}. ` : ""}
                      {m.league}
                    </span>
                  )}

                  {m.round && <span>· {m.round}</span>}
                  {m.status && <span>· {m.status}</span>}
                  {m.marketCount > 0 && <span>· {m.marketCount} markets</span>}
                  <Link
                    to="/match/$matchId"
                    params={{ matchId: m.id }}
                    search={{ sport: m.sport }}
                    aria-label="Match details"
                    className="text-xb-blue"
                  >
                    <BarChart3 className="h-3 w-3" />
                  </Link>
                </div>
              </div>

              <OddsScroller>
                <OddsButton match={m} label="1" value={m.odds.home} />
                {isFootball && <OddsButton match={m} label="X" value={m.odds.draw} />}
                <OddsButton match={m} label="2" value={m.odds.away} />
                {showExtra && (
                  <>
                    <OddsButton match={m} label="Over 2.5" shortLabel="OVER 2.5" value={m.odds.over} />
                    <OddsButton match={m} label="Under 2.5" shortLabel="UNDER 2.5" value={m.odds.under} />
                    <OddsButton match={m} label="Both Teams To Score - Yes" shortLabel="GG" value={m.odds.bttsYes} />
                    <OddsButton match={m} label="Both Teams To Score - No" shortLabel="NG" value={m.odds.bttsNo} />
                  </>
                )}
              </OddsScroller>

            </div>
          ))}
        </div>
        ))}

      {!showSkeleton && hasMore && (
        <div ref={sentinel} className="px-3 py-4 text-center">
          <button
            onClick={() => setLimit((n) => Math.min(n + 60, sortedAll.length))}
            className="text-[12px] font-bold text-xb-blue"
          >
            Loading more matches…
          </button>
        </div>
      )}

      <div className="flex items-center justify-between px-3 py-2 text-[11px] text-xb-text-muted">
        <span>Live data & bookmaker odds by AllSportsAPI</span>
        <span>
          Showing {visible.length} of {sortedAll.length} events
        </span>
      </div>

    </div>
  );
}

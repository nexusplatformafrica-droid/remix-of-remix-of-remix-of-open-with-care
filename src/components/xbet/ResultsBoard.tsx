import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Search, ChevronRight } from "lucide-react";
import { useSportFilters } from "./SportFilterContext";
import { MatchesListSkeleton } from "./Skeletons";
import { Panel, MatchDetailsSection, MatchHighlightsSection } from "./ResultSections";
import { matchesQuery, type Match } from "@/lib/sports-queries";
import { SPORTS, SPORT_LABELS } from "@/lib/sports-types";
import { leagueRank } from "@/lib/popular";
import { ugDateLabel, ugDateKey, ugTime } from "@/lib/time";

/** Desktop keeps the 3-column board; mobile navigates to a dedicated page. */
function isDesktop() {
  return typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;
}

export function ResultsBoard() {
  const { sport, setSport, leagueIds, countryIds } = useSportFilters();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const matches = useQuery(matchesQuery({ sport, scope: "results", leagueIds, countryIds }));

  const visible = useMemo(() => {
    const list = matches.data ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((m) => `${m.home} ${m.away} ${m.league}`.toLowerCase().includes(q));
  }, [matches.data, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, Match[]>();
    const rank = (m: Match) => leagueRank(m.sport, m.league ?? "", m.country ?? "");
    for (const m of [...visible].sort(
      (a, b) => rank(a) - rank(b) || b.kickoff.localeCompare(a.kickoff),
    )) {
      const list = map.get(m.league) ?? [];
      list.push(m);
      map.set(m.league, list);
    }
    return [...map.entries()];
  }, [visible]);

  useEffect(() => {
    if (visible.length === 0) return;
    if (!selected || !visible.some((m) => m.id === selected)) setSelected(visible[0]!.id);
  }, [visible, selected]);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-2 overflow-y-auto pb-2 lg:grid lg:grid-cols-[minmax(280px,1fr)_minmax(0,1.2fr)_minmax(0,1.2fr)] lg:grid-rows-1 lg:gap-px lg:overflow-hidden lg:pb-0">
      {/* Column 1 — results list (the only section shown on mobile) */}
      <Panel
        title="Results"
        right={
          <div className="flex items-center gap-1 rounded-full border border-xb-line px-2 py-1">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search match"
              className="w-24 bg-transparent text-[11px] text-xb-text outline-none placeholder:text-xb-text-muted"
            />
            <Search className="h-3 w-3 text-xb-blue" />
          </div>
        }
      >
        <div className="flex items-center gap-1 border-b border-xb-line px-2 py-1.5">
          {SPORTS.map((s) => (
            <button
              key={s}
              onClick={() => setSport(s)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
                sport === s ? "bg-xb-blue text-xb-on-dark" : "text-xb-text-muted hover:text-xb-text"
              }`}
            >
              {SPORT_LABELS[s]}
            </button>
          ))}
        </div>

        {matches.isPending && <MatchesListSkeleton cols={1} />}
        {!matches.isPending && visible.length === 0 && (
          <p className="px-3 py-10 text-center text-[12px] text-xb-text-muted">
            No {SPORT_LABELS[sport].toLowerCase()} results for the selected filters.
          </p>
        )}

        {grouped.map(([league, list]) => (
          <div key={league}>
            <div className="flex items-center gap-2 bg-xb-odds px-3 py-1.5 text-[11px] font-bold text-xb-blue">
              {list[0]?.leagueLogo && (
                <img src={list[0]!.leagueLogo!} alt="" className="h-3.5 w-3.5 object-contain" />
              )}
              <span className="truncate">
                {list[0]?.country}. {league}
              </span>
            </div>
            {list.map((x) => (
              <Link
                key={x.id}
                to="/result-detail/$sport/$matchId"
                params={{ sport, matchId: x.id }}
                onClick={(e) => {
                  if (isDesktop()) {
                    e.preventDefault();
                    setSelected(x.id);
                  }
                }}
                className={`flex w-full items-center gap-2 border-b border-xb-line px-3 py-2 text-left transition-colors ${
                  selected === x.id ? "lg:bg-xb-panel-alt" : "hover:bg-xb-panel-alt"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] text-xb-text">{x.home}</p>
                  <p className="truncate text-[12px] text-xb-text">{x.away}</p>
                  <p className="mt-0.5 text-[10px] text-xb-text-muted">
                    {ugDateLabel(ugDateKey(x.date, x.time))} {ugTime(x.date, x.time)}
                    {x.status ? ` · ${x.status}` : ""}
                  </p>
                </div>
                <div className="text-right text-[13px] font-black text-xb-text">
                  <p>{x.homeScore ?? "-"}</p>
                  <p>{x.awayScore ?? "-"}</p>
                </div>
                <ChevronRight
                  className={`h-3.5 w-3.5 ${selected === x.id ? "text-xb-blue" : "text-xb-text-muted"}`}
                />
              </Link>
            ))}
          </div>
        ))}
      </Panel>

      {/* Columns 2 & 3 — desktop only; mobile opens dedicated pages instead */}
      <Panel title="Match details" className="hidden lg:flex">
        <MatchDetailsSection sport={sport} matchId={selected} />
      </Panel>

      <Panel title="Highlights & lineups" className="hidden lg:flex">
        <MatchHighlightsSection sport={sport} matchId={selected} />
      </Panel>
    </div>
  );
}

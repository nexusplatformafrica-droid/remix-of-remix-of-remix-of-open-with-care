import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { MatchScope, Sport } from "@/lib/sports-types";

type Filters = {
  sport: Sport;
  scope: MatchScope;
  /** First selected league / country — kept for single-pick call sites. */
  leagueId: number | null;
  countryId: number | null;
  /** Full multi-select selections. */
  leagueIds: number[];
  countryIds: number[];
  setSport: (s: Sport) => void;
  setScope: (s: MatchScope) => void;
  setLeague: (leagueId: number | null, countryId?: number | null) => void;
  setLeagues: (leagueIds: number[]) => void;
  toggleLeague: (leagueId: number, countryId?: number | null) => void;
  toggleCountry: (countryId: number) => void;
  clearFilters: () => void;
};

const Ctx = createContext<Filters | null>(null);

export function SportFilterProvider({
  children,
  initialSport = "football",
  initialScope = "today",
  initialLeagueIds = [],
  initialCountryIds = [],
}: {
  children: ReactNode;
  initialSport?: Sport;
  initialScope?: MatchScope;
  initialLeagueIds?: number[];
  initialCountryIds?: number[];
}) {
  const [sport, setSportState] = useState<Sport>(initialSport);
  const [scope, setScope] = useState<MatchScope>(initialScope);
  const [leagueIds, setLeagueIds] = useState<number[]>(initialLeagueIds);
  const [countryIds, setCountryIds] = useState<number[]>(initialCountryIds);

  const value = useMemo<Filters>(() => {
    // Picking any filter (league or country) should reveal the full fixture
    // list with odds, not just today's games.
    const widen = () => {
      if (scope === "today") setScope("upcoming");
    };
    const toggle = (list: number[], id: number) =>
      list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

    return {
      sport,
      scope,
      leagueId: leagueIds[0] ?? null,
      countryId: countryIds[0] ?? null,
      leagueIds,
      countryIds,
      setSport: (s) => {
        setSportState(s);
        setLeagueIds([]);
        setCountryIds([]);
      },
      setScope,
      setLeague: (l, c = null) => {
        setLeagueIds(l ? [l] : []);
        setCountryIds(c ? [c] : []);
        if (l || c) widen();
      },
      setLeagues: (ids) => {
        setLeagueIds(ids);
        setCountryIds([]);
        if (ids.length > 0) widen();
      },
      toggleLeague: (l, c = null) => {
        setLeagueIds((prev) => toggle(prev, l));
        if (c) setCountryIds((prev) => (prev.includes(c) ? prev : prev));
        widen();
      },
      toggleCountry: (c) => {
        setCountryIds((prev) => toggle(prev, c));
        widen();
      },
      clearFilters: () => {
        setLeagueIds([]);
        setCountryIds([]);
      },
    };
  }, [sport, scope, leagueIds, countryIds]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSportFilters() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSportFilters must be used within SportFilterProvider");
  return ctx;
}

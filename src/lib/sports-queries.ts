import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import {
  getMatches,
  getMatchDetails,
  getLeagues,
  getLiveCounts,
  getLeagueActivity,
} from "./sports.functions";
import type { MatchScope, Sport } from "./sports-types";

export type { Sport, MatchScope } from "./sports-types";
export type Match = Awaited<ReturnType<typeof getMatches>>[number];
export type MatchDetails = Awaited<ReturnType<typeof getMatchDetails>>;
export type League = Awaited<ReturnType<typeof getLeagues>>[number];
export type Market = MatchDetails["markets"][number];

export type MatchFilters = {
  sport: Sport;
  scope: MatchScope;
  leagueId?: number | null;
  countryId?: number | null;
  leagueIds?: number[] | null;
  countryIds?: number[] | null;
};

export const matchesQuery = (f: MatchFilters) => {
  const leagueIds = [
    ...new Set([...(f.leagueIds ?? []), ...(f.leagueId ? [f.leagueId] : [])]),
  ].sort((a, b) => a - b);
  const countryIds = [
    ...new Set([...(f.countryIds ?? []), ...(f.countryId ? [f.countryId] : [])]),
  ].sort((a, b) => a - b);

  return queryOptions({
    queryKey: ["matches", f.sport, f.scope, leagueIds.join(","), countryIds.join(",")],
    queryFn: () =>
      getMatches({
        data: { sport: f.sport, scope: f.scope, leagueIds, countryIds },
      }),
    staleTime: f.scope === "live" ? 4_000 : 20_000,
    // Silent background updates: keep the current list on screen while refetching
    // so odds/scores swap in place instead of flashing a skeleton.
    // Live odds move constantly, so in-play lists poll the provider feed fast.
    refetchInterval: f.scope === "live" ? 6_000 : 20_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    // No keepPreviousData here: when the filter changes the previous
    // (unselected) list must disappear at once and the new selection loads
    // behind a skeleton instead of lingering stale rows.
  });
};

export const leaguesQuery = (sport: Sport) =>
  queryOptions({
    queryKey: ["leagues", sport],
    queryFn: () => getLeagues({ data: { sport } }),
    staleTime: 60 * 60_000,
    placeholderData: keepPreviousData,
  });

export const liveCountsQuery = () =>
  queryOptions({
    queryKey: ["live-counts"],
    queryFn: () => getLiveCounts(),
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  });

export const matchDetailsQuery = (sport: Sport, matchId: string) =>
  queryOptions({
    queryKey: ["match", sport, matchId],
    queryFn: () => getMatchDetails({ data: { sport, matchId } }),
    staleTime: 4_000,
    refetchInterval: 6_000,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  });

export type EventRow = MatchDetails["goals"][number];
export type MatchLineups = NonNullable<MatchDetails["lineups"]>;
export type VideoItem = MatchDetails["videos"][number];

export type LeagueActivity = Awaited<ReturnType<typeof getLeagueActivity>>[number];

export const leagueActivityQuery = (sport: Sport, scope: MatchScope) =>
  queryOptions({
    queryKey: ["league-activity", sport, scope],
    queryFn: () => getLeagueActivity({ data: { sport, scope } }),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });

/* ---------------- provider directory widgets ---------------- */

import {
  getCountries,
  getSeasons,
  getStandings,
  getTopScorers,
  getTeams,
  getPlayers,
} from "./sports.functions";

export type Country = Awaited<ReturnType<typeof getCountries>>[number];
export type Season = Awaited<ReturnType<typeof getSeasons>>[number];
export type StandingRow = Awaited<ReturnType<typeof getStandings>>[number];
export type TopScorer = Awaited<ReturnType<typeof getTopScorers>>[number];
export type Team = Awaited<ReturnType<typeof getTeams>>[number];
export type PlayerRow = Awaited<ReturnType<typeof getPlayers>>[number];

export const countriesQuery = (sport: Sport) =>
  queryOptions({
    queryKey: ["countries", sport],
    queryFn: () => getCountries({ data: { sport } }),
    staleTime: 12 * 60 * 60_000,
    placeholderData: keepPreviousData,
  });

export const seasonsQuery = (sport: Sport, leagueKey: number) =>
  queryOptions({
    queryKey: ["seasons", sport, leagueKey],
    queryFn: () => getSeasons({ data: { sport, leagueKey } }),
    enabled: leagueKey > 0,
    staleTime: 6 * 60 * 60_000,
  });

export const standingsQuery = (sport: Sport, leagueKey: number) =>
  queryOptions({
    queryKey: ["standings", sport, leagueKey],
    queryFn: () => getStandings({ data: { sport, leagueKey } }),
    enabled: leagueKey > 0,
    staleTime: 15 * 60_000,
    placeholderData: keepPreviousData,
  });

export const topScorersQuery = (sport: Sport, leagueKey: number) =>
  queryOptions({
    queryKey: ["topscorers", sport, leagueKey],
    queryFn: () => getTopScorers({ data: { sport, leagueKey } }),
    enabled: leagueKey > 0,
    staleTime: 30 * 60_000,
    placeholderData: keepPreviousData,
  });

export const teamsQuery = (sport: Sport, leagueKey: number) =>
  queryOptions({
    queryKey: ["teams", sport, "league", leagueKey],
    queryFn: () => getTeams({ data: { sport, leagueKey } }),
    enabled: leagueKey > 0,
    staleTime: 30 * 60_000,
    placeholderData: keepPreviousData,
  });

export const teamQuery = (sport: Sport, teamKey: number) =>
  queryOptions({
    queryKey: ["teams", sport, "team", teamKey],
    queryFn: () => getTeams({ data: { sport, teamKey } }),
    enabled: teamKey > 0,
    staleTime: 30 * 60_000,
  });

export const playerSearchQuery = (sport: Sport, search: string) =>
  queryOptions({
    queryKey: ["players", sport, search],
    queryFn: () => getPlayers({ data: { sport, search } }),
    enabled: search.trim().length >= 3,
    staleTime: 10 * 60_000,
    placeholderData: keepPreviousData,
  });

/* ---------------- odds hydration + real provider search ---------------- */

import { getMatchOdds, searchMatches } from "./sports.functions";

/** Fills in prices for rows the bulk odds feed skipped. */
export const matchOddsQuery = (sport: Sport, ids: string[]) =>
  queryOptions({
    queryKey: ["match-odds", sport, [...ids].sort().join(",")],
    queryFn: () => getMatchOdds({ data: { sport, ids } }),
    enabled: ids.length > 0,
    staleTime: 60_000,
    refetchInterval: 90_000,
    placeholderData: keepPreviousData,
  });

/** Searches the whole provider catalogue, not just the loaded list. */
export const matchSearchQuery = (sport: Sport, term: string) =>
  queryOptions({
    queryKey: ["match-search", sport, term.trim().toLowerCase()],
    queryFn: () => searchMatches({ data: { sport, term } }),
    enabled: term.trim().length >= 2,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

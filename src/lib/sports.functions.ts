import { createServerFn } from "@tanstack/react-start";
import type { MatchScope, Sport } from "./sports-types";

export const getMatches = createServerFn({ method: "GET" })
  .inputValidator(
    (data: {
      sport?: Sport;
      scope?: MatchScope;
      leagueId?: number | null;
      countryId?: number | null;
      leagueIds?: number[] | null;
      countryIds?: number[] | null;
    }) => data ?? {},
  )
  .handler(async ({ data }) => {
    const { fetchMatches } = await import("./allsports.server");
    return fetchMatches({
      sport: data.sport ?? "football",
      scope: data.scope ?? "today",
      leagueId: data.leagueId ?? null,
      countryId: data.countryId ?? null,
      leagueIds: data.leagueIds ?? null,
      countryIds: data.countryIds ?? null,
    });
  });

export const getLeagues = createServerFn({ method: "GET" })
  .inputValidator((data: { sport?: Sport }) => data ?? {})
  .handler(async ({ data }) => {
    const { fetchLeagues } = await import("./allsports.server");
    return fetchLeagues(data.sport ?? "football");
  });

export const getLiveCounts = createServerFn({ method: "GET" }).handler(async () => {
  const { fetchLiveCounts } = await import("./allsports.server");
  return fetchLiveCounts();
});

export const getMatchDetails = createServerFn({ method: "GET" })
  .inputValidator((data: { sport?: Sport; matchId: string }) => ({
    sport: (data.sport ?? "football") as Sport,
    matchId: String(data.matchId),
  }))
  .handler(async ({ data }) => {
    const { fetchMatchDetails } = await import("./allsports.server");
    return fetchMatchDetails(data.sport, data.matchId);
  });

export const askMatchAssistant = createServerFn({ method: "POST" })
  .inputValidator((data: { sport?: Sport; matchId: string; question: string }) => ({
    sport: (data.sport ?? "football") as Sport,
    matchId: String(data.matchId),
    question: String(data.question).slice(0, 500),
  }))
  .handler(async ({ data }) => {
    const { answerMatchQuestion } = await import("./match-ai.server");
    return answerMatchQuestion(data.sport, data.matchId, data.question);
  });

export const generateAiBetSlip = createServerFn({ method: "POST" })
  .inputValidator((data: { sport?: Sport; legs?: number; risk?: "safe" | "balanced" | "high" }) => ({
    sport: (data.sport ?? "football") as Sport,
    legs: Math.max(2, Math.min(8, Number(data.legs ?? 3))),
    risk: (data.risk ?? "balanced") as "safe" | "balanced" | "high",
  }))
  .handler(async ({ data }) => {
    const { generateBetSlip } = await import("./betslip-ai.server");
    return generateBetSlip(data);
  });

export const getLeagueActivity = createServerFn({ method: "GET" })
  .inputValidator((data: { sport?: Sport; scope?: MatchScope }) => data ?? {})
  .handler(async ({ data }) => {
    const { fetchLeagueActivity } = await import("./allsports.server");
    return fetchLeagueActivity(data.sport ?? "football", data.scope ?? "today");
  });

export const getCountries = createServerFn({ method: "GET" })
  .inputValidator((data: { sport?: Sport }) => data ?? {})
  .handler(async ({ data }) => {
    const { fetchCountries } = await import("./allsports.server");
    return fetchCountries(data.sport ?? "football");
  });

export const getSeasons = createServerFn({ method: "GET" })
  .inputValidator((data: { sport?: Sport; leagueKey: number }) => ({
    sport: (data.sport ?? "football") as Sport,
    leagueKey: Number(data.leagueKey ?? 0),
  }))
  .handler(async ({ data }) => {
    const { fetchSeasons } = await import("./allsports.server");
    return fetchSeasons(data.sport, data.leagueKey);
  });

export const getStandings = createServerFn({ method: "GET" })
  .inputValidator((data: { sport?: Sport; leagueKey: number }) => ({
    sport: (data.sport ?? "football") as Sport,
    leagueKey: Number(data.leagueKey ?? 0),
  }))
  .handler(async ({ data }) => {
    const { fetchLeagueStandings } = await import("./allsports.server");
    return fetchLeagueStandings(data.sport, data.leagueKey);
  });

export const getTopScorers = createServerFn({ method: "GET" })
  .inputValidator((data: { sport?: Sport; leagueKey: number }) => ({
    sport: (data.sport ?? "football") as Sport,
    leagueKey: Number(data.leagueKey ?? 0),
  }))
  .handler(async ({ data }) => {
    const { fetchTopScorers } = await import("./allsports.server");
    return fetchTopScorers(data.sport, data.leagueKey);
  });

export const getTeams = createServerFn({ method: "GET" })
  .inputValidator(
    (data: { sport?: Sport; leagueKey?: number | null; teamKey?: number | null; search?: string | null }) => ({
      sport: (data.sport ?? "football") as Sport,
      leagueKey: data.leagueKey ?? null,
      teamKey: data.teamKey ?? null,
      search: data.search ?? null,
    }),
  )
  .handler(async ({ data }) => {
    const { fetchTeams } = await import("./allsports.server");
    return fetchTeams(data.sport, data);
  });

export const getPlayers = createServerFn({ method: "GET" })
  .inputValidator(
    (data: { sport?: Sport; search?: string | null; playerKey?: number | null; teamKey?: number | null }) => ({
      sport: (data.sport ?? "football") as Sport,
      search: data.search ?? null,
      playerKey: data.playerKey ?? null,
      teamKey: data.teamKey ?? null,
    }),
  )
  .handler(async ({ data }) => {
    const { fetchPlayers } = await import("./allsports.server");
    return fetchPlayers(data.sport, data);
  });

export const getMatchOdds = createServerFn({ method: "GET" })
  .inputValidator((data: { sport?: Sport; ids: string[] }) => ({
    sport: (data.sport ?? "football") as Sport,
    ids: (data.ids ?? []).map(String).slice(0, 600),
  }))
  .handler(async ({ data }) => {
    const { fetchMatchOdds } = await import("./allsports.server");
    return fetchMatchOdds(data.sport, data.ids);
  });

export const searchMatches = createServerFn({ method: "GET" })
  .inputValidator((data: { sport?: Sport; term: string }) => ({
    sport: (data.sport ?? "football") as Sport,
    term: String(data.term ?? "").slice(0, 60),
  }))
  .handler(async ({ data }) => {
    const { searchMatchesEverywhere } = await import("./allsports.server");
    return searchMatchesEverywhere(data.sport, data.term);
  });

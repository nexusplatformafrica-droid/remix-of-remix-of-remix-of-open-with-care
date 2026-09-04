import type { Sport } from "./sports-types";

export type TopPick = {
  id: string;
  label: string;
  sport: Sport;
  /** Patterns matched against "<country> <league>" and the league name. */
  match: RegExp[];
  /** Optional country restriction so "Premier League" means England only. */
  country?: RegExp;
};

/** Curated "Top competitions" quick picks shown first in the blue banner. */
export const TOP_COMPETITIONS: TopPick[] = [
  { id: "ucl", label: "UEFA Champions League", sport: "football", match: [/^uefa champions league$/i, /^champions league$/i] },
  { id: "nba", label: "NBA", sport: "basketball", match: [/\bnba\b/i] },
  { id: "epl", label: "England. Premier League", sport: "football", country: /^england$/i, match: [/^premier league$/i] },
  { id: "bundes", label: "Germany. Bundesliga", sport: "football", country: /^germany$/i, match: [/^bundesliga$/i] },
  { id: "laliga", label: "Spain. La Liga", sport: "football", country: /^spain$/i, match: [/la ?liga($| santander)/i, /^primera( division)?$/i] },
  { id: "ligue1", label: "France. Ligue 1", sport: "football", country: /^france$/i, match: [/^ligue 1$/i] },
  { id: "dota", label: "Dota 2. The International", sport: "football", match: [/the international|dota/i] },
];

/** Curated "Top Bets" multi-league bundles. */
export const TOP_BET_PRESETS: TopPick[] = [
  {
    id: "elite5",
    label: "Elite European Leagues (5x)",
    sport: "football",
    country: /^(england|germany|italy|spain|france)$/i,
    match: [/^premier league$/i, /^bundesliga$/i, /^serie a$/i, /la ?liga/i, /^primera( division)?$/i, /^ligue 1$/i],
  },
  {
    id: "eurocups3",
    label: "European Cups (3x)",
    sport: "football",
    match: [/^uefa champions league$/i, /^uefa europa league$/i, /^uefa europa conference league$/i, /^champions league$/i, /^europa league$/i, /^conference league$/i],
  },
  {
    id: "england4",
    label: "England (4x)",
    sport: "football",
    country: /^england$/i,
    match: [/^premier league$/i, /^championship$/i, /^league one$/i, /^league two$/i],
  },
  {
    id: "cups5",
    label: "National Cups (5x)",
    sport: "football",
    country: /^(england|spain|italy|germany|france)$/i,
    match: [/^fa cup$/i, /copa del rey/i, /^spain cup$/i, /coppa italia/i, /dfb.?pokal/i, /coupe de france/i],
  },
  { id: "laliga1", label: "Spain LaLiga", sport: "football", country: /^spain$/i, match: [/la ?liga/i, /^primera( division)?$/i] },
  { id: "primeira", label: "Portugal Liga", sport: "football", country: /^portugal$/i, match: [/primeira liga|liga portugal|portuguese liga/i] },
  { id: "ucl2", label: "Champions League", sport: "football", match: [/^uefa champions league$/i, /^champions league$/i] },
  { id: "uel", label: "Europa League", sport: "football", match: [/^uefa europa league$/i, /^europa league$/i] },
  { id: "uecl", label: "Conference League", sport: "football", match: [/^uefa europa conference league$/i, /^conference league$/i] },
  { id: "super", label: "Turkey SuperLig", sport: "football", country: /^turkey$/i, match: [/super ?lig/i] },
];

export function pickMatches(pick: TopPick, league: { name: string; country: string }): boolean {
  const country = (league.country ?? "").trim();
  if (pick.country && !pick.country.test(country)) return false;
  const text = `${country} ${league.name}`;
  return pick.match.some((re) => re.test(league.name) || re.test(text));
}

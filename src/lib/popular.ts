import type { Sport } from "./sports-types";

/** Countries shown first in the filter bar, in this exact order. */
export const POPULAR_COUNTRIES = [
  "England",
  "Spain",
  "Germany",
  "Italy",
  "France",
  "International Clubs",
  "Europe",
  "World",
  "Netherlands",
  "Portugal",
  "Brazil",
  "Argentina",
  "USA",
  "Uganda",
  "Turkey",
  "Belgium",
  "Scotland",
  "Mexico",
  "Saudi Arabia",
  "Japan",
];

/** Ordered list of elite competitions per sport (first match wins). */
const POPULAR_LEAGUES: Record<Sport, RegExp[]> = {
  football: [
    /^premier league$/i,
    /uefa champions league|champions league/i,
    /uefa europa league|europa league/i,
    /conference league/i,
    /bundesliga$/i,
    /^serie a$/i,
    /la ?liga|laliga/i,
    /ligue 1/i,
    /eredivisie/i,
    /primeira liga/i,
    /efl cup|carabao/i,
    /^championship$/i,
    /fa cup|copa del rey|coppa italia|dfb pokal/i,
    /copa libertadores/i,
    /copa sudamericana/i,
    /brasileir/i,
    /liga profesional|primera divisi/i,
    /leagues cup|mls|major league soccer/i,
    /world cup|euro |nations league|afcon|caf /i,
    /friendl/i,
  ],
  basketball: [/\bnba\b/i, /euroleague/i, /eurocup/i, /\bacb\b/i, /\bbbl\b/i, /ncaa/i],
  tennis: [
    /grand slam|australian open|roland garros|wimbledon|us open/i,
    /atp.*masters|masters/i,
    /^atp/i,
    /^wta/i,
  ],
  cricket: [
    /world cup|champions trophy/i,
    /premier league|big bash|the hundred/i,
    /test|odi|t20/i,
  ],
};

/** Lower is more important. Non-popular entries get a large rank. */
export function leagueRank(sport: Sport, league: string, country = ""): number {
  const text = `${country} ${league}`;
  const list = POPULAR_LEAGUES[sport];
  for (let i = 0; i < list.length; i++) {
    const re = list[i];
    if (re && (re.test(league) || re.test(text))) return i;
  }
  return 500 + countryRank(country);
}

export function countryRank(country: string): number {
  const i = POPULAR_COUNTRIES.findIndex((c) => c.toLowerCase() === country.trim().toLowerCase());
  return i === -1 ? 100 : i;
}

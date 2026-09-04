import type { Sport } from "./sports-types";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

export type LeagueCandidate = { key: number; label: string; fixtures: number };

type CacheEntry = { at: number; keys: number[] };
const cache = new Map<string, CacheEntry>();
const TTL = 3 * 60 * 60_000; // refresh the AI shortlist a few times a day

/** Fallback shortlist used when AI is unavailable — globally followed competitions. */
const FALLBACK: Record<Sport, RegExp> = {
  football:
    /premier league|la liga|serie a|bundesliga|ligue 1|champions league|europa league|conference league|world cup|euro|copa|nations league|eredivisie|primeira liga|mls|saudi|caf|afcon|uganda/i,
  basketball: /\bnba\b|euroleague|ncaa|acb|eurocup|bbl|wnba/i,
  tennis: /atp|wta|grand slam|australian open|roland garros|wimbledon|us open|masters/i,
  cricket: /world cup|champions trophy|premier league|big bash|the hundred|test|odi|t20/i,
};

function fallbackKeys(candidates: LeagueCandidate[], sport: Sport, limit: number) {
  const re = FALLBACK[sport];
  const picked = candidates.filter((c) => re.test(c.label)).map((c) => c.key);
  if (picked.length > 0) return picked.slice(0, limit);
  // Last resort: busiest competitions of the day.
  return [...candidates]
    .sort((a, b) => b.fixtures - a.fixtures)
    .slice(0, limit)
    .map((c) => c.key);
}

/**
 * Asks Lovable AI which of today's competitions count as "top leagues" worth
 * boosting. Cached per sport/day so the list is stable between silent refreshes.
 */
export async function pickTopLeagues(
  sport: Sport,
  candidates: LeagueCandidate[],
  limit = 12,
): Promise<number[]> {
  if (candidates.length === 0) return [];

  const day = new Date().toISOString().slice(0, 10);
  const cacheKey = `${sport}:${day}:${limit}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL) return hit.keys;

  const apiKey = process.env["LOVABLE_API_KEY"];
  const shortlist = [...candidates].sort((a, b) => b.fixtures - a.fixtures).slice(0, 120);

  let keys: number[] = [];
  if (apiKey) {
    try {
      const res = await fetch(GATEWAY, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "google/gemini-3.6-flash",
          messages: [
            {
              role: "system",
              content:
                "You rank sports competitions by global prestige and betting popularity. " +
                `Choose at most ${limit} of the supplied competitions that a bettor would consider TOP leagues today. ` +
                "Prefer elite senior competitions; avoid youth, reserve, friendly, women's lower tiers and obscure regional divisions. " +
                'Reply with JSON only: {"keys":[<league keys>]}',
            },
            {
              role: "user",
              content: `Sport: ${sport}\nCompetitions today:\n${shortlist
                .map((c) => `${c.key} | ${c.label} | ${c.fixtures} fixtures`)
                .join("\n")}`,
            },
          ],
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const text = json.choices?.[0]?.message?.content ?? "";
        const match = text.match(/\{[\s\S]*\}/);
        const parsed = match ? (JSON.parse(match[0]) as { keys?: unknown }) : null;
        const valid = new Set(candidates.map((c) => c.key));
        keys = Array.isArray(parsed?.keys)
          ? parsed.keys.map(Number).filter((k) => valid.has(k)).slice(0, limit)
          : [];
      }
    } catch {
      keys = [];
    }
  }

  if (keys.length === 0) keys = fallbackKeys(candidates, sport, limit);

  cache.set(cacheKey, { at: Date.now(), keys });
  return keys;
}

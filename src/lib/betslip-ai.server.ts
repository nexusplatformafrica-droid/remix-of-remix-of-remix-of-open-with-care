import { fetchMatches } from "./allsports.server";
import type { Sport } from "./sports-types";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

export type SlipLeg = {
  id: string;
  matchId: string;
  event: string;
  market: string;
  odd: number;
  kickoff: string;
  league: string;
  reason: string;
};

export type SlipResult = { legs: SlipLeg[]; summary?: string; error?: string };

export type SlipRequest = {
  sport: Sport;
  legs: number;
  risk: "safe" | "balanced" | "high";
};

type Candidate = {
  matchId: string;
  event: string;
  league: string;
  kickoff: string;
  options: Array<{ market: string; odd: number }>;
};

/**
 * Zero-configuration generator. Builds the slip from the free live fixture and
 * odds feed only — no API key, no external AI service. It is also the fallback
 * whenever the AI model is unavailable, so the button always returns a slip.
 */
function localSlip(candidates: Candidate[], legs: number, risk: SlipRequest["risk"]): SlipResult {
  const band =
    risk === "safe" ? [1.15, 1.65] : risk === "high" ? [2.0, 6.0] : [1.45, 2.35];
  const target = (band[0]! + band[1]!) / 2;

  const scored = candidates
    .map((c) => {
      const inBand = c.options.filter((o) => o.odd >= band[0]! && o.odd <= band[1]!);
      const pool = inBand.length ? inBand : c.options;
      const option = pool.reduce((best, o) =>
        Math.abs(o.odd - target) < Math.abs(best.odd - target) ? o : best,
      );
      return { c, option, distance: Math.abs(option.odd - target) };
    })
    .sort((a, b) => a.distance - b.distance);

  const out: SlipLeg[] = [];
  const usedLeagues = new Set<string>();
  for (const pass of [1, 2]) {
    for (const s of scored) {
      if (out.length >= legs) break;
      if (out.some((l) => l.matchId === s.c.matchId)) continue;
      // First pass spreads picks across different competitions.
      if (pass === 1 && usedLeagues.has(s.c.league)) continue;
      usedLeagues.add(s.c.league);
      out.push({
        id: `${s.c.matchId}-${s.option.market}`,
        matchId: s.c.matchId,
        event: s.c.event,
        market: s.option.market,
        odd: s.option.odd,
        kickoff: s.c.kickoff,
        league: s.c.league,
        reason:
          risk === "safe"
            ? "Short-priced favourite, lowest-variance pick"
            : risk === "high"
              ? "Higher-priced value angle from the odds board"
              : "Balanced price against the rest of the board",
      });
    }
  }

  if (out.length === 0) return { legs: [], error: "No priced matches available right now." };
  const total = out.reduce((n, l) => n * l.odd, 1);
  return {
    legs: out,
    summary: `${out.length}-leg ${risk} slip built from live odds, total odds ${total.toFixed(2)}.`,
  };
}

export async function generateBetSlip(req: SlipRequest): Promise<SlipResult> {
  const apiKey = process.env["LOVABLE_API_KEY"];

  const pools = await Promise.all([
    fetchMatches({ sport: req.sport, scope: "topbets" }),
    fetchMatches({ sport: req.sport, scope: "upcoming" }),
  ]);

  const seen = new Set<string>();
  const candidates: Candidate[] = [];
  for (const m of pools.flat()) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    const options: Array<{ market: string; odd: number }> = [];
    if (m.odds.home) options.push({ market: "1", odd: m.odds.home });
    if (m.odds.draw) options.push({ market: "X", odd: m.odds.draw });
    if (m.odds.away) options.push({ market: "2", odd: m.odds.away });
    if (m.odds.over) options.push({ market: "Over 2.5", odd: m.odds.over });
    if (m.odds.under) options.push({ market: "Under 2.5", odd: m.odds.under });
    if (options.length === 0) continue;
    candidates.push({
      matchId: m.id,
      event: `${m.home} — ${m.away}`,
      league: `${m.country} · ${m.league}`.trim(),
      kickoff: `${m.date} ${m.time}`,
      options,
    });
    if (candidates.length >= 60) break;
  }

  if (candidates.length === 0)
    return { legs: [], error: "No priced upcoming matches available right now." };

  const legs = Math.max(2, Math.min(8, Math.round(req.legs)));
  // No AI key configured: use the free built-in generator.
  if (!apiKey) return localSlip(candidates, legs, req.risk);
  const riskNote =
    req.risk === "safe"
      ? "Prefer short odds (1.20–1.60) on clear favourites."
      : req.risk === "high"
        ? "Prefer bold value picks, odds above 2.00 are welcome."
        : "Mix favourites with a couple of value picks (odds ~1.5–2.2).";

  try {
    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You are a sports betting analyst building an accumulator from a fixed list of real fixtures. " +
              "Choose ONLY from the supplied matches and their listed markets. Never invent a match, market or odd. " +
              "Return strictly JSON.",
          },
          {
            role: "user",
            content:
              `Sport: ${req.sport}. Build exactly ${legs} selections from different matches. ${riskNote}\n` +
              `Fixtures JSON:\n${JSON.stringify(candidates)}\n\n` +
              `Respond as JSON: {"summary":"one sentence","picks":[{"matchId":"..","market":"1|X|2|Over 2.5|Under 2.5","reason":"max 12 words"}]}`,
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) return localSlip(candidates, legs, req.risk);

    const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = body.choices?.[0]?.message?.content ?? "";
    const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    const parsed = JSON.parse(json) as {
      summary?: string;
      picks?: Array<{ matchId?: string; market?: string; reason?: string }>;
    };

    const out: SlipLeg[] = [];
    for (const p of parsed.picks ?? []) {
      const match = candidates.find((c) => c.matchId === String(p.matchId));
      if (!match || out.some((l) => l.matchId === match.matchId)) continue;
      const option = match.options.find(
        (o) => o.market.toLowerCase() === String(p.market ?? "").toLowerCase(),
      );
      if (!option) continue;
      out.push({
        id: `${match.matchId}-${option.market}`,
        matchId: match.matchId,
        event: match.event,
        market: option.market,
        odd: option.odd,
        kickoff: match.kickoff,
        league: match.league,
        reason: String(p.reason ?? "").slice(0, 120),
      });
    }

    if (out.length === 0) return localSlip(candidates, legs, req.risk);
    return { legs: out, summary: parsed.summary?.slice(0, 200) ?? "" };
  } catch {
    return localSlip(candidates, legs, req.risk);
  }
}

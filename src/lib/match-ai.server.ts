import { fetchMatchDetails } from "./allsports.server";
import type { Sport } from "./sports-types";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

export type AiAnswer = { answer: string; error?: string };

export async function answerMatchQuestion(
  sport: Sport,
  matchId: string,
  question: string,
): Promise<AiAnswer> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return { answer: "", error: "AI assistant is not configured." };

  const d = await fetchMatchDetails(sport, matchId);
  if (!d.match) return { answer: "", error: "Match not found." };

  const context = {
    sport,
    fixture: {
      league: d.match.league,
      country: d.match.country,
      kickoff: d.match.kickoff,
      status: d.match.status,
      home: d.match.home,
      away: d.match.away,
      score: d.match.homeScore ? `${d.match.homeScore}-${d.match.awayScore}` : null,
      periods: d.match.periods,
    },
    markets: d.markets.slice(0, 14).map((m) => ({
      name: m.name,
      outcomes: m.outcomes.map((o) => `${o.label} @ ${o.odd}`),
    })),
    statistics: d.statistics,
    headToHead: d.h2h,
    homeRecent: d.homeRecent,
    awayRecent: d.awayRecent,
    standings: d.standings.slice(0, 20),
  };

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
              "You are a sports betting analyst. Answer using ONLY the supplied match data. " +
              "Be concise (max 140 words), reference concrete numbers, odds and form. " +
              "Never guarantee outcomes; note that betting carries risk when giving a lean.",
          },
          {
            role: "user",
            content: `Match data:\n${JSON.stringify(context)}\n\nQuestion: ${question}`,
          },
        ],
      }),
    });

    if (res.status === 429) return { answer: "", error: "Rate limit reached, try again shortly." };
    if (res.status === 402) return { answer: "", error: "AI credits exhausted." };
    if (!res.ok) return { answer: "", error: "The assistant is unavailable right now." };

    const body = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const answer = body.choices?.[0]?.message?.content?.trim() ?? "";
    return answer ? { answer } : { answer: "", error: "No answer returned." };
  } catch {
    return { answer: "", error: "The assistant is unavailable right now." };
  }
}

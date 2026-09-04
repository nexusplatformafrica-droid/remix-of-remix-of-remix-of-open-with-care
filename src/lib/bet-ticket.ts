import type { Bet, BetMatch } from "./admin-types";
import type { LegStatus, TicketLeg, TicketPdfInput } from "./ticket-pdf";
import { getMatchDetails } from "./sports.functions";
import type { Sport } from "./sports-types";

const fmt = (n: number) =>
  n.toLocaleString("en-UG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const dateLabel = (at: number) =>
  new Date(at).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const legTime = (at: number) =>
  new Date(at).toLocaleString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  });

export function betStatusToTicketStatus(status: Bet["status"]): LegStatus {
  if (status === "won") return "won";
  if (status === "lost" || status === "cancelled") return "lost";
  return "pending";
}

/** Human label for the picked market, e.g. "1X2 · Home win". */
const PICK_LABELS: Record<string, string> = {
  "1": "Home win",
  w1: "Home win",
  x: "Draw",
  "2": "Away win",
  w2: "Away win",
  home: "Home win",
  draw: "Draw",
  away: "Away win",
};

function marketLabel(m: BetMatch): string {
  const raw = `${m.market ?? ""}`.trim();
  const pick = `${m.pick ?? ""}`.trim();
  const source = raw || pick;
  // Detail-page markets already come through as "Market · Outcome".
  if (source.includes("·")) return source;
  const pretty = PICK_LABELS[source.toLowerCase()];
  if (pretty) return `1X2 · ${pretty}`;
  if (/^(over|under)/i.test(source)) return `Total goals · ${source}`;
  return pick && pick !== raw ? `${raw} · ${pick}` : source || "—";
}

type ScoreInfo = { score: string; live: boolean; finished: boolean };

/** Live/final score line for one leg, mirroring the lucky-winner ticket. */
function scoreFor(m: BetMatch, info: ScoreInfo | null): string {
  // The settlement engine stamps the score onto the leg, so virtual soccer and
  // already-finished fixtures always show how they ended.
  if (m.score) return m.score;
  if (info) return info.score;
  if (m.status === "void") return "Void";
  return Date.now() < m.startsAt ? "Not started" : "vs";
}

async function fetchScores(matches: BetMatch[]): Promise<Map<string, ScoreInfo>> {
  const out = new Map<string, ScoreInfo>();
  const targets = matches.filter((m) => m.matchId && !m.score && m.sport !== "virtual");
  if (targets.length === 0) return out;
  await Promise.all(
    targets.map(async (m) => {
      try {
        const d = await getMatchDetails({
          data: { sport: (m.sport as Sport) ?? "football", matchId: String(m.matchId) },
        });
        const g = d?.match;
        if (!g) return;
        const h = g.homeScore ?? "0";
        const a = g.awayScore ?? "0";
        const started = g.live || g.finished || g.homeScore !== null;
        const score = g.finished
          ? `${h} - ${a} FT`
          : g.live
            ? `${h} - ${a} LIVE${g.status ? ` ${g.status}` : ""}`
            : started
              ? `${h} - ${a}`
              : "Not started";
        out.set(m.id, { score, live: g.live, finished: g.finished });
      } catch {
        /* offline / unknown fixture — fall back to the time-based label */
      }
    }),
  );
  return out;
}

/** Turns a placed bet into the receipt payload used by the ticket PDF. */
export async function betToTicket(
  bet: Bet,
  owner: { name: string; origin: string },
): Promise<TicketPdfInput> {
  const odds = bet.matches.reduce((a, m) => a * (m.odds || 1), 1) || 1;
  const potential = bet.stake * odds;
  const status = betStatusToTicketStatus(bet.status);
  const payout = status === "lost" ? 0 : potential;
  const betId = (bet.code || bet.id).slice(0, 14).toUpperCase();

  const scores = await fetchScores(bet.matches);

  const legs: TicketLeg[] = bet.matches.map((m) => ({
    time: legTime(m.startsAt),
    teams: m.match,
    league: m.league || "—",
    market: marketLabel(m),
    odds: (m.odds || 1).toFixed(2),
    score: scoreFor(m, scores.get(m.id) ?? null),
    status: m.status === "won" ? "won" : m.status === "lost" ? "lost" : "pending",
  }));

  return {
    betId,
    winner: owner.name,
    game: `${bet.matches.length} selection(s)`,
    date: dateLabel(bet.placedAt),
    odds: odds.toFixed(2),
    stake: fmt(bet.stake),
    potential: fmt(potential),
    bonus: fmt(0),
    payout: fmt(payout),
    legs,
    status,
    ticketUrl: `${owner.origin}/lucky-winner?bet=${encodeURIComponent(betId)}`,
    barcodeValue: `BP${betId.replace(/[^a-z0-9]/gi, "").slice(0, 12)}`,
  };
}

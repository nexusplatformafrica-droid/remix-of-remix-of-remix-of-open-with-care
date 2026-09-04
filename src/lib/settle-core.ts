import type { Bet, BetMatch } from "./admin-types";
import { gradeMarket, type Snapshot, type Verdict } from "./market-grading";

export type SettleResult = {
  /** Legs with refreshed statuses (and odds reset to 1.00 for voided legs). */
  matches: BetMatch[];
  /** Ticket status after this pass. */
  status: Bet["status"];
  /** Every leg has a final verdict — nothing left to watch. */
  legsFinal: boolean;
  /** Amount to credit when the ticket is a winner (0 otherwise). */
  payout: number;
  /** Something actually changed versus the stored ticket. */
  changed: boolean;
  wonLegs: number;
  lostLegs: number;
  voidLegs: number;
};

const isFinal = (s: BetMatch["status"]) => s === "won" || s === "lost" || s === "void";

/** Human score line stored on the leg so tickets always show how it ended. */
function scoreLine(snap: Snapshot): string {
  if (snap.postponed) return "Postponed";
  if (!snap.ft) return snap.started ? "0 - 0" : "Not started";
  const main = `${snap.ft.h} - ${snap.ft.a}`;
  const ht = snap.ht ? ` (HT ${snap.ht.h} - ${snap.ht.a})` : "";
  if (snap.finished) return `${main} FT${ht}`;
  if (snap.live) return `${main} LIVE${ht}`;
  return `${main}${ht}`;
}

/**
 * Grades every leg of a ticket against the latest snapshots and derives the
 * ticket status:
 *  - any leg lost  → ticket lost immediately (remaining legs keep updating)
 *  - all legs won/void → ticket won (void legs count as odds 1.00)
 *  - all legs void → ticket cancelled, stake refunded
 */
export function settleTicket(bet: Bet, snapshots: Map<string, Snapshot>): SettleResult {
  let changed = false;

  const matches: BetMatch[] = bet.matches.map((leg) => {
    if (isFinal(leg.status)) return leg;
    const snap = leg.matchId ? snapshots.get(String(leg.matchId)) : undefined;
    if (!snap) return leg;
    const score = scoreLine(snap);
    const verdict: Verdict = gradeMarket(leg.market || leg.pick || "", snap);
    if (!verdict) {
      if (leg.score === score) return leg;
      changed = true;
      return { ...leg, score };
    }
    changed = true;
    if (verdict === "void") return { ...leg, status: "void", odds: 1, score };
    return { ...leg, status: verdict, score };
  });

  const wonLegs = matches.filter((m) => m.status === "won").length;
  const lostLegs = matches.filter((m) => m.status === "lost").length;
  const voidLegs = matches.filter((m) => m.status === "void").length;
  const legsFinal = matches.every((m) => isFinal(m.status));

  let status: Bet["status"] = "pending";
  if (lostLegs > 0) status = "lost";
  else if (legsFinal) status = voidLegs === matches.length ? "cancelled" : "won";

  const odds = matches.reduce((acc, m) => acc * (m.status === "void" ? 1 : m.odds || 1), 1);
  const payout =
    status === "won" ? Math.round(bet.stake * odds) : status === "cancelled" ? bet.stake : 0;

  if (status !== bet.status) changed = true;

  return { matches, status, legsFinal, payout, changed, wonLegs, lostLegs, voidLegs };
}

/** Fixture ids a ticket still needs scores for, grouped by sport. */
export function pendingFixtures(bets: Bet[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const bet of bets) {
    for (const leg of bet.matches) {
      if (!leg.matchId || isFinal(leg.status)) continue;
      const sport = leg.sport || "football";
      if (!out.has(sport)) out.set(sport, new Set());
      out.get(sport)!.add(String(leg.matchId));
    }
  }
  return out;
}

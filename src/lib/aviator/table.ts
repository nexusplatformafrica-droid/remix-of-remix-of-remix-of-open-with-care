/**
 * Live Aviator table — derived, never stored.
 *
 * Nothing about the game is written to a database: the round schedule, the
 * table of bets and the chat are all pure functions of the round seed plus the
 * authoritative internet clock. Every player therefore sees exactly the same
 * table, in real time, on any device — and the platform stores nothing, so the
 * game can never grow the database.
 */
import { unitRandom, type EngineRound } from "./engine";
import type { BetRow, Phase } from "./game";

const NAMES = [
  "d***4", "m***a", "k***7", "s***n", "j***o", "b***5", "a***z", "n***e",
  "t***y", "p***r", "l***8", "c***i", "r***k", "g***u", "y***a", "w***3",
  "z***m", "h***t", "f***9", "q***l", "v***s", "o***d", "i***c", "u***b",
];

/** Deterministic seeded pseudo-random sequence for one round. */
function rng(seed: string) {
  let index = 0;
  return () => {
    index += 1;
    return unitRandom(`${seed}#${index}`);
  };
}

/**
 * The bets on one round, identical for every client. Results are resolved
 * against the live multiplier so cash-outs appear as the plane climbs.
 */
export function tableFor(
  round: EngineRound | null,
  phase: Phase,
  multiplier: number,
  min: number,
): BetRow[] {
  if (!round) return [];
  const next = rng(round.id);
  const count = 12 + Math.floor(next() * 18);
  const rows: BetRow[] = [];

  for (let index = 0; index < count; index += 1) {
    const name = NAMES[Math.floor(next() * NAMES.length)] ?? "p***r";
    const sizeRoll = next();
    const units = sizeRoll > 0.94 ? 20 : sizeRoll > 0.78 ? 8 : sizeRoll > 0.45 ? 3 : 1;
    const amount = Math.round(min * units * 100) / 100;
    const target = Math.round((1.15 + next() * next() * 12) * 100) / 100;

    const cashedOut = target <= round.crashPoint;
    const revealed = phase === "crashed" || multiplier >= target;
    const won = cashedOut && revealed;
    const lost = !cashedOut && phase === "crashed";

    rows.push({
      id: `${round.id}:${index}`,
      roundId: round.id,
      userId: `t-${round.roundNumber}-${index}`,
      name,
      slot: 1,
      amount,
      autoCashout: target,
      cashoutMultiplier: won ? target : null,
      payout: won ? Math.round(amount * target * 100) / 100 : lost ? 0 : null,
      result: won ? "won" : lost ? "lost" : "pending",
      at: round.bettingStartsAt + index,
    });
  }

  rows.sort((a, b) => b.amount - a.amount);
  return rows;
}

/** Biggest wins across the rounds already finished — also derived, not stored. */
export function topWinsFor(history: EngineRound[], min: number): BetRow[] {
  return history
    .slice(0, 12)
    .flatMap((round) => tableFor(round, "crashed", round.crashPoint, min))
    .filter((bet) => bet.result === "won")
    .sort((a, b) => (b.payout ?? 0) - (a.payout ?? 0))
    .slice(0, 25);
}

export type ChatMessage = {
  id: string;
  userId: string;
  name: string;
  message: string;
  at: number;
};

const LINES = [
  "good luck everyone",
  "cashed out just in time 😅",
  "that one flew far",
  "waiting for a big one",
  "auto cash out at 2x is the way",
  "so close!",
  "next round is mine",
  "nice one 🔥",
  "always cash out early",
  "held too long again",
  "let's go 🚀",
  "who's still in?",
];

/** Ambient table chatter, identical for everyone and stored nowhere. */
export function chatFor(history: EngineRound[]): ChatMessage[] {
  return history
    .slice(0, 14)
    .reverse()
    .map((round, index) => {
      const pick = unitRandom(`c:${round.id}`);
      const who = unitRandom(`n:${round.id}`);
      return {
        id: `${round.id}:chat`,
        userId: `t-${round.roundNumber}`,
        name: NAMES[Math.floor(who * NAMES.length)] ?? "p***r",
        message: LINES[Math.floor(pick * LINES.length)] ?? "good luck",
        at: round.crashAt + index,
      };
    });
}

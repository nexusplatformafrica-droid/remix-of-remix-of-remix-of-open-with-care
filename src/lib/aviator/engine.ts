/**
 * Deterministic round engine.
 *
 * Nothing about the live round is stored: every client derives the exact same
 * schedule from the authoritative internet clock (see `serverNow()`), so all
 * players — on any device — are always on the same round in real time, and a
 * player who was offline resyncs instantly when the tab wakes up.
 *
 * Rounds restart at the top of every UTC hour so the derivation stays cheap
 * and identical for everyone.
 */
import { BETTING_SECONDS, flightDuration, multiplierAt, type Phase } from "./game";

export const AFTER_CRASH_SECONDS = 4;
/** Hard cap: a flight can never run longer than this. */
export const MAX_FLIGHT_SECONDS = 45;
export const MAX_CRASH_POINT = Math.floor(multiplierAt(MAX_FLIGHT_SECONDS) * 100) / 100;

const WINDOW_MS = 3_600_000; // one UTC hour

export type EngineRound = {
  id: string;
  roundNumber: number;
  seedHash: string;
  bettingStartsAt: number;
  flightStartsAt: number;
  crashAt: number;
  endsAt: number;
  crashPoint: number;
};

function hash32(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Stable 0..1 value for a given seed string. */
export function unitRandom(seed: string): number {
  let t = (hash32(seed) + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** House economics: industry-standard `(1 - edge) / (1 - r)` crash curve. */
export const HOUSE_EDGE = 0.06;
export const INSTANT_BUST_CHANCE = 0.04;
export const THEORETICAL_RTP =
  Math.round((1 - HOUSE_EDGE) * (1 - INSTANT_BUST_CHANCE) * 1000) / 10;

export function crashPointFor(seed: string): number {
  const r = unitRandom(seed);
  if (r < INSTANT_BUST_CHANCE) return 1;
  const u = (r - INSTANT_BUST_CHANCE) / (1 - INSTANT_BUST_CHANCE);

  // Weighted bands: most rounds bust in the 1.00-1.99 range, big multipliers stay rare.
  const bands: Array<[number, number, number]> = [
    [0.7, 1, 2],
    [0.9, 2, 4],
    [0.98, 4, 10],
    [1, 10, MAX_CRASH_POINT],
  ];
  let lower = 0;
  for (const [cut, min, max] of bands) {
    if (u < cut) {
      const t = (u - lower) / Math.max(cut - lower, 1e-9);
      // Skew within the band so the low end of each band is the likeliest.
      const raw = min + (max - min) * t * t;
      const value = Math.floor(raw * 100) / 100;
      if (!Number.isFinite(value)) return 1;
      return Math.min(Math.max(value, 1), MAX_CRASH_POINT);
    }
    lower = cut;
  }
  return 1;
}

const cache = new Map<number, EngineRound[]>();

function buildWindow(windowStart: number): EngineRound[] {
  const rounds: EngineRound[] = [];
  let cursor = windowStart;
  let index = 0;
  const windowEnd = windowStart + WINDOW_MS;
  const roundBase = Math.floor(windowStart / WINDOW_MS) * 1000;

  while (cursor < windowEnd && index < 1000) {
    const seed = `${windowStart}:${index}`;
    const crashPoint = crashPointFor(seed);
    const flight = Math.min(flightDuration(crashPoint), MAX_FLIGHT_SECONDS);
    const flightStartsAt = cursor + BETTING_SECONDS * 1000;
    const crashAt = flightStartsAt + flight * 1000;
    const endsAt = crashAt + AFTER_CRASH_SECONDS * 1000;
    if (endsAt > windowEnd) break;

    rounds.push({
      id: `r-${roundBase + index}`,
      roundNumber: roundBase + index,
      seedHash: hash32(`h:${seed}`).toString(16).padStart(8, "0"),
      bettingStartsAt: cursor,
      flightStartsAt,
      crashAt,
      endsAt,
      crashPoint,
    });

    cursor = endsAt;
    index += 1;
  }

  return rounds;
}

function windowRounds(windowStart: number): EngineRound[] {
  const cached = cache.get(windowStart);
  if (cached) return cached;
  const built = buildWindow(windowStart);
  cache.set(windowStart, built);
  if (cache.size > 4) cache.delete([...cache.keys()][0]!);
  return built;
}

/** Every round that matters right now: previous hour tail + current hour. */
export function scheduleAt(now: number): EngineRound[] {
  const currentWindow = Math.floor(now / WINDOW_MS) * WINDOW_MS;
  return [...windowRounds(currentWindow - WINDOW_MS), ...windowRounds(currentWindow)];
}

export function roundById(id: string, now: number): EngineRound | null {
  return scheduleAt(now).find((round) => round.id === id) ?? null;
}

export function currentRound(now: number): EngineRound | null {
  const list = scheduleAt(now);
  for (const round of list) {
    if (round.bettingStartsAt <= now && round.endsAt > now) return round;
  }
  return list.find((round) => round.bettingStartsAt > now) ?? null;
}

export function nextRoundAfter(round: EngineRound | null, now: number): EngineRound | null {
  if (!round) return null;
  const list = scheduleAt(now);
  const index = list.findIndex((item) => item.id === round.id);
  return index >= 0 ? (list[index + 1] ?? null) : null;
}

/** Finished rounds, newest first — the history strip. */
export function historyAt(now: number, count = 30): EngineRound[] {
  return scheduleAt(now)
    .filter((round) => round.crashAt <= now)
    .slice(-count)
    .reverse();
}

export type Snapshot = {
  round: EngineRound | null;
  nextRound: EngineRound | null;
  phase: Phase;
  multiplier: number;
  countdown: number;
  history: EngineRound[];
};

export function snapshotAt(now: number): Snapshot {
  const round = currentRound(now);
  const nextRound = nextRoundAfter(round, now);
  const history = historyAt(now);

  if (!round) {
    return { round: null, nextRound: null, phase: "crashed", multiplier: 1, countdown: 0, history };
  }

  if (now < round.flightStartsAt) {
    const countdown = Math.min(Math.max((round.flightStartsAt - now) / 1000, 0), BETTING_SECONDS);
    return { round, nextRound, phase: "betting", multiplier: 1, countdown, history };
  }

  if (now >= round.crashAt) {
    return { round, nextRound, phase: "crashed", multiplier: round.crashPoint, countdown: 0, history };
  }

  const elapsed = Math.min(Math.max((now - round.flightStartsAt) / 1000, 0), MAX_FLIGHT_SECONDS);
  const multiplier = Math.min(multiplierAt(elapsed), round.crashPoint);
  return { round, nextRound, phase: "flying", multiplier, countdown: 0, history };
}
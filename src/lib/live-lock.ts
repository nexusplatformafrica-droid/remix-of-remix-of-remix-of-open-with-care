/**
 * In-play lock for outcomes that are already won.
 *
 * Two rules, both driven by the full grading engine so *every* market is
 * covered (1X2, double chance, totals, BTTS, handicaps, correct score, …):
 *
 *  1. Any live outcome the current score has already settled as a win
 *     (Over 1.5 with 2 goals scored, BTTS Yes with both on the board, …) is
 *     locked immediately — it can no longer lose.
 *  2. From minute 80 the running result is treated as final, so outcomes that
 *     back the current result (home/away win, draw, double chance, DNB …) are
 *     locked too.
 */
import { gradeMarket, type Snapshot } from "./market-grading";

export type LockableMatch = {
  live?: boolean;
  finished?: boolean;
  status?: string;
  sport?: string;
  homeScore?: string | null;
  awayScore?: string | null;
  home?: string;
  away?: string;
};

/** Elapsed minute parsed from provider status text ("82", "45+2", "HT"). */
export function liveMinute(status: string | undefined | null): number | null {
  const s = String(status ?? "").trim();
  if (!s) return null;
  if (/^ht$|half\s*time/i.test(s)) return 45;
  if (/^ft$|finished/i.test(s)) return 90;
  const m = /^(\d{1,3})(?:\s*\+\s*(\d{1,2}))?/.exec(s);
  if (!m) return null;
  return Number(m[1]) + Number(m[2] ?? 0);
}

/** The side the late lock protects: "home" | "away" | "draw" | null. */
export function leadingSide(m: LockableMatch): "home" | "away" | "draw" | null {
  const h = Number(m.homeScore);
  const a = Number(m.awayScore);
  if (!Number.isFinite(h) || !Number.isFinite(a)) return null;
  if (h === a) return "draw";
  return h > a ? "home" : "away";
}

/** True once a live match has reached the 80th minute (through full time). */
export function isLateLive(m: LockableMatch): boolean {
  if (!m.live || m.finished) return false;
  const min = liveMinute(m.status);
  return min !== null && min >= 80;
}

/** Grading snapshot built from the live score; `asFinal` freezes the result. */
function snapshotOf(m: LockableMatch, asFinal: boolean): Snapshot | null {
  const h = Number(m.homeScore);
  const a = Number(m.awayScore);
  if (!Number.isFinite(h) || !Number.isFinite(a)) return null;
  return {
    started: true,
    live: true,
    finished: asFinal,
    postponed: false,
    ft: { h, a },
    ht: null,
    htDone: false,
    ...(m.home ? { home: m.home } : {}),
    ...(m.away ? { away: m.away } : {}),
  };
}

/**
 * Locked when this exact outcome is already a winner on the live score — either
 * irreversibly (rule 1) or because the match is in its closing minutes (rule 2).
 */
export function outcomeLocked(m: LockableMatch, market: string, label: string): boolean {
  if (!m.live || m.finished) return false;
  const pick = `${market.trim()} · ${label.trim()}`;

  const running = snapshotOf(m, false);
  if (running && gradeMarket(pick, running) === "won") return true;

  if (!isLateLive(m)) return false;
  const asFinal = snapshotOf(m, true);
  return Boolean(asFinal && gradeMarket(pick, asFinal) === "won");
}

/** Human explanation shown on a locked outcome. */
export function lockReason(m: LockableMatch): string {
  const min = liveMinute(m.status);
  return `Closed — this outcome is already won on the live score${min !== null ? ` (${min}')` : ""}`;
}

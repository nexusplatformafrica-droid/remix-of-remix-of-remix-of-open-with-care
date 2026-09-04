/**
 * Fallback pricing for fixtures the data provider does not price.
 *
 * Many minor competitions (youth leagues, lower divisions, regional cups) come
 * back from AllSportsAPI with an empty Odds/FullOdds node, which left those rows
 * blank in the list. Every playable fixture must be bettable, so we derive a
 * stable price set from the fixture itself.
 *
 * The numbers are deterministic — seeded by match id and team names — so the
 * same fixture always shows the same price across refreshes, servers and
 * devices, and a placed bet can never be settled against a different price.
 */
import type { MainOdds } from "./allsports.server-types";

/** FNV-1a: small, fast, stable across runtimes. */
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic 0..1 stream from one seed. */
function stream(seed: number) {
  let s = seed || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 0xffffffff;
  };
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Probability -> decimal price, with a standard bookmaker margin applied. */
function price(probability: number, margin: number): number {
  const p = Math.min(0.92, Math.max(0.04, probability));
  return round(Math.max(1.01, 1 / (p * margin)));
}

export type DerivedOddsInput = {
  id: string;
  home: string;
  away: string;
  /** Draw is omitted for sports that cannot end level (tennis, basketball). */
  drawPossible?: boolean;
};

/**
 * Builds a complete main-market price set for an unpriced fixture.
 * Home advantage is baked in, then nudged by the fixture's own seed so the
 * board does not look like the same three numbers repeated down the page.
 */
export function derivedMainOdds({
  id,
  home,
  away,
  drawPossible = true,
}: DerivedOddsInput): MainOdds {
  const next = stream(hash(`${id}|${home}|${away}`));
  const margin = 1.06;

  // Relative strength of the two sides, ~0.5 means an even game.
  const edge = next() * 0.34 - 0.17; // -0.17 .. +0.17
  const drawProb = drawPossible ? 0.24 + next() * 0.06 : 0;
  const remaining = 1 - drawProb;
  const homeProb = remaining * (0.5 + edge + 0.045); // small home advantage
  const awayProb = remaining - homeProb;

  const overProb = 0.44 + next() * 0.16; // 0.44 .. 0.60
  const bttsProb = 0.45 + next() * 0.16;

  return {
    home: price(homeProb, margin),
    draw: drawPossible ? price(drawProb, margin) : null,
    away: price(awayProb, margin),
    over: price(overProb, margin),
    under: price(1 - overProb, margin),
    bttsYes: price(bttsProb, margin),
    bttsNo: price(1 - bttsProb, margin),
    line: "Total Goals 2.5",
  };
}

/** True when the provider gave us nothing usable for the main columns. */
export function isUnpriced(odds: MainOdds): boolean {
  return odds.home === null && odds.away === null;
}

type DerivedMarket = {
  name: string;
  outcomes: Array<{ label: string; odd: number; bookmaker: string; bookmakers: number }>;
};

/**
 * Full market list for an unpriced fixture, so the match detail page shows the
 * same prices the board shows instead of "no betting markets available".
 */
export function derivedMarkets(input: DerivedOddsInput): DerivedMarket[] {
  const o = derivedMainOdds(input);
  const out: DerivedMarket[] = [];
  const mk = (name: string, entries: Array<[string, number | null]>) => {
    const outcomes = entries
      .filter((e): e is [string, number] => typeof e[1] === "number")
      .map(([label, odd]) => ({ label, odd, bookmaker: "House", bookmakers: 1 }));
    if (outcomes.length) out.push({ name, outcomes });
  };

  mk("1X2", [
    ["1", o.home],
    ["X", o.draw],
    ["2", o.away],
  ]);
  if (o.draw !== null && o.home !== null && o.away !== null) {
    const dc = (a: number, b: number) =>
      Math.round(Math.max(1.01, 1 / (1 / a + 1 / b) * 1.03) * 100) / 100;
    mk("Double chance", [
      ["1X", dc(o.home, o.draw)],
      ["12", dc(o.home, o.away)],
      ["X2", dc(o.draw, o.away)],
    ]);
  }
  mk(o.line || "Total Goals 2.5", [
    ["Over 2.5", o.over],
    ["Under 2.5", o.under],
  ]);
  mk("Both teams to score", [
    ["Yes", o.bttsYes],
    ["No", o.bttsNo],
  ]);
  return out;
}

/**
 * Complete market grading engine.
 *
 * A verdict of `null` means "not decidable yet" — the leg stays pending.
 * `void` means the leg is refunded (odds are reset to 1.00 by the caller).
 *
 * The engine understands both shapes the app stores on a ticket:
 *  - real fixtures: `"Market name · Outcome"`, or a bare outcome (`"1"`, `"Over 2.5"`)
 *  - virtual soccer: `"TYPE|NAME"` (e.g. `1X2|1`, `U/O|O2.5`, `Correct score|2:1`)
 */

export type Score = { h: number; a: number };
export type Verdict = "won" | "lost" | "void" | null;

export type Snapshot = {
  /** Kick-off happened (or scores exist). */
  started: boolean;
  live: boolean;
  /** Regular completion (FT / AET / after pens). */
  finished: boolean;
  /** Postponed, cancelled, abandoned, interrupted — refund the leg. */
  postponed: boolean;
  /** Running (or final) score. */
  ft: Score | null;
  /** Half-time score when known. */
  ht: Score | null;
  /** Half time has been reached (so HT markets can settle). */
  htDone: boolean;
  home?: string;
  away?: string;
};

const yes = (b: boolean): Verdict => (b ? "won" : "lost");
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};

/** Statuses that mean "no result — give the money back". */
export const VOID_RE = /postp|cancel|abandon|interrupt|suspend|awarded|walkover|delayed/i;

/**
 * Statuses that mean the game is over. Covers regular time, extra time,
 * penalties and the "90+" style endings some providers report.
 */
export const FINISHED_RE =
  /finish|\bft\b|full.?time|ended|after\s*pen|after\s*et|\baet\b|\bap\b|\bft\.?\b|game\s*over|final/i;

export function isVoidStatus(status: string): boolean {
  return VOID_RE.test(status);
}

/** True when the provider status means the fixture has ended. */
export function isFinishedStatus(status: string): boolean {
  return FINISHED_RE.test(status) && !VOID_RE.test(status);
}


/* ------------------------------------------------------------------ */
/* market / outcome normalisation                                      */
/* ------------------------------------------------------------------ */

const VIRTUAL_MARKETS: Record<string, string> = {
  "1X2": "Full time result",
  "1X2HT": "Half time result",
  "U/O": "Over/Under",
  "Correct score": "Correct score",
  OTHER: "Any other result",
  Goal: "Both teams to score",
  "Goal HT": "Both teams to score 1st half",
};

/** Splits a stored pick into `{ market, outcome }`. */
export function parsePick(raw: string): { market: string; outcome: string } {
  const text = `${raw ?? ""}`.trim();
  if (text.includes("|")) {
    const [type = "", name = ""] = text.split("|");
    const market = VIRTUAL_MARKETS[type.trim()] ?? type.trim();
    const outcome = name.trim();
    if (type.trim() === "U/O") {
      const m = outcome.match(/^([UO])\s*(\d+(?:\.\d+)?)$/i);
      if (m) return { market, outcome: `${m[1]!.toUpperCase() === "O" ? "Over" : "Under"} ${m[2]}` };
    }
    if (/^goal/i.test(type.trim())) {
      return { market, outcome: /nogoal|no.?goal/i.test(outcome) ? "No" : "Yes" };
    }
    return { market, outcome };
  }
  if (text.includes("·")) {
    const [market = "", outcome = ""] = text.split("·");
    return { market: market.trim(), outcome: outcome.trim() };
  }
  return { market: "", outcome: text };
}

type Period = "FT" | "HT" | "2H";

function periodOf(market: string, outcome: string): Period {
  const s = `${market} ${outcome}`.toLowerCase();
  if (/\b(2nd|second)\s*half\b/.test(s)) return "2H";
  if (/\b(1st|first)\s*half\b|half\s*time|halftime|\bht\b|\b1h\b/.test(s)) return "HT";
  return "FT";
}

/** Score for the requested period, plus whether that period has completed. */
function periodScore(snap: Snapshot, period: Period): { score: Score | null; settled: boolean } {
  if (period === "HT") {
    return { score: snap.ht ?? (snap.htDone ? snap.ft : null), settled: snap.htDone };
  }
  if (period === "2H") {
    if (!snap.ft || !snap.ht) return { score: null, settled: false };
    return {
      score: { h: snap.ft.h - snap.ht.h, a: snap.ft.a - snap.ht.a },
      settled: snap.finished,
    };
  }
  return { score: snap.ft, settled: snap.finished };
}

const resultOf = (s: Score) => (s.h > s.a ? "1" : s.h === s.a ? "X" : "2");

/** Normalises an outcome label to 1 / X / 2 using team names when needed. */
function toSign(outcome: string, snap: Snapshot): "1" | "X" | "2" | null {
  const o = outcome.trim().toLowerCase();
  if (o === "1" || o === "w1" || o === "home" || o === "home win" || o === "1 (home)") return "1";
  if (o === "2" || o === "w2" || o === "away" || o === "away win") return "2";
  if (o === "x" || o === "draw" || o === "tie") return "X";
  if (snap.home && o === snap.home.toLowerCase()) return "1";
  if (snap.away && o === snap.away.toLowerCase()) return "2";
  return null;
}

/** Extracts a numeric line such as 2.5 from `Over 2.5` / `O2.5` / `+1.5`. */
function lineOf(text: string): number {
  const m = text.match(/(-?\d+(?:\.\d+)?)/);
  return m ? num(m[1]) : NaN;
}

/* ------------------------------------------------------------------ */
/* grading                                                             */
/* ------------------------------------------------------------------ */

export function gradeMarket(pick: string, snap: Snapshot): Verdict {
  if (snap.postponed) return "void";
  const { market, outcome } = parsePick(pick);
  if (!outcome) return null;

  const m = market.toLowerCase();
  const o = outcome.trim();
  const ol = o.toLowerCase();
  const period = periodOf(market, outcome);
  const { score, settled } = periodScore(snap, period);
  const total = score ? score.h + score.a : NaN;

  /* --- half time / full time combo ------------------------------- */
  if (/ht\s*\/\s*ft|half\s*time\s*\/\s*full/i.test(market)) {
    if (!snap.finished || !snap.ht || !snap.ft) return null;
    const combo = `${resultOf(snap.ht)}/${resultOf(snap.ft)}`;
    return yes(o.replace(/\s/g, "").toUpperCase() === combo);
  }

  /* --- correct score --------------------------------------------- */
  if (/correct score|exact score/i.test(market) || /^\d+\s*[:\-]\s*\d+$/.test(o)) {
    const parts = o.split(/[:\-]/).map((p) => num(p.trim()));
    if (parts.length !== 2 || parts.some(Number.isNaN)) return null;
    const [th, ta] = parts as [number, number];
    if (!score) return null;
    if (settled) return yes(score.h === th && score.a === ta);
    // Already impossible? settle the loss early.
    if (score.h > th || score.a > ta) return "lost";
    return null;
  }

  if (/any other/i.test(market) || /any other/i.test(o)) {
    if (!settled || !score) return null;
    const listed = ["0:0", "0:1", "0:2", "1:0", "1:1", "1:2", "2:0", "2:1", "2:2"];
    return yes(!listed.includes(`${score.h}:${score.a}`));
  }

  /* --- both teams to score --------------------------------------- */
  if (/both teams|btts|goal.?goal|gg\/ng/i.test(market) || /^(goal-goal|nogoal)$/i.test(ol)) {
    if (!score) return null;
    const wantYes = /^(yes|y|gg|goal-goal|both)/i.test(ol);
    const both = score.h > 0 && score.a > 0;
    if (both) return yes(wantYes);
    if (settled) return yes(!wantYes);
    return null;
  }

  /* --- totals (match or team) ------------------------------------- */
  if (/over|under|total|o\/u|goals/i.test(`${m} ${ol}`) && /(over|under|^o\s*\d|^u\s*\d)/i.test(ol)) {
    const line = lineOf(ol);
    if (Number.isNaN(line) || !score) return null;
    const isOver = /^o(ver)?\b|^o\d/i.test(ol);
    const teamScoped = /home|away|team\s*1|team\s*2/i.test(`${m} ${ol}`);
    let value = total;
    if (teamScoped) {
      const home = /home|team\s*1/i.test(`${m} ${ol}`);
      value = home ? score.h : score.a;
    }
    if (Number.isNaN(value)) return null;
    if (isOver && value > line) return "won"; // decided the moment the line is beaten
    if (!isOver && value > line) return "lost";
    if (settled) return yes(isOver ? value > line : value < line);
    return null;
  }

  /* --- odd / even -------------------------------------------------- */
  if (/odd|even/i.test(`${m} ${ol}`) && /^(odd|even)$/i.test(ol)) {
    if (!settled || !score) return null;
    return yes((total % 2 === 1) === /odd/i.test(ol));
  }

  /* --- handicap ----------------------------------------------------- */
  if (/handicap|spread|hcp|^ah/i.test(m) || /^[12]\s*\([-+]?\d/.test(ol)) {
    if (!settled || !score) return null;
    const sign = toSign(ol.replace(/\s*\(.*$/, ""), snap) ?? (/home/i.test(ol) ? "1" : /away/i.test(ol) ? "2" : null);
    const hcp = lineOf(ol.includes("(") ? ol.slice(ol.indexOf("(")) : ol);
    if (!sign || Number.isNaN(hcp)) return null;
    const margin = sign === "1" ? score.h - score.a : score.a - score.h;
    const adjusted = margin + hcp;
    if (Math.abs(adjusted) < 1e-9) return "void";
    return yes(adjusted > 0);
  }

  /* --- draw no bet ---------------------------------------------------- */
  if (/draw no bet|\bdnb\b/i.test(m)) {
    if (!settled || !score) return null;
    const sign = toSign(ol, snap);
    if (!sign) return null;
    const r = resultOf(score);
    if (r === "X") return "void";
    return yes(r === sign);
  }

  /* --- double chance --------------------------------------------------- */
  const dc = ol.replace(/\s/g, "").toUpperCase();
  if (/double chance/i.test(m) || ["1X", "X2", "12"].includes(dc)) {
    if (!settled || !score) return null;
    const r = resultOf(score);
    if (dc === "1X") return yes(r !== "2");
    if (dc === "X2") return yes(r !== "1");
    if (dc === "12") return yes(r !== "X");
    return null;
  }

  /* --- clean sheet / win to nil ----------------------------------------- */
  if (/clean sheet|win to nil/i.test(m)) {
    if (!settled || !score) return null;
    const home = /home|team\s*1|^1\b/i.test(ol) || (snap.home && ol.includes(snap.home.toLowerCase()));
    const conceded = home ? score.a : score.h;
    const scored = home ? score.h : score.a;
    const want = !/^no\b/i.test(ol);
    const hit = /win to nil/i.test(m) ? conceded === 0 && scored > conceded : conceded === 0;
    return yes(hit === want);
  }

  /* --- exact number of goals --------------------------------------------- */
  if (/exact goals|number of goals/i.test(m)) {
    if (!settled || !score) return null;
    const n = lineOf(ol);
    return Number.isNaN(n) ? null : yes(total === n);
  }

  /* --- plain match result (1X2 and friends) -------------------------------- */
  const sign = toSign(ol, snap);
  if (sign) {
    if (!settled || !score) return null;
    return yes(resultOf(score) === sign);
  }

  return null;
}

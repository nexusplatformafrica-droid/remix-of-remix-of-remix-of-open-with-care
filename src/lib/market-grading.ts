/**
 * Complete market grading engine.
 *
 * A verdict of `null` means "not decidable yet" — the leg stays pending.
 * `void` means the leg is refunded (odds are reset to 1.00 by the caller).
 *
 * The engine understands every shape the app stores on a ticket:
 *  - real fixtures: `"Market name · Outcome"`, `"Market name - Outcome"`,
 *    `"Market name: Outcome"` or a bare outcome (`"1"`, `"Over 2.5"`, `"GG"`)
 *  - virtual soccer: `"TYPE|NAME"` (e.g. `1X2|1`, `U/O|O2.5`, `Correct score|2:1`)
 *  - combinations: `"1 & Over 2.5"`, `"1X & GG"`, `"Over 2.5 & Yes"`
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
  "U/O HT": "Over/Under 1st half",
  "Correct score": "Correct score",
  "Correct score HT": "Correct score 1st half",
  OTHER: "Any other result",
  Goal: "Both teams to score",
  "Goal HT": "Both teams to score 1st half",
  DC: "Double chance",
  "DC HT": "Double chance 1st half",
  HT_FT: "Half time / Full time",
};

/** Splits a stored pick into `{ market, outcome }`. */
export function parsePick(raw: string): { market: string; outcome: string } {
  const text = `${raw ?? ""}`.trim();
  if (!text) return { market: "", outcome: "" };

  if (text.includes("|")) {
    const [type = "", name = ""] = text.split("|");
    const market = VIRTUAL_MARKETS[type.trim()] ?? type.trim();
    const outcome = name.trim();
    if (/^u\/o/i.test(type.trim())) {
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

  // "Both Teams To Score - Yes", "Total goals — Over 2.5", "Half time result - 1".
  // A bare "2 - 1" is a score line, not a market, so the left side must be words.
  const dash = text.match(/^(.{2,}?)\s+[-–—]\s+(.+)$/);
  if (dash && /[a-z]/i.test(dash[1]!)) {
    return { market: dash[1]!.trim(), outcome: dash[2]!.trim() };
  }

  const colon = text.match(/^([^:]{3,}?)\s*:\s*(.+)$/);
  if (colon && /[a-z]/i.test(colon[1]!) && /[a-z]/i.test(colon[2]!)) {
    return { market: colon[1]!.trim(), outcome: colon[2]!.trim() };
  }

  return { market: "", outcome: text };
}

type Period = "FT" | "HT" | "2H";

function periodOf(market: string, outcome: string): Period {
  const s = `${market} ${outcome}`.toLowerCase();
  if (/\b(2nd|second)\s*half\b|\b2h\b/.test(s)) return "2H";
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
  const o = outcome
    .trim()
    .toLowerCase()
    .replace(/\b(1st|first|2nd|second)\s*half\b|\bhalf\s*time\b|\bht\b|\bft\b|\bfull\s*time\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (["1", "w1", "home", "home win", "1 (home)", "home team", "team 1"].includes(o)) return "1";
  if (["2", "w2", "away", "away win", "2 (away)", "away team", "team 2"].includes(o)) return "2";
  if (["x", "draw", "tie", "level", "0"].includes(o)) return "X";
  if (snap.home && o === snap.home.toLowerCase()) return "1";
  if (snap.away && o === snap.away.toLowerCase()) return "2";
  return null;
}

/** Extracts a numeric line such as 2.5 from `Over 2.5` / `O2.5` / `+1.5`. */
function lineOf(text: string): number {
  const m = text.match(/(-?\+?\d+(?:\.\d+)?)/);
  return m ? num(m[1]!.replace("+", "")) : NaN;
}

/** Is this side of the pick about the home team? */
function isHomeSide(text: string, snap: Snapshot): boolean {
  const t = text.toLowerCase();
  if (snap.home && t.includes(snap.home.toLowerCase())) return true;
  if (snap.away && t.includes(snap.away.toLowerCase())) return false;
  return /home|team\s*1|\bh\b|^1\b/i.test(t);
}

/** Combines the verdicts of a combination bet (all parts must land). */
function combine(parts: Verdict[]): Verdict {
  if (parts.some((p) => p === "lost")) return "lost";
  if (parts.some((p) => p === null)) return null;
  return parts.every((p) => p === "void") ? "void" : "won";
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
  /** Everything we know about the pick — market names are often missing. */
  const hay = `${m} ${ol}`.trim();
  const period = periodOf(market, outcome);
  const { score, settled } = periodScore(snap, period);
  const total = score ? score.h + score.a : NaN;

  /* --- combination picks: "1 & Over 2.5", "1X & GG" ---------------- */
  if (/\s(&|\+|and)\s/i.test(o) && !/handicap/i.test(m)) {
    const parts = o.split(/\s(?:&|\+|and)\s/i).map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      return combine(parts.map((p) => gradeMarket(market ? `${market} · ${p}` : p, snap)));
    }
  }

  /* --- half time / full time combo ------------------------------- */
  if (/ht\s*\/\s*ft|half\s*time\s*\/\s*full|\bhtft\b/i.test(hay) && /[12x]\s*\/\s*[12x]/i.test(ol)) {
    if (!snap.finished || !snap.ht || !snap.ft) return null;
    const combo = `${resultOf(snap.ht)}/${resultOf(snap.ft)}`;
    return yes(o.replace(/\s/g, "").toUpperCase() === combo);
  }

  /* --- correct score --------------------------------------------- */
  if (/correct score|exact score|score exact/i.test(m) || /^\d+\s*[:\-]\s*\d+$/.test(o)) {
    const parts = o.split(/[:\-]/).map((p) => num(p.trim()));
    if (parts.length !== 2 || parts.some(Number.isNaN)) return null;
    const [th, ta] = parts as [number, number];
    if (!score) return null;
    if (settled) return yes(score.h === th && score.a === ta);
    // Already impossible? settle the loss early.
    if (score.h > th || score.a > ta) return "lost";
    return null;
  }

  if (/any other/i.test(hay)) {
    if (!settled || !score) return null;
    const listed = ["0:0", "0:1", "0:2", "1:0", "1:1", "1:2", "2:0", "2:1", "2:2"];
    return yes(!listed.includes(`${score.h}:${score.a}`));
  }

  /* --- both teams to score --------------------------------------- */
  const bttsMarket = /both teams|btts|goal.?goal|gg\/ng|\bgg\b|\bng\b/i.test(hay);
  if (bttsMarket) {
    if (!score) return null;
    const wantYes = /^(yes|y|gg|goal-goal|goalgoal|both)/i.test(ol) && !/^no|^ng/i.test(ol);
    const both = score.h > 0 && score.a > 0;
    if (both) return yes(wantYes);
    if (settled) return yes(!wantYes);
    return null;
  }

  /* --- multigoals: "2-3 goals", "Multigoals 1-2" ------------------ */
  if (/multi\s*goals?|goals?\s*range/i.test(hay) || /^\d\s*[-–]\s*\d\s*goals?$/i.test(ol)) {
    const r = ol.match(/(\d+)\s*[-–]\s*(\d+)/);
    if (!r || !score) return null;
    const lo = num(r[1]);
    const hi = num(r[2]);
    if (total > hi) return "lost";
    if (!settled) return null;
    return yes(total >= lo && total <= hi);
  }

  /* --- totals (match or team) ------------------------------------- */
  if (/(^|\s)(over|under)\b|^[ou]\s*\d|\bo\/u\b|total|goals\s*(over|under)/i.test(hay) && /(over|under|^o\s*\d|^u\s*\d)/i.test(ol)) {
    const line = lineOf(ol);
    if (Number.isNaN(line) || !score) return null;
    const isOver = /over|^o\s*\d|^o\d/i.test(ol);
    const teamScoped = /home|away|team\s*1|team\s*2/i.test(hay) ||
      !!(snap.home && hay.includes(snap.home.toLowerCase())) ||
      !!(snap.away && hay.includes(snap.away.toLowerCase()));
    let value = total;
    if (teamScoped) value = isHomeSide(hay, snap) ? score.h : score.a;
    if (Number.isNaN(value)) return null;
    if (Number.isInteger(line)) {
      // Whole-number lines push when the total lands exactly on the line.
      if (value > line) return isOver ? "won" : "lost";
      if (settled) return value === line ? "void" : isOver ? "lost" : "won";
      return null;
    }
    if (isOver && value > line) return "won"; // decided the moment the line is beaten
    if (!isOver && value > line) return "lost";
    if (settled) return yes(isOver ? value > line : value < line);
    return null;
  }

  /* --- odd / even -------------------------------------------------- */
  if (/^(odd|even)$/i.test(ol) || /odd\s*\/\s*even/i.test(m)) {
    if (!settled || !score) return null;
    return yes((total % 2 === 1) === /odd/i.test(ol));
  }

  /* --- handicap (Asian, European, quarter lines) --------------------- */
  if (/handicap|spread|hcp|\bah\b|^ah/i.test(m) || /^[12wx]?\s*\(?[-+]\d+(\.\d+)?\)?$/i.test(ol) || /^[12]\s*\([-+]?\d/.test(ol)) {
    if (!settled || !score) return null;
    const sideText = ol.replace(/\s*\(.*$/, "").replace(/[-+]\d+(\.\d+)?/, "").trim();
    const sign = toSign(sideText, snap) ?? (isHomeSide(hay, snap) ? "1" : "2");
    const hcp = lineOf(ol.includes("(") ? ol.slice(ol.indexOf("(")) : ol);
    if (!sign || Number.isNaN(hcp)) return null;
    const margin = sign === "1" ? score.h - score.a : score.a - score.h;
    const adjusted = margin + hcp;
    // Quarter lines split the stake; treat the half-loss/half-win as a push.
    if (Math.abs(adjusted) < 0.3) return adjusted > 0 ? "won" : adjusted < 0 ? "lost" : "void";
    return yes(adjusted > 0);
  }

  /* --- draw no bet ---------------------------------------------------- */
  if (/draw no bet|\bdnb\b/i.test(hay)) {
    if (!settled || !score) return null;
    const sign = toSign(ol.replace(/draw no bet|\bdnb\b/gi, "").trim(), snap);
    if (!sign) return null;
    const r = resultOf(score);
    if (r === "X") return "void";
    return yes(r === sign);
  }

  /* --- double chance --------------------------------------------------- */
  const dc = ol.replace(/[\s/]/g, "").toUpperCase();
  const dcNorm = dc === "X1" ? "1X" : dc === "2X" ? "X2" : dc === "21" ? "12" : dc;
  if (/double chance/i.test(m) || ["1X", "X2", "12"].includes(dcNorm)) {
    if (!settled || !score) return null;
    const r = resultOf(score);
    if (dcNorm === "1X") return yes(r !== "2");
    if (dcNorm === "X2") return yes(r !== "1");
    if (dcNorm === "12") return yes(r !== "X");
    return null;
  }

  /* --- clean sheet / win to nil ----------------------------------------- */
  if (/clean sheet|win to nil|to nil/i.test(hay)) {
    if (!settled || !score) return null;
    const home = isHomeSide(hay, snap);
    const conceded = home ? score.a : score.h;
    const scored = home ? score.h : score.a;
    const want = !/\bno\b/i.test(ol);
    const hit = /win to nil|to nil/i.test(hay) ? conceded === 0 && scored > conceded : conceded === 0;
    return yes(hit === want);
  }

  /* --- exact number of goals --------------------------------------------- */
  if (/exact goals|number of goals|exact total/i.test(hay)) {
    if (!settled || !score) return null;
    const n = lineOf(ol);
    return Number.isNaN(n) ? null : yes(total === n);
  }

  /* --- team to score / not to score --------------------------------------- */
  if (/to score|will score|scores/i.test(hay) && !/first|last|both teams/i.test(hay)) {
    if (!score) return null;
    const home = isHomeSide(hay, snap);
    const scored = home ? score.h : score.a;
    const want = !/\bno\b|not to score/i.test(ol);
    if (scored > 0) return yes(want);
    if (settled) return yes(!want);
    return null;
  }

  /* --- goal in both halves / score in both halves --------------------------- */
  if (/both halves/i.test(hay)) {
    if (!snap.ft || !snap.ht) return snap.finished ? null : null;
    const first = snap.ht.h + snap.ht.a;
    const second = snap.ft.h + snap.ft.a - first;
    const want = !/\bno\b/i.test(ol);
    if (/over|goal/i.test(hay)) {
      if (first > 0 && second > 0) return yes(want);
      if (snap.finished) return yes(!want);
      return null;
    }
    return null;
  }

  /* --- win either half ------------------------------------------------------- */
  if (/either half|win either/i.test(hay)) {
    if (!snap.finished || !snap.ft || !snap.ht) return null;
    const home = isHomeSide(hay, snap);
    const firstWin = home ? snap.ht.h > snap.ht.a : snap.ht.a > snap.ht.h;
    const s2h = { h: snap.ft.h - snap.ht.h, a: snap.ft.a - snap.ht.a };
    const secondWin = home ? s2h.h > s2h.a : s2h.a > s2h.h;
    return yes(firstWin || secondWin);
  }

  /* --- highest scoring half --------------------------------------------------- */
  if (/highest scoring half|most goals.*half/i.test(hay)) {
    if (!snap.finished || !snap.ft || !snap.ht) return null;
    const first = snap.ht.h + snap.ht.a;
    const second = snap.ft.h + snap.ft.a - first;
    const pickFirst = /1st|first/i.test(ol);
    const pickSecond = /2nd|second/i.test(ol);
    const pickEqual = /equal|tie|draw|same/i.test(ol);
    if (pickFirst) return yes(first > second);
    if (pickSecond) return yes(second > first);
    if (pickEqual) return yes(first === second);
    return null;
  }

  /* --- winning margin ---------------------------------------------------------- */
  if (/winning margin|margin of victory/i.test(hay)) {
    if (!settled || !score) return null;
    const n = lineOf(ol);
    if (Number.isNaN(n)) return null;
    return yes(Math.abs(score.h - score.a) === n);
  }

  /* --- plain match result (1X2 and friends) -------------------------------- */
  const sign = toSign(ol, snap);
  if (sign) {
    if (!settled || !score) return null;
    return yes(resultOf(score) === sign);
  }

  return null;
}

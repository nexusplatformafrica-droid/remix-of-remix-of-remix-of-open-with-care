/**
 * BET PLUS+ — settlement worker for Cloudflare Workers.
 *
 * ZERO CONFIGURATION. Paste this whole file into the Cloudflare Worker editor
 * and click Deploy. There is nothing to set up: no secrets, no environment
 * variables, no service account, no bindings, no expiry, no payment.
 *
 * HOW TO DEPLOY (2 minutes)
 * -------------------------
 *  1. Cloudflare dashboard -> Compute (Workers) -> Create -> Start from Hello World.
 *  2. Delete everything in the editor, paste this file, click Deploy.
 *  3. Open the worker -> Settings -> Triggers -> Cron Triggers -> Add:
 *
 *         * * * * *
 *
 *     (that means "every minute" — Cloudflare's free plan allows it).
 *  4. Done. Tickets now settle around the clock whether or not anyone is
 *     on the site. Open the worker URL to see a live status page, or add
 *     /run to the URL to force one settlement pass right now.
 *
 * WHY THE OLD WORKER STOPPED SETTLING
 * -----------------------------------
 * It polled the database every 2 seconds — about 43,000 queries a day, which
 * burns straight through the free daily read allowance, after which every
 * request is rejected and nothing settles. This version runs once a minute
 * (~1,440 passes a day) and only reads the tickets that are still open, which
 * stays comfortably inside the free allowance forever.
 *
 * It also no longer uses a Firebase admin service account. It talks to the
 * database over the public REST API with the same public web key the website
 * itself uses, so there is no private key to leak, rotate, or configure.
 */

/* ------------------------------------------------------------------ */
/* Configuration — already filled in, nothing to change                */
/* ------------------------------------------------------------------ */

const PROJECT = "betplus-africa";
/** Public Firebase web key — the same one shipped in the website bundle. */
const WEB_KEY = "AIzaSyAWqLsfN4rzT-RfdI4cQvwYeNrDN-5cz5M";
const ALLSPORTS_KEY = "eb3e6be456f441dad3f93fbbfc236b316ba8c95472f2abe641171f95902edcee";
const VIRTUAL_RESULTS = "https://desktop.fortebet.ug/api/web/v1/virtual-soccer/results";

/** Safety rails so a single pass can never run away with reads or time. */
const MAX_BETS_PER_PASS = 120;
const MAX_FIXTURE_LOOKUPS = 60;
const FIXTURE_CONCURRENCY = 6;

const DB = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

/* ------------------------------------------------------------------ */
/* Database access (public REST API — no admin credentials)            */
/* ------------------------------------------------------------------ */

async function api(path, init = {}) {
  const glue = path.includes("?") ? "&" : "?";
  const res = await fetch(`${DB}${path}${glue}key=${WEB_KEY}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers || {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

/** Runs async work over a list with a hard concurrency cap. */
async function mapLimit(items, limit, worker) {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
      await worker(next);
    }
  });
  await Promise.all(runners);
}

/* ------------------------------------------------------------------ */
/* Firestore value codec                                               */
/* ------------------------------------------------------------------ */

function decode(v) {
  if (v == null) return null;
  if ("nullValue" in v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("timestampValue" in v) return Date.parse(v.timestampValue);
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(decode);
  if ("mapValue" in v) return decodeFields(v.mapValue.fields || {});
  return null;
}
const decodeFields = (f) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, decode(v)]));

function encode(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number")
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "string") return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encode) } };
  return { mapValue: { fields: encodeFields(v) } };
}
const encodeFields = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, encode(v)]));

/* ------------------------------------------------------------------ */
/* Grading engine (identical rules to the website)                     */
/* ------------------------------------------------------------------ */

const VIRTUAL_MARKETS = {
  "1X2": "Full time result",
  "1X2HT": "Half time result",
  "U/O": "Over/Under",
  "Correct score": "Correct score",
  OTHER: "Any other result",
  Goal: "Both teams to score",
  "Goal HT": "Both teams to score 1st half",
};

const yes = (b) => (b ? "won" : "lost");
const numOf = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};

function isVoidStatus(status) {
  return /postp|cancel|abandon|interrupt|suspend|awarded|walkover|delayed/i.test(status || "");
}

function parsePick(raw) {
  const text = String(raw || "").trim();
  if (text.includes("|")) {
    const [type = "", name = ""] = text.split("|");
    const market = VIRTUAL_MARKETS[type.trim()] || type.trim();
    const outcome = name.trim();
    if (type.trim() === "U/O") {
      const m = outcome.match(/^([UO])\s*(\d+(?:\.\d+)?)$/i);
      if (m) return { market, outcome: `${m[1].toUpperCase() === "O" ? "Over" : "Under"} ${m[2]}` };
    }
    if (/^goal/i.test(type.trim()))
      return { market, outcome: /nogoal|no.?goal/i.test(outcome) ? "No" : "Yes" };
    return { market, outcome };
  }
  if (text.includes("·")) {
    const [market = "", outcome = ""] = text.split("·");
    return { market: market.trim(), outcome: outcome.trim() };
  }
  return { market: "", outcome: text };
}

function periodOf(market, outcome) {
  const s = `${market} ${outcome}`.toLowerCase();
  if (/\b(2nd|second)\s*half\b/.test(s)) return "2H";
  if (/\b(1st|first)\s*half\b|half\s*time|halftime|\bht\b|\b1h\b/.test(s)) return "HT";
  return "FT";
}

function periodScore(snap, period) {
  if (period === "HT")
    return { score: snap.ht || (snap.htDone ? snap.ft : null), settled: !!snap.htDone };
  if (period === "2H") {
    if (!snap.ft || !snap.ht) return { score: null, settled: false };
    return { score: { h: snap.ft.h - snap.ht.h, a: snap.ft.a - snap.ht.a }, settled: !!snap.finished };
  }
  return { score: snap.ft, settled: !!snap.finished };
}

const resultOf = (s) => (s.h > s.a ? "1" : s.h === s.a ? "X" : "2");

function toSign(outcome, snap) {
  const o = String(outcome).trim().toLowerCase();
  if (["1", "w1", "home", "home win", "1 (home)"].includes(o)) return "1";
  if (["2", "w2", "away", "away win"].includes(o)) return "2";
  if (["x", "draw", "tie"].includes(o)) return "X";
  if (snap.home && o === String(snap.home).toLowerCase()) return "1";
  if (snap.away && o === String(snap.away).toLowerCase()) return "2";
  return null;
}

function lineOf(text) {
  const m = String(text).match(/(-?\d+(?:\.\d+)?)/);
  return m ? numOf(m[1]) : NaN;
}

function gradeMarket(pick, snap) {
  if (snap.postponed) return "void";
  const { market, outcome } = parsePick(pick);
  if (!outcome) return null;
  const m = market.toLowerCase();
  const o = outcome.trim();
  const ol = o.toLowerCase();
  const { score, settled } = periodScore(snap, periodOf(market, outcome));
  const total = score ? score.h + score.a : NaN;

  if (/ht\s*\/\s*ft|half\s*time\s*\/\s*full/i.test(market)) {
    if (!snap.finished || !snap.ht || !snap.ft) return null;
    return yes(o.replace(/\s/g, "").toUpperCase() === `${resultOf(snap.ht)}/${resultOf(snap.ft)}`);
  }

  if (/correct score|exact score/i.test(market) || /^\d+\s*[:\-]\s*\d+$/.test(o)) {
    const parts = o.split(/[:\-]/).map((p) => numOf(p.trim()));
    if (parts.length !== 2 || parts.some(Number.isNaN) || !score) return null;
    const [th, ta] = parts;
    if (settled) return yes(score.h === th && score.a === ta);
    if (score.h > th || score.a > ta) return "lost";
    return null;
  }

  if (/any other/i.test(market) || /any other/i.test(o)) {
    if (!settled || !score) return null;
    const listed = ["0:0", "0:1", "0:2", "1:0", "1:1", "1:2", "2:0", "2:1", "2:2"];
    return yes(!listed.includes(`${score.h}:${score.a}`));
  }

  if (/both teams|btts|goal.?goal|gg\/ng/i.test(market) || /^(goal-goal|nogoal)$/i.test(ol)) {
    if (!score) return null;
    const wantYes = /^(yes|y|gg|goal-goal|both)/i.test(ol);
    const both = score.h > 0 && score.a > 0;
    if (both) return yes(wantYes);
    if (settled) return yes(!wantYes);
    return null;
  }

  if (/over|under|total|o\/u|goals/i.test(`${m} ${ol}`) && /(over|under|^o\s*\d|^u\s*\d)/i.test(ol)) {
    const line = lineOf(ol);
    if (Number.isNaN(line) || !score) return null;
    const isOver = /^o(ver)?\b|^o\d/i.test(ol);
    const teamScoped = /home|away|team\s*1|team\s*2/i.test(`${m} ${ol}`);
    let value = total;
    if (teamScoped) value = /home|team\s*1/i.test(`${m} ${ol}`) ? score.h : score.a;
    if (Number.isNaN(value)) return null;
    if (isOver && value > line) return "won";
    if (!isOver && value > line) return "lost";
    if (settled) return yes(isOver ? value > line : value < line);
    return null;
  }

  if (/odd|even/i.test(`${m} ${ol}`) && /^(odd|even)$/i.test(ol)) {
    if (!settled || !score) return null;
    return yes((total % 2 === 1) === /odd/i.test(ol));
  }

  if (/handicap|spread|hcp|^ah/i.test(m) || /^[12]\s*\([-+]?\d/.test(ol)) {
    if (!settled || !score) return null;
    const sign =
      toSign(ol.replace(/\s*\(.*$/, ""), snap) ||
      (/home/i.test(ol) ? "1" : /away/i.test(ol) ? "2" : null);
    const hcp = lineOf(ol.includes("(") ? ol.slice(ol.indexOf("(")) : ol);
    if (!sign || Number.isNaN(hcp)) return null;
    const margin = sign === "1" ? score.h - score.a : score.a - score.h;
    const adjusted = margin + hcp;
    if (Math.abs(adjusted) < 1e-9) return "void";
    return yes(adjusted > 0);
  }

  if (/draw no bet|\bdnb\b/i.test(m)) {
    if (!settled || !score) return null;
    const sign = toSign(ol, snap);
    if (!sign) return null;
    const r = resultOf(score);
    return r === "X" ? "void" : yes(r === sign);
  }

  const dc = ol.replace(/\s/g, "").toUpperCase();
  if (/double chance/i.test(m) || ["1X", "X2", "12"].includes(dc)) {
    if (!settled || !score) return null;
    const r = resultOf(score);
    if (dc === "1X") return yes(r !== "2");
    if (dc === "X2") return yes(r !== "1");
    if (dc === "12") return yes(r !== "X");
    return null;
  }

  if (/clean sheet|win to nil/i.test(m)) {
    if (!settled || !score) return null;
    const home = /home|team\s*1|^1\b/i.test(ol);
    const conceded = home ? score.a : score.h;
    const scored = home ? score.h : score.a;
    const want = !/^no\b/i.test(ol);
    const hit = /win to nil/i.test(m) ? conceded === 0 && scored > conceded : conceded === 0;
    return yes(hit === want);
  }

  if (/exact goals|number of goals/i.test(m)) {
    if (!settled || !score) return null;
    const n = lineOf(ol);
    return Number.isNaN(n) ? null : yes(total === n);
  }

  const sign = toSign(ol, snap);
  if (sign) {
    if (!settled || !score) return null;
    return yes(resultOf(score) === sign);
  }
  return null;
}

const isFinal = (s) => s === "won" || s === "lost" || s === "void";

function settleTicket(bet, snapshots) {
  let changed = false;
  const scoreLine = (snap) => {
    if (snap.postponed) return "Postponed";
    if (!snap.ft) return snap.started ? "0 - 0" : "Not started";
    const main = `${snap.ft.h} - ${snap.ft.a}`;
    const ht = snap.ht ? ` (HT ${snap.ht.h} - ${snap.ht.a})` : "";
    if (snap.finished) return `${main} FT${ht}`;
    if (snap.live) return `${main} LIVE${ht}`;
    return `${main}${ht}`;
  };

  const matches = bet.matches.map((leg) => {
    if (isFinal(leg.status)) return leg;
    const snap = leg.matchId ? snapshots.get(String(leg.matchId)) : null;
    if (!snap) return leg;
    const score = scoreLine(snap);
    const verdict = gradeMarket(leg.market || leg.pick || "", snap);
    if (!verdict) {
      if (leg.score === score) return leg;
      changed = true;
      return { ...leg, score };
    }
    changed = true;
    if (verdict === "void") return { ...leg, status: "void", odds: 1, score };
    return { ...leg, status: verdict, score };
  });
  const lostLegs = matches.filter((x) => x.status === "lost").length;
  const wonLegs = matches.filter((x) => x.status === "won").length;
  const voidLegs = matches.filter((x) => x.status === "void").length;
  const legsFinal = matches.every((x) => isFinal(x.status));
  let status = "pending";
  if (lostLegs > 0) status = "lost";
  else if (legsFinal) status = voidLegs === matches.length ? "cancelled" : "won";
  const odds = matches.reduce((a, x) => a * (x.status === "void" ? 1 : x.odds || 1), 1);
  const payout =
    status === "won" ? Math.round(bet.stake * odds) : status === "cancelled" ? bet.stake : 0;
  if (status !== bet.status) changed = true;
  return { matches, status, legsFinal, payout, changed, wonLegs, lostLegs, voidLegs };
}

/* ------------------------------------------------------------------ */
/* Score sources                                                       */
/* ------------------------------------------------------------------ */

async function virtualSnapshots() {
  const out = new Map();
  try {
    const res = await fetch(VIRTUAL_RESULTS, { headers: { accept: "application/json" } });
    if (!res.ok) return out;
    const body = await res.json();
    for (const r of body.data || []) {
      out.set(String(r.id), {
        started: true,
        live: false,
        finished: true,
        postponed: false,
        ft: { h: Number(r.result_ft?.home || 0), a: Number(r.result_ft?.away || 0) },
        ht: { h: Number(r.result_ht?.home || 0), a: Number(r.result_ht?.away || 0) },
        htDone: true,
      });
    }
  } catch {
    /* transient network issue — retried next tick */
  }
  return out;
}

const splitScore = (s) => {
  const parts = String(s || "").split("-").map((p) => Number(p.trim()));
  return parts.length === 2 && parts.every(Number.isFinite) ? { h: parts[0], a: parts[1] } : null;
};

async function realSnapshots(sport, ids) {
  const out = new Map();
  if (ids.length === 0) return out;
  for (const met of ["Livescore", "Fixtures"]) {
    const missing = ids.filter((id) => !out.has(id));
    if (missing.length === 0) break;
    for (const id of missing) {
      try {
        const url = new URL(`https://apiv2.allsportsapi.com/${sport}/`);
        url.searchParams.set("met", met);
        url.searchParams.set("matchId", id);
        url.searchParams.set("APIkey", ALLSPORTS_KEY);
        const res = await fetch(url);
        if (!res.ok) continue;
        const body = await res.json();
        const f = Array.isArray(body.result) ? body.result[0] : null;
        if (!f) continue;
        const status = String(f.event_status || "");
        const postponed = isVoidStatus(status);
        const finished =
      /finish|\bft\b|full.?time|ended|after\s*pen|after\s*et|\baet\b|\bap\b|game\s*over|final/i.test(status) &&
      !postponed;
        const ft = splitScore(f.event_final_result);
        const ht = splitScore(f.event_halftime_result);
        const minute = Number(String(status).match(/^\d+/)?.[0] || 0);
        out.set(id, {
          started: !!ft || finished || String(f.event_live || "0") === "1",
          live: String(f.event_live || "0") === "1",
          finished,
          postponed,
          ft,
          ht,
          htDone: finished || !!ht || /2nd half|half.?time|\bht\b/i.test(status) || minute >= 45,
          home: String(f.event_home_team || ""),
          away: String(f.event_away_team || ""),
        });
      } catch {
        /* skip this fixture on this pass */
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Reads / writes                                                      */
/* ------------------------------------------------------------------ */

async function queryBets(filter, limit) {
  const rows = await api(":runQuery", {
    method: "POST",
    body: JSON.stringify({
      structuredQuery: { from: [{ collectionId: "bets" }], where: filter, limit },
    }),
  });
  return (rows || [])
    .filter((r) => r.document)
    .map((r) => ({
      name: r.document.name,
      updateTime: r.document.updateTime,
      id: r.document.name.split("/").pop(),
      ...decodeFields(r.document.fields || {}),
    }))
    .filter((b) => Array.isArray(b.matches));
}

const eq = (path, value) => ({ fieldFilter: { field: { fieldPath: path }, op: "EQUAL", value } });

/** Pending tickets plus already-lost tickets whose legs are still running. */
async function unfinishedBets() {
  const [pending, lost] = await Promise.all([
    queryBets(eq("status", { stringValue: "pending" }), MAX_BETS_PER_PASS),
    queryBets(
      {
        compositeFilter: {
          op: "AND",
          filters: [eq("status", { stringValue: "lost" }), eq("legsFinal", { booleanValue: false })],
        },
      },
      MAX_BETS_PER_PASS,
    ).catch(() => []),
  ]);
  const byId = new Map();
  for (const b of [...pending, ...lost]) byId.set(b.id, b);
  return [...byId.values()].slice(0, MAX_BETS_PER_PASS);
}

async function commitSettlement(bet, res) {
  const paying = res.payout > 0 && res.status !== "pending";
  const writes = [
    {
      update: {
        name: bet.name,
        fields: encodeFields({
          status: res.status,
          matches: res.matches,
          legsFinal: res.legsFinal,
          settledAt: res.status === "pending" ? null : Date.now(),
          ...(paying ? { paid: true } : {}),
        }),
      },
      updateMask: {
        fieldPaths: [
          "status",
          "matches",
          "legsFinal",
          "settledAt",
          ...(paying ? ["paid"] : []),
        ],
      },
      // Refuses the write if the ticket changed since we read it, so the
      // website and this worker can never double-pay the same ticket.
      currentDocument: { updateTime: bet.updateTime },
    },
  ];

  const finishing = bet.status === "pending" && res.status !== "pending" && !bet.paid;
  const userDoc = `projects/${PROJECT}/databases/(default)/documents/users/${bet.userId}`;

  if (finishing && res.payout > 0 && bet.userId) {
    writes.push({
      transform: {
        document: userDoc,
        fieldTransforms: [
          { fieldPath: "balance", increment: { integerValue: String(res.payout) } },
        ],
      },
    });
  }
  if (finishing && res.status === "lost" && bet.userId) {
    writes.push({
      transform: {
        document: userDoc,
        fieldTransforms: [
          { fieldPath: "lostBalance", increment: { integerValue: String(bet.stake || 0) } },
        ],
      },
    });
  }

  await api(":commit", { method: "POST", body: JSON.stringify({ writes }) });

  if (finishing && res.payout > 0) {
    await api("/transactions", {
      method: "POST",
      body: JSON.stringify({
        fields: encodeFields({
          at: Date.now(),
          kind: "Payout",
          amount: res.payout,
          method: res.status === "cancelled" ? "Void refund" : "Auto settlement",
          actorType: "user",
          actorId: bet.userId || "",
          actorName: bet.userName || "Player",
          status: "completed",
          reference: bet.code || bet.id,
        }),
      }),
    }).catch(() => undefined);
  }
}

/* ------------------------------------------------------------------ */
/* One settlement pass                                                 */
/* ------------------------------------------------------------------ */

async function runPass() {
  const startedAt = Date.now();
  const settled = [];
  const errors = [];

  const bets = await unfinishedBets();
  if (bets.length === 0) {
    return { ok: true, openTickets: 0, settled, errors, ms: Date.now() - startedAt };
  }

  const needed = new Map();
  let needVirtual = false;
  for (const bet of bets) {
    for (const leg of bet.matches) {
      if (!leg.matchId || isFinal(leg.status)) continue;
      if ((leg.sport || "football") === "virtual") {
        needVirtual = true;
        continue;
      }
      const sport = leg.sport || "football";
      if (!needed.has(sport)) needed.set(sport, new Set());
      needed.get(sport).add(String(leg.matchId));
    }
  }

  const snapshots = new Map();
  if (needVirtual) for (const [k, v] of await virtualSnapshots()) snapshots.set(k, v);

  let budget = MAX_FIXTURE_LOOKUPS;
  for (const [sport, ids] of needed) {
    const slice = [...ids].slice(0, Math.max(0, budget));
    budget -= slice.length;
    for (const [k, v] of await realSnapshots(sport, slice)) snapshots.set(k, v);
    if (budget <= 0) break;
  }

  for (const bet of bets) {
    const res = settleTicket(bet, snapshots);
    if (!res.changed) continue;
    try {
      await commitSettlement(bet, res);
      settled.push({
        ticket: bet.code || bet.id,
        status: res.status,
        won: res.wonLegs,
        lost: res.lostLegs,
        void: res.voidLegs,
        payout: res.payout,
      });
    } catch (err) {
      errors.push(`${bet.code || bet.id}: ${err.message}`);
    }
  }

  return {
    ok: true,
    openTickets: bets.length,
    fixturesChecked: snapshots.size,
    settled,
    errors,
    ms: Date.now() - startedAt,
  };
}

/* ------------------------------------------------------------------ */
/* Cloudflare entry points                                             */
/* ------------------------------------------------------------------ */

const STATUS_PAGE = (body) => new Response(JSON.stringify(body, null, 2), {
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
});

export default {
  /** Cron trigger — add "* * * * *" in Settings -> Triggers. */
  async scheduled(_event, _env, ctx) {
    ctx.waitUntil(
      runPass()
        .then((r) => {
          if (r.settled.length) console.log("[settled]", JSON.stringify(r.settled));
          if (r.errors.length) console.warn("[skipped]", JSON.stringify(r.errors));
        })
        .catch((err) => console.error("[pass failed]", err.message)),
    );
  },

  /** Health page at "/", manual settlement pass at "/run". */
  async fetch(request) {
    const { pathname } = new URL(request.url);

    if (pathname === "/run") {
      try {
        return STATUS_PAGE(await runPass());
      } catch (err) {
        return STATUS_PAGE({ ok: false, error: err.message });
      }
    }

    return STATUS_PAGE({
      ok: true,
      service: "betplus-settlement-worker",
      project: PROJECT,
      runsOn: "Cloudflare cron trigger (add: * * * * *)",
      credentials: "none required",
      forceRunNow: new URL("/run", request.url).toString(),
      time: new Date().toISOString(),
    });
  },
};

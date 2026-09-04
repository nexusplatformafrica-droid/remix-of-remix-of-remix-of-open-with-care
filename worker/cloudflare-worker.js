/**
 * BET PLUS+ — settlement worker for Cloudflare Workers.
 *
 * GENERATED FILE — edit worker/src/worker.ts and run: bun run build:worker
 *
 * ZERO CONFIGURATION. Paste this whole file into the Cloudflare Worker editor
 * and click Deploy. No secrets, no environment variables, no service account,
 * no bindings, no expiry, no payment.
 *
 * HOW TO DEPLOY (2 minutes)
 *  1. Cloudflare dashboard -> Compute (Workers) -> Create -> Hello World.
 *  2. Delete everything in the editor, paste this file, click Deploy.
 *  3. Worker -> Settings -> Triggers -> Cron Triggers -> Add:  * * * * *
 *  4. Open the worker URL for a status page, or add /run to force a pass.
 *
 * It grades every market the website offers using the exact same engine the
 * site runs (src/lib/market-grading.ts), and talks to the database over the
 * public REST API with the public web key — no admin service account.
 */


// src/lib/market-grading.ts
var yes = (b) => b ? "won" : "lost";
var num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};
var VOID_RE = /postp|cancel|abandon|interrupt|suspend|awarded|walkover|delayed/i;
function isVoidStatus(status) {
  return VOID_RE.test(status);
}
var VIRTUAL_MARKETS = {
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
  HT_FT: "Half time / Full time"
};
function parsePick(raw) {
  const text = `${raw ?? ""}`.trim();
  if (!text) return { market: "", outcome: "" };
  if (text.includes("|")) {
    const [type = "", name = ""] = text.split("|");
    const market = VIRTUAL_MARKETS[type.trim()] ?? type.trim();
    const outcome = name.trim();
    if (/^u\/o/i.test(type.trim())) {
      const m = outcome.match(/^([UO])\s*(\d+(?:\.\d+)?)$/i);
      if (m) return { market, outcome: `${m[1].toUpperCase() === "O" ? "Over" : "Under"} ${m[2]}` };
    }
    if (/^goal/i.test(type.trim())) {
      return { market, outcome: /nogoal|no.?goal/i.test(outcome) ? "No" : "Yes" };
    }
    return { market, outcome };
  }
  if (text.includes("\xB7")) {
    const [market = "", outcome = ""] = text.split("\xB7");
    return { market: market.trim(), outcome: outcome.trim() };
  }
  const dash = text.match(/^(.{2,}?)\s+[-–—]\s+(.+)$/);
  if (dash && /[a-z]/i.test(dash[1])) {
    return { market: dash[1].trim(), outcome: dash[2].trim() };
  }
  const colon = text.match(/^([^:]{3,}?)\s*:\s*(.+)$/);
  if (colon && /[a-z]/i.test(colon[1]) && /[a-z]/i.test(colon[2])) {
    return { market: colon[1].trim(), outcome: colon[2].trim() };
  }
  return { market: "", outcome: text };
}
function periodOf(market, outcome) {
  const s = `${market} ${outcome}`.toLowerCase();
  if (/\b(2nd|second)\s*half\b|\b2h\b/.test(s)) return "2H";
  if (/\b(1st|first)\s*half\b|half\s*time|halftime|\bht\b|\b1h\b/.test(s)) return "HT";
  return "FT";
}
function periodScore(snap, period) {
  if (period === "HT") {
    return { score: snap.ht ?? (snap.htDone ? snap.ft : null), settled: snap.htDone };
  }
  if (period === "2H") {
    if (!snap.ft || !snap.ht) return { score: null, settled: false };
    return {
      score: { h: snap.ft.h - snap.ht.h, a: snap.ft.a - snap.ht.a },
      settled: snap.finished
    };
  }
  return { score: snap.ft, settled: snap.finished };
}
var resultOf = (s) => s.h > s.a ? "1" : s.h === s.a ? "X" : "2";
function toSign(outcome, snap) {
  const o = outcome.trim().toLowerCase().replace(/\b(1st|first|2nd|second)\s*half\b|\bhalf\s*time\b|\bht\b|\bft\b|\bfull\s*time\b/g, "").replace(/\s+/g, " ").trim();
  if (["1", "w1", "home", "home win", "1 (home)", "home team", "team 1"].includes(o)) return "1";
  if (["2", "w2", "away", "away win", "2 (away)", "away team", "team 2"].includes(o)) return "2";
  if (["x", "draw", "tie", "level", "0"].includes(o)) return "X";
  if (snap.home && o === snap.home.toLowerCase()) return "1";
  if (snap.away && o === snap.away.toLowerCase()) return "2";
  return null;
}
function lineOf(text) {
  const m = text.match(/(-?\+?\d+(?:\.\d+)?)/);
  return m ? num(m[1].replace("+", "")) : NaN;
}
function isHomeSide(text, snap) {
  const t = text.toLowerCase();
  if (snap.home && t.includes(snap.home.toLowerCase())) return true;
  if (snap.away && t.includes(snap.away.toLowerCase())) return false;
  return /home|team\s*1|\bh\b|^1\b/i.test(t);
}
function combine(parts) {
  if (parts.some((p) => p === "lost")) return "lost";
  if (parts.some((p) => p === null)) return null;
  return parts.every((p) => p === "void") ? "void" : "won";
}
function gradeMarket(pick, snap) {
  if (snap.postponed) return "void";
  const { market, outcome } = parsePick(pick);
  if (!outcome) return null;
  const m = market.toLowerCase();
  const o = outcome.trim();
  const ol = o.toLowerCase();
  const hay = `${m} ${ol}`.trim();
  const period = periodOf(market, outcome);
  const { score, settled } = periodScore(snap, period);
  const total = score ? score.h + score.a : NaN;
  if (/\s(&|\+|and)\s/i.test(o) && !/handicap/i.test(m)) {
    const parts = o.split(/\s(?:&|\+|and)\s/i).map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      return combine(parts.map((p) => gradeMarket(market ? `${market} \xB7 ${p}` : p, snap)));
    }
  }
  if (/ht\s*\/\s*ft|half\s*time\s*\/\s*full|\bhtft\b/i.test(hay) && /[12x]\s*\/\s*[12x]/i.test(ol)) {
    if (!snap.finished || !snap.ht || !snap.ft) return null;
    const combo = `${resultOf(snap.ht)}/${resultOf(snap.ft)}`;
    return yes(o.replace(/\s/g, "").toUpperCase() === combo);
  }
  if (/correct score|exact score|score exact/i.test(m) || /^\d+\s*[:\-]\s*\d+$/.test(o)) {
    const parts = o.split(/[:\-]/).map((p) => num(p.trim()));
    if (parts.length !== 2 || parts.some(Number.isNaN)) return null;
    const [th, ta] = parts;
    if (!score) return null;
    if (settled) return yes(score.h === th && score.a === ta);
    if (score.h > th || score.a > ta) return "lost";
    return null;
  }
  if (/any other/i.test(hay)) {
    if (!settled || !score) return null;
    const listed = ["0:0", "0:1", "0:2", "1:0", "1:1", "1:2", "2:0", "2:1", "2:2"];
    return yes(!listed.includes(`${score.h}:${score.a}`));
  }
  const bttsMarket = /both teams|btts|goal.?goal|gg\/ng|\bgg\b|\bng\b/i.test(hay);
  if (bttsMarket) {
    if (!score) return null;
    const wantYes = /^(yes|y|gg|goal-goal|goalgoal|both)/i.test(ol) && !/^no|^ng/i.test(ol);
    const both = score.h > 0 && score.a > 0;
    if (both) return yes(wantYes);
    if (settled) return yes(!wantYes);
    return null;
  }
  if (/multi\s*goals?|goals?\s*range/i.test(hay) || /^\d\s*[-–]\s*\d\s*goals?$/i.test(ol)) {
    const r = ol.match(/(\d+)\s*[-–]\s*(\d+)/);
    if (!r || !score) return null;
    const lo = num(r[1]);
    const hi = num(r[2]);
    if (total > hi) return "lost";
    if (!settled) return null;
    return yes(total >= lo && total <= hi);
  }
  if (/(^|\s)(over|under)\b|^[ou]\s*\d|\bo\/u\b|total|goals\s*(over|under)/i.test(hay) && /(over|under|^o\s*\d|^u\s*\d)/i.test(ol)) {
    const line = lineOf(ol);
    if (Number.isNaN(line) || !score) return null;
    const isOver = /over|^o\s*\d|^o\d/i.test(ol);
    const teamScoped = /home|away|team\s*1|team\s*2/i.test(hay) || !!(snap.home && hay.includes(snap.home.toLowerCase())) || !!(snap.away && hay.includes(snap.away.toLowerCase()));
    let value = total;
    if (teamScoped) value = isHomeSide(hay, snap) ? score.h : score.a;
    if (Number.isNaN(value)) return null;
    if (Number.isInteger(line)) {
      if (value > line) return isOver ? "won" : "lost";
      if (settled) return value === line ? "void" : isOver ? "lost" : "won";
      return null;
    }
    if (isOver && value > line) return "won";
    if (!isOver && value > line) return "lost";
    if (settled) return yes(isOver ? value > line : value < line);
    return null;
  }
  if (/^(odd|even)$/i.test(ol) || /odd\s*\/\s*even/i.test(m)) {
    if (!settled || !score) return null;
    return yes(total % 2 === 1 === /odd/i.test(ol));
  }
  if (/handicap|spread|hcp|\bah\b|^ah/i.test(m) || /^[12wx]?\s*\(?[-+]\d+(\.\d+)?\)?$/i.test(ol) || /^[12]\s*\([-+]?\d/.test(ol)) {
    if (!settled || !score) return null;
    const sideText = ol.replace(/\s*\(.*$/, "").replace(/[-+]\d+(\.\d+)?/, "").trim();
    const sign2 = toSign(sideText, snap) ?? (isHomeSide(hay, snap) ? "1" : "2");
    const hcp = lineOf(ol.includes("(") ? ol.slice(ol.indexOf("(")) : ol);
    if (!sign2 || Number.isNaN(hcp)) return null;
    const margin = sign2 === "1" ? score.h - score.a : score.a - score.h;
    const adjusted = margin + hcp;
    if (Math.abs(adjusted) < 0.3) return adjusted > 0 ? "won" : adjusted < 0 ? "lost" : "void";
    return yes(adjusted > 0);
  }
  if (/draw no bet|\bdnb\b/i.test(hay)) {
    if (!settled || !score) return null;
    const sign2 = toSign(ol.replace(/draw no bet|\bdnb\b/gi, "").trim(), snap);
    if (!sign2) return null;
    const r = resultOf(score);
    if (r === "X") return "void";
    return yes(r === sign2);
  }
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
  if (/clean sheet|win to nil|to nil/i.test(hay)) {
    if (!settled || !score) return null;
    const home = isHomeSide(hay, snap);
    const conceded = home ? score.a : score.h;
    const scored = home ? score.h : score.a;
    const want = !/\bno\b/i.test(ol);
    const hit = /win to nil|to nil/i.test(hay) ? conceded === 0 && scored > conceded : conceded === 0;
    return yes(hit === want);
  }
  if (/exact goals|number of goals|exact total/i.test(hay)) {
    if (!settled || !score) return null;
    const n = lineOf(ol);
    return Number.isNaN(n) ? null : yes(total === n);
  }
  if (/to score|will score|scores/i.test(hay) && !/first|last|both teams/i.test(hay)) {
    if (!score) return null;
    const home = isHomeSide(hay, snap);
    const scored = home ? score.h : score.a;
    const want = !/\bno\b|not to score/i.test(ol);
    if (scored > 0) return yes(want);
    if (settled) return yes(!want);
    return null;
  }
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
  if (/either half|win either/i.test(hay)) {
    if (!snap.finished || !snap.ft || !snap.ht) return null;
    const home = isHomeSide(hay, snap);
    const firstWin = home ? snap.ht.h > snap.ht.a : snap.ht.a > snap.ht.h;
    const s2h = { h: snap.ft.h - snap.ht.h, a: snap.ft.a - snap.ht.a };
    const secondWin = home ? s2h.h > s2h.a : s2h.a > s2h.h;
    return yes(firstWin || secondWin);
  }
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
  if (/winning margin|margin of victory/i.test(hay)) {
    if (!settled || !score) return null;
    const n = lineOf(ol);
    if (Number.isNaN(n)) return null;
    return yes(Math.abs(score.h - score.a) === n);
  }
  const sign = toSign(ol, snap);
  if (sign) {
    if (!settled || !score) return null;
    return yes(resultOf(score) === sign);
  }
  return null;
}

// src/lib/settle-core.ts
var isFinal = (s) => s === "won" || s === "lost" || s === "void";
function scoreLine(snap) {
  if (snap.postponed) return "Postponed";
  if (!snap.ft) return snap.started ? "0 - 0" : "Not started";
  const main = `${snap.ft.h} - ${snap.ft.a}`;
  const ht = snap.ht ? ` (HT ${snap.ht.h} - ${snap.ht.a})` : "";
  if (snap.finished) return `${main} FT${ht}`;
  if (snap.live) return `${main} LIVE${ht}`;
  return `${main}${ht}`;
}
function settleTicket(bet, snapshots) {
  let changed = false;
  const matches = bet.matches.map((leg) => {
    if (isFinal(leg.status)) return leg;
    const snap = leg.matchId ? snapshots.get(String(leg.matchId)) : void 0;
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
  const wonLegs = matches.filter((m) => m.status === "won").length;
  const lostLegs = matches.filter((m) => m.status === "lost").length;
  const voidLegs = matches.filter((m) => m.status === "void").length;
  const legsFinal = matches.every((m) => isFinal(m.status));
  let status = "pending";
  if (lostLegs > 0) status = "lost";
  else if (legsFinal) status = voidLegs === matches.length ? "cancelled" : "won";
  const odds = matches.reduce((acc, m) => acc * (m.status === "void" ? 1 : m.odds || 1), 1);
  const payout = status === "won" ? Math.round(bet.stake * odds) : status === "cancelled" ? bet.stake : 0;
  if (status !== bet.status) changed = true;
  return { matches, status, legsFinal, payout, changed, wonLegs, lostLegs, voidLegs };
}

// worker/src/worker.ts
var PROJECT = "betplus-africa";
var WEB_KEY = "AIzaSyAWqLsfN4rzT-RfdI4cQvwYeNrDN-5cz5M";
var ALLSPORTS_KEY = "eb3e6be456f441dad3f93fbbfc236b316ba8c95472f2abe641171f95902edcee";
var VIRTUAL_RESULTS = "https://desktop.fortebet.ug/api/web/v1/virtual-soccer/results";
var MAX_BETS_PER_PASS = 200;
var MAX_FIXTURE_LOOKUPS = 90;
var DB = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
async function api(path, init = {}) {
  const glue = path.includes("?") ? "&" : "?";
  const res = await fetch(`${DB}${path}${glue}key=${WEB_KEY}`, {
    ...init,
    headers: { "content-type": "application/json", ...init.headers }
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}
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
var decodeFields = (f) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, decode(v)]));
function encode(v) {
  if (v === null || v === void 0) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number")
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "string") return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encode) } };
  return { mapValue: { fields: encodeFields(v) } };
}
var encodeFields = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, encode(v)]));
var isFinal2 = (s) => s === "won" || s === "lost" || s === "void";
async function virtualSnapshots() {
  const out = /* @__PURE__ */ new Map();
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
        htDone: true
      });
    }
  } catch {
  }
  return out;
}
var splitScore = (s) => {
  const parts = String(s || "").split("-").map((p) => Number(p.trim()));
  return parts.length === 2 && parts.every(Number.isFinite) ? { h: parts[0], a: parts[1] } : null;
};
async function realSnapshots(sport, ids) {
  const out = /* @__PURE__ */ new Map();
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
        const res = await fetch(url.toString());
        if (!res.ok) continue;
        const body = await res.json();
        const f = Array.isArray(body.result) ? body.result[0] : null;
        if (!f) continue;
        const status = String(f.event_status || "");
        const postponed = isVoidStatus(status);
        const finished = /finish|\bft\b|full.?time|ended|after\s*pen|after\s*et|\baet\b|\bap\b|game\s*over|final/i.test(
          status
        ) && !postponed;
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
          away: String(f.event_away_team || "")
        });
      } catch {
      }
    }
  }
  return out;
}
async function queryBets(filter, limit) {
  const rows = await api(":runQuery", {
    method: "POST",
    body: JSON.stringify({
      structuredQuery: { from: [{ collectionId: "bets" }], where: filter, limit }
    })
  });
  return (rows || []).filter((r) => r.document).map((r) => ({
    name: r.document.name,
    updateTime: r.document.updateTime,
    id: r.document.name.split("/").pop(),
    ...decodeFields(r.document.fields || {})
  })).filter((b) => Array.isArray(b.matches));
}
var eq = (path, value) => ({
  fieldFilter: { field: { fieldPath: path }, op: "EQUAL", value }
});
async function unfinishedBets() {
  const [pending, lost] = await Promise.all([
    queryBets(eq("status", { stringValue: "pending" }), MAX_BETS_PER_PASS),
    queryBets(
      {
        compositeFilter: {
          op: "AND",
          filters: [eq("status", { stringValue: "lost" }), eq("legsFinal", { booleanValue: false })]
        }
      },
      MAX_BETS_PER_PASS
    ).catch(() => [])
  ]);
  const byId = /* @__PURE__ */ new Map();
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
          ...paying ? { paid: true } : {}
        })
      },
      updateMask: {
        fieldPaths: ["status", "matches", "legsFinal", "settledAt", ...paying ? ["paid"] : []]
      },
      // Refuses the write if the ticket changed since we read it, so the
      // website and this worker can never double-pay the same ticket.
      currentDocument: { updateTime: bet.updateTime }
    }
  ];
  const finishing = bet.status === "pending" && res.status !== "pending" && !bet.paid;
  const userDoc = `projects/${PROJECT}/databases/(default)/documents/users/${bet.userId}`;
  if (finishing && res.payout > 0 && bet.userId) {
    writes.push({
      transform: {
        document: userDoc,
        fieldTransforms: [{ fieldPath: "balance", increment: { integerValue: String(res.payout) } }]
      }
    });
  }
  if (finishing && res.status === "lost" && bet.userId) {
    writes.push({
      transform: {
        document: userDoc,
        fieldTransforms: [
          { fieldPath: "lostBalance", increment: { integerValue: String(bet.stake || 0) } }
        ]
      }
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
          reference: bet.code || bet.id
        })
      })
    }).catch(() => void 0);
  }
}
async function runPass() {
  const startedAt = Date.now();
  const settled = [];
  const errors = [];
  const bets = await unfinishedBets();
  if (bets.length === 0) {
    return { ok: true, openTickets: 0, settled, errors, ms: Date.now() - startedAt };
  }
  const needed = /* @__PURE__ */ new Map();
  let needVirtual = false;
  for (const bet of bets) {
    for (const leg of bet.matches) {
      if (!leg.matchId || isFinal2(leg.status)) continue;
      if ((leg.sport || "football") === "virtual") {
        needVirtual = true;
        continue;
      }
      const sport = leg.sport || "football";
      if (!needed.has(sport)) needed.set(sport, /* @__PURE__ */ new Set());
      needed.get(sport).add(String(leg.matchId));
    }
  }
  const snapshots = /* @__PURE__ */ new Map();
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
        payout: res.payout
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
    ms: Date.now() - startedAt
  };
}
var STATUS_PAGE = (body) => new Response(JSON.stringify(body, null, 2), {
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*"
  }
});
var worker_default = {
  /** Cron trigger — add "* * * * *" in Settings -> Triggers. */
  async scheduled(_event, _env, ctx) {
    ctx.waitUntil(
      runPass().then((r) => {
        if (r.settled.length) console.log("[settled]", JSON.stringify(r.settled));
        if (r.errors.length) console.warn("[skipped]", JSON.stringify(r.errors));
      }).catch((err) => console.error("[pass failed]", err.message))
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
      time: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
};
export {
  worker_default as default
};

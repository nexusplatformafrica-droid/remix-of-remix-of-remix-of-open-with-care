/**
 * BET PLUS+ — settlement worker source.
 *
 * The pasteable single file is generated from this source with:
 *     bun run build:worker      ->  worker/cloudflare-worker.js
 *
 * It shares the exact grading engine the website uses (src/lib/market-grading
 * and src/lib/settle-core), so a leg can never settle differently in the two
 * places.
 */
import { isVoidStatus, type Snapshot } from "../../src/lib/market-grading";
import { settleTicket } from "../../src/lib/settle-core";
import type { Bet, BetMatch } from "../../src/lib/admin-types";

/* ------------------------------------------------------------------ */
/* Configuration — already filled in, nothing to change                */
/* ------------------------------------------------------------------ */

const PROJECT = "betplus-africa";
/** Public Firebase web key — the same one shipped in the website bundle. */
const WEB_KEY = "AIzaSyAWqLsfN4rzT-RfdI4cQvwYeNrDN-5cz5M";
const ALLSPORTS_KEY = "eb3e6be456f441dad3f93fbbfc236b316ba8c95472f2abe641171f95902edcee";
const VIRTUAL_RESULTS = "https://desktop.fortebet.ug/api/web/v1/virtual-soccer/results";

/** Safety rails so a single pass can never run away with reads or time. */
const MAX_BETS_PER_PASS = 200;
const MAX_FIXTURE_LOOKUPS = 90;

const DB = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

/* ------------------------------------------------------------------ */
/* Database access (public REST API — no admin credentials)            */
/* ------------------------------------------------------------------ */

type Json = Record<string, unknown>;

async function api(path: string, init: RequestInit = {}): Promise<any> {
  const glue = path.includes("?") ? "&" : "?";
  const res = await fetch(`${DB}${path}${glue}key=${WEB_KEY}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers as Json) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

/* ------------------------------------------------------------------ */
/* Firestore value codec                                               */
/* ------------------------------------------------------------------ */

function decode(v: any): any {
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
const decodeFields = (f: Json): any =>
  Object.fromEntries(Object.entries(f).map(([k, v]) => [k, decode(v)]));

function encode(v: unknown): any {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number")
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "string") return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encode) } };
  return { mapValue: { fields: encodeFields(v as Json) } };
}
const encodeFields = (o: Json): any =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, encode(v)]));

const isFinal = (s: string) => s === "won" || s === "lost" || s === "void";

/* ------------------------------------------------------------------ */
/* Score sources                                                       */
/* ------------------------------------------------------------------ */

async function virtualSnapshots(): Promise<Map<string, Snapshot>> {
  const out = new Map<string, Snapshot>();
  try {
    const res = await fetch(VIRTUAL_RESULTS, { headers: { accept: "application/json" } });
    if (!res.ok) return out;
    const body: any = await res.json();
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

const splitScore = (s: unknown): { h: number; a: number } | null => {
  const parts = String(s || "")
    .split("-")
    .map((p) => Number(p.trim()));
  return parts.length === 2 && parts.every(Number.isFinite)
    ? { h: parts[0]!, a: parts[1]! }
    : null;
};

async function realSnapshots(sport: string, ids: string[]): Promise<Map<string, Snapshot>> {
  const out = new Map<string, Snapshot>();
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
        const body: any = await res.json();
        const f = Array.isArray(body.result) ? body.result[0] : null;
        if (!f) continue;
        const status = String(f.event_status || "");
        const postponed = isVoidStatus(status);
        const finished =
          /finish|\bft\b|full.?time|ended|after\s*pen|after\s*et|\baet\b|\bap\b|game\s*over|final/i.test(
            status,
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

type StoredBet = Bet & {
  name: string;
  updateTime: string;
  paid?: boolean;
  userName?: string;
  matches: BetMatch[];
};

async function queryBets(filter: Json, limit: number): Promise<StoredBet[]> {
  const rows: any[] = await api(":runQuery", {
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
    .filter((b: any) => Array.isArray(b.matches)) as StoredBet[];
}

const eq = (path: string, value: Json) => ({
  fieldFilter: { field: { fieldPath: path }, op: "EQUAL", value },
});

/** Pending tickets plus already-lost tickets whose legs are still running. */
async function unfinishedBets(): Promise<StoredBet[]> {
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
  const byId = new Map<string, StoredBet>();
  for (const b of [...pending, ...lost]) byId.set(b.id, b);
  return [...byId.values()].slice(0, MAX_BETS_PER_PASS);
}

async function commitSettlement(bet: StoredBet, res: ReturnType<typeof settleTicket>) {
  const paying = res.payout > 0 && res.status !== "pending";
  const writes: Json[] = [
    {
      update: {
        name: bet.name,
        fields: encodeFields({
          status: res.status,
          matches: res.matches as unknown as Json[],
          legsFinal: res.legsFinal,
          settledAt: res.status === "pending" ? null : Date.now(),
          ...(paying ? { paid: true } : {}),
        }),
      },
      updateMask: {
        fieldPaths: ["status", "matches", "legsFinal", "settledAt", ...(paying ? ["paid"] : [])],
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
        fieldTransforms: [{ fieldPath: "balance", increment: { integerValue: String(res.payout) } }],
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
  const settled: Json[] = [];
  const errors: string[] = [];

  const bets = await unfinishedBets();
  if (bets.length === 0) {
    return { ok: true, openTickets: 0, settled, errors, ms: Date.now() - startedAt };
  }

  const needed = new Map<string, Set<string>>();
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
      needed.get(sport)!.add(String(leg.matchId));
    }
  }

  const snapshots = new Map<string, Snapshot>();
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
      errors.push(`${bet.code || bet.id}: ${(err as Error).message}`);
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

const STATUS_PAGE = (body: unknown) =>
  new Response(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    },
  });

export default {
  /** Cron trigger — add "* * * * *" in Settings -> Triggers. */
  async scheduled(_event: unknown, _env: unknown, ctx: { waitUntil: (p: Promise<unknown>) => void }) {
    ctx.waitUntil(
      runPass()
        .then((r) => {
          if (r.settled.length) console.log("[settled]", JSON.stringify(r.settled));
          if (r.errors.length) console.warn("[skipped]", JSON.stringify(r.errors));
        })
        .catch((err: Error) => console.error("[pass failed]", err.message)),
    );
  },

  /** Health page at "/", manual settlement pass at "/run". */
  async fetch(request: Request) {
    const { pathname } = new URL(request.url);

    if (pathname === "/run") {
      try {
        return STATUS_PAGE(await runPass());
      } catch (err) {
        return STATUS_PAGE({ ok: false, error: (err as Error).message });
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

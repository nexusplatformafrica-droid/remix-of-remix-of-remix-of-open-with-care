/**
 * Maintenance helpers for the always-on settlement worker.
 *
 * The worker caches a live score line on every open leg (`match.score`) so the
 * ticket can show how the game is going. Once a match is over that cached text
 * is dead weight — it is what filled the database up. These helpers delete that
 * saved polling data.
 *
 * They never touch ticket status, leg verdicts, stakes, odds, payouts or
 * balances: a settled ticket stays settled, exactly as it was.
 */
import { collection, getDocs, query, where, writeBatch } from "firebase/firestore";
import { firebase } from "./firebase";
import { COL } from "./firestore-db";
import type { Bet, BetMatch } from "./admin-types";

export type CleanupResult = { scanned: number; changed: number; removed: number };

const FINAL = new Set(["won", "lost", "void"]);

async function commitInChunks(
  ops: Array<(batch: ReturnType<typeof writeBatch>) => void>,
): Promise<void> {
  const { db } = await firebase();
  for (let i = 0; i < ops.length; i += 400) {
    const batch = writeBatch(db);
    for (const op of ops.slice(i, i + 400)) op(batch);
    await batch.commit();
  }
}

/**
 * Strips the cached score text the worker saved.
 *
 * @param scope `"settled"` — only tickets that are already finished.
 *              `"completed-legs"` — every leg whose match is over, on any ticket
 *              (open tickets keep the cache on legs that are still running).
 */
export async function clearSavedScores(
  scope: "settled" | "completed-legs",
): Promise<CleanupResult> {
  const { db } = await firebase();
  const snap = await getDocs(collection(db, COL.bets));
  const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];
  let removed = 0;

  snap.forEach((docSnap) => {
    const bet = docSnap.data() as Bet;
    if (!Array.isArray(bet.matches)) return;
    const ticketDone = bet.status !== "pending";
    if (scope === "settled" && !ticketDone) return;

    let touched = false;
    const matches: BetMatch[] = bet.matches.map((leg) => {
      const legDone = FINAL.has(leg.status);
      const strip = scope === "settled" ? ticketDone : legDone;
      if (!strip || !leg.score) return leg;
      touched = true;
      removed += 1;
      const { score: _drop, ...rest } = leg;
      return rest as BetMatch;
    });

    if (touched) ops.push((batch) => batch.update(docSnap.ref, { matches }));
  });

  await commitInChunks(ops);
  return { scanned: snap.size, changed: ops.length, removed };
}

/**
 * Deletes the ledger rows the settlement worker wrote ("Auto settlement" and
 * "Void refund" payout entries). Tickets, statuses and player balances are not
 * touched — only the log rows.
 */
export async function deleteWorkerLedgerRows(beforeMs?: number): Promise<CleanupResult> {
  const { db } = await firebase();
  const rows = await getDocs(
    query(collection(db, COL.transactions), where("kind", "==", "Payout")),
  );
  const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];

  rows.forEach((docSnap) => {
    const tx = docSnap.data() as { method?: string; at?: number };
    const fromWorker = tx.method === "Auto settlement" || tx.method === "Void refund";
    if (!fromWorker) return;
    if (beforeMs && (tx.at ?? 0) >= beforeMs) return;
    ops.push((batch) => batch.delete(docSnap.ref));
  });

  await commitInChunks(ops);
  return { scanned: rows.size, changed: ops.length, removed: ops.length };
}

/** Counts what a cleanup would remove, without writing anything. */
export async function previewCleanup(): Promise<{
  tickets: number;
  settledTickets: number;
  cachedScores: number;
  completedLegScores: number;
  workerLedgerRows: number;
}> {
  const { db } = await firebase();
  const [bets, txs] = await Promise.all([
    getDocs(collection(db, COL.bets)),
    getDocs(query(collection(db, COL.transactions), where("kind", "==", "Payout"))),
  ]);

  let settledTickets = 0;
  let cachedScores = 0;
  let completedLegScores = 0;

  bets.forEach((docSnap) => {
    const bet = docSnap.data() as Bet;
    if (!Array.isArray(bet.matches)) return;
    const done = bet.status !== "pending";
    if (done) settledTickets += 1;
    for (const leg of bet.matches) {
      if (!leg.score) continue;
      if (done) cachedScores += 1;
      if (FINAL.has(leg.status)) completedLegScores += 1;
    }
  });

  let workerLedgerRows = 0;
  txs.forEach((docSnap) => {
    const tx = docSnap.data() as { method?: string };
    if (tx.method === "Auto settlement" || tx.method === "Void refund") workerLedgerRows += 1;
  });

  return {
    tickets: bets.size,
    settledTickets,
    cachedScores,
    completedLegScores,
    workerLedgerRows,
  };
}

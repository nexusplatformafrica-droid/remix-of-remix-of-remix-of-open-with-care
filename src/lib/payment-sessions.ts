import {
  addDoc,
  collection,
  doc,
  increment,
  onSnapshot,
  query,
  runTransaction,
  updateDoc,
  where,
} from "firebase/firestore";
import { firebase } from "./firebase";
import { minDepositFor } from "./payments";
import { COL, pushTransaction, siteDoc } from "./firestore-db";

export const PAYMENT_SESSIONS = "payment_sessions";

export type PaymentSession = {
  id: string;
  userId: string;
  userName: string;
  kind: "deposit" | "withdraw";
  amount: number;
  currency: string;
  method: string;
  msisdn: string;
  reference: string;
  internalReference: string;
  status: "pending" | "success" | "failed";
  /** True once the wallet effect (credit / refund) has been applied — never repeat. */
  settled: boolean;
  at: number;
  updatedAt: number;
  message?: string;
};

export async function createPaymentSession(
  input: Omit<PaymentSession, "id" | "at" | "updatedAt" | "status" | "settled"> & {
    status?: PaymentSession["status"];
  },
): Promise<string> {
  const { db } = await firebase();
  const now = Date.now();
  const ref = await addDoc(collection(db, PAYMENT_SESSIONS), {
    status: "pending" as const,
    settled: false,
    at: now,
    updatedAt: now,
    ...input,
  });
  return ref.id;
}

export async function patchPaymentSession(
  id: string,
  patch: Partial<PaymentSession>,
): Promise<void> {
  const { db } = await firebase();
  await updateDoc(doc(db, PAYMENT_SESSIONS, id), { ...patch, updatedAt: Date.now() });
}

/** Live feed of the signed-in player's unfinished payment sessions. */
export function watchPendingSessions(
  userId: string,
  cb: (sessions: PaymentSession[]) => void,
): () => void {
  let stop = () => {};
  void firebase().then(({ db }) => {
    stop = onSnapshot(
      // Filter on userId only, then screen locally: older rows may predate the
      // `settled` flag and a server-side equality pair can silently return
      // nothing, which used to leave real deposits unpolled forever.
      query(collection(db, PAYMENT_SESSIONS), where("userId", "==", userId)),
      (snap) =>
        cb(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as PaymentSession)
            .filter((s) => s.settled !== true && (s.status ?? "pending") === "pending")
            .sort((a, b) => b.at - a.at),
        ),
      () => cb([]),
    );
  });
  return () => stop();
}

/**
 * Applies the wallet effect of a finished payment exactly once.
 * Deposits credit on success; withdrawals were held at request time and are
 * refunded when the payout fails.
 */
export async function settlePaymentSession(
  session: PaymentSession,
  outcome: "success" | "failed",
  message = "",
): Promise<"applied" | "skipped"> {
  const { db } = await firebase();
  const sessionRef = doc(db, PAYMENT_SESSIONS, session.id);
  const userRef = doc(db, COL.users, session.userId);

  let firstDepositBonus = 0;

  const applied = await runTransaction(db, async (tx) => {
    const snap = await tx.get(sessionRef);
    if (!snap.exists()) return false;
    const current = snap.data() as PaymentSession;
    if (current.settled) return false;

    if (session.kind === "deposit" && outcome === "success") {
      // First real deposit earns the provider minimum for that currency as a
      // non-withdrawable bonus — stake only, never cashable.
      const userSnap = await tx.get(userRef);
      const user = (userSnap.data() ?? {}) as { totalIn?: number; firstDepositBonusAt?: number };
      const isFirst = !user.firstDepositBonusAt && !(Number(user.totalIn) > 0);
      firstDepositBonus = isFirst ? minDepositFor(session.currency) : 0;

      tx.update(userRef, {
        balance: increment(session.amount),
        totalIn: increment(session.amount),
        lastSeen: Date.now(),
        ...(firstDepositBonus > 0
          ? { bonusBalance: increment(firstDepositBonus), firstDepositBonusAt: Date.now() }
          : {}),
      });
    }
    if (session.kind === "withdraw" && outcome === "failed") {
      // Release the hold taken when the payout was requested.
      tx.update(userRef, { balance: increment(session.amount) });
    }
    if (session.kind === "withdraw" && outcome === "success") {
      tx.update(userRef, { totalOut: increment(session.amount) });
    }

    tx.update(sessionRef, {
      status: outcome,
      settled: true,
      message,
      updatedAt: Date.now(),
    });
    return true;
  });

  if (!applied) return "skipped";

  const float = session.kind === "deposit" ? session.amount : -session.amount;
  if (outcome === "success") {
    await updateDoc(siteDoc(db, "wallet"), { siteFloat: increment(float) }).catch(() => undefined);
  }

  if (outcome === "success") {
    await pushTransaction({
      kind: session.kind === "deposit" ? "Deposit" : "Withdrawal",
      amount: session.kind === "deposit" ? session.amount : -session.amount,
      method: `${session.method} · ${session.currency}`,
      actorType: "user",
      actorId: session.userId,
      actorName: session.userName,
      status: "completed",
      reference: session.reference,
    });
    if (firstDepositBonus > 0) {
      await pushTransaction({
        kind: "Bonus",
        amount: firstDepositBonus,
        method: `First deposit bonus · ${session.currency}`,
        actorType: "user",
        actorId: session.userId,
        actorName: session.userName,
        status: "completed",
        reference: `${session.reference}-BONUS`,
      });
    }
  } else {
    await pushTransaction({
      kind: session.kind === "deposit" ? "Deposit" : "Withdrawal",
      amount: 0,
      method: `${session.method} · ${session.currency}`,
      actorType: "user",
      actorId: session.userId,
      actorName: session.userName,
      status: "failed",
      reference: session.reference,
    });
  }
  return "applied";
}

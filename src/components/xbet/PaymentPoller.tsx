import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAuth } from "./AuthContext";
import {
  settlePaymentSession,
  watchPendingSessions,
  type PaymentSession,
} from "@/lib/payment-sessions";
import {
  checkRequestStatus,
  findProviderTransaction,
  formatMoney,
  readStatus,
  type RequestStatus,
} from "@/lib/payments";

const POLL_MS = 3000;
/** Hard stop: only after a full day do we give up and mark a payment failed. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
/** A request the provider has never heard of after this long never started. */
const UNKNOWN_GRACE_MS = 10 * 60 * 1000;

/**
 * Asks the provider what happened to one payment.
 * Falls back to the provider's transaction list (matched on our own reference)
 * whenever the internal reference is missing or unknown to the status API.
 */
async function resolveStatus(
  session: PaymentSession,
): Promise<{ state: RequestStatus | "unknown"; message: string }> {
  if (session.internalReference) {
    const res = await checkRequestStatus(session.internalReference);
    if (res.ok) {
      const state = readStatus(res.data);
      if (state !== "pending") return { state, message: String(res.data.message ?? "") };
      return { state: "pending", message: "" };
    }
  }
  const hit = await findProviderTransaction(session.reference);
  if (!hit) return { state: "unknown", message: "" };
  const state = readStatus({ status: hit.status ?? "" });
  return { state, message: String(hit.status ?? "") };
}

/**
 * Resumes and drives every unfinished payment for the signed-in player.
 * It runs on every page, survives refreshes and never credits a session twice.
 */
export function PaymentPoller() {
  const { user } = useAuth();
  const sessionsRef = useRef<PaymentSession[]>([]);
  const workingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) {
      sessionsRef.current = [];
      return;
    }
    const stop = watchPendingSessions(user.id, (list) => {
      sessionsRef.current = list;
    });
    return stop;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let alive = true;

    const tick = async () => {
      for (const session of sessionsRef.current) {
        if (!alive) return;
        if (workingRef.current.has(session.id)) continue;
        workingRef.current.add(session.id);
        try {
          const age = Date.now() - session.at;
          const { state, message } = await resolveStatus(session);

          if (state === "unknown") {
            // Nothing reached the provider at all — only give up once it is
            // clear no push notification will ever arrive.
            if (age > UNKNOWN_GRACE_MS) {
              await settlePaymentSession(session, "failed", "No provider record");
            }
            continue;
          }
          if (state === "pending") {
            if (age > MAX_AGE_MS) {
              await settlePaymentSession(session, "failed", "Payment timed out");
              toast.error("Payment timed out", {
                description: `${session.kind === "deposit" ? "Deposit" : "Withdrawal"} ${formatMoney(session.amount, session.currency)}`,
              });
            }
            continue;
          }
          const applied = await settlePaymentSession(session, state, message);
          if (applied === "applied") {
            if (state === "success") {
              toast.success(
                session.kind === "deposit"
                  ? `Deposit confirmed — ${formatMoney(session.amount, session.currency)} added`
                  : `Withdrawal of ${formatMoney(session.amount, session.currency)} sent`,
                { description: session.method },
              );
            } else {
              toast.error(
                session.kind === "deposit"
                  ? "Deposit failed"
                  : "Withdrawal failed — your money was returned",
                { description: message || session.method },
              );
            }
          }
        } catch {
          /* network hiccup — retried on the next tick */
        } finally {
          workingRef.current.delete(session.id);
        }
      }
    };

    const timer = setInterval(() => void tick(), POLL_MS);
    void tick();
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [user]);

  return null;
}

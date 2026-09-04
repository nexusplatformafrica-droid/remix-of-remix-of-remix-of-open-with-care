import { createFileRoute } from "@tanstack/react-router";
import { firebaseConfig } from "@/lib/firebase-config";
import { ROYAL } from "@/lib/royal-config";

/**
 * Wallet API implemented for the Royal Fortune RGS.
 * Paths: /balance, /debit, /credit, /rollback (all POST, HMAC signed).
 */

const BASE = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`;
const KEY = firebaseConfig.apiKey;

type FsValue = { integerValue?: string; doubleValue?: number; stringValue?: string; booleanValue?: boolean };
type FsDoc = { fields?: Record<string, FsValue> };

const num = (v: FsValue | undefined) => (v === undefined ? 0 : Number(v.integerValue ?? v.doubleValue ?? 0));
const round2 = (n: number) => Math.round(n * 100) / 100;

async function getDoc(path: string): Promise<FsDoc | null> {
  const res = await fetch(`${BASE}/${path}?key=${KEY}`);
  if (!res.ok) return null;
  return (await res.json()) as FsDoc;
}

async function patchDoc(path: string, fields: Record<string, FsValue>) {
  const mask = Object.keys(fields)
    .map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`)
    .join("&");
  await fetch(`${BASE}/${path}?key=${KEY}&${mask}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fields }),
  });
}

async function hmacHex(secret: string, body: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export const Route = createFileRoute("/api/public/royal/wallet/$")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const secret = process.env["ROYAL_API_SECRET"] || ROYAL.secret;
        const expectedOperator = process.env["ROYAL_OPERATOR_ID"] || ROYAL.operatorId;

        const operator = request.headers.get("x-rgs-operator") ?? "";
        if (operator !== expectedOperator) return json({ error: "unknown operator", code: "UNKNOWN_OPERATOR" }, 401);

        const raw = await request.text();
        const header = (request.headers.get("x-rgs-signature") ?? "").toLowerCase();
        const provided = header.startsWith("sha256=") ? header.slice(7) : header;
        const expected = await hmacHex(secret, raw);
        if (!timingSafeEqual(provided, expected)) {
          return json({ error: "invalid signature", code: "INVALID_SIGNATURE" }, 401);
        }

        let payload: {
          playerId?: string;
          currency?: string;
          amount?: number;
          roundId?: string;
          idempotencyKey?: string;
          type?: string;
        };
        try {
          payload = JSON.parse(raw || "{}");
        } catch {
          return json({ error: "invalid body", code: "INVALID_BODY" }, 400);
        }

        const action = String(params._splat ?? "").replace(/^\/+|\/+$/g, "");
        const playerId = payload.playerId;
        if (!playerId) return json({ error: "missing playerId", code: "INVALID_PAYLOAD" }, 400);

        const currency = payload.currency ?? ROYAL.currency;
        const userPath = `users/${encodeURIComponent(playerId)}`;
        const user = await getDoc(userPath);
        if (!user) return json({ error: "unknown player", code: "PLAYER_NOT_FOUND" }, 404);

        let cash = num(user.fields?.["balance"]);
        let bonus = num(user.fields?.["bonusBalance"]);
        const spendable = () => round2(cash + bonus);

        if (action === "balance") return json({ balance: spendable(), currency });

        if (action !== "debit" && action !== "credit" && action !== "rollback") {
          return json({ error: "unknown endpoint", code: "NOT_FOUND" }, 404);
        }

        const amount = round2(Number(payload.amount ?? 0));
        if (!Number.isFinite(amount) || amount <= 0) {
          return json({ error: "invalid amount", code: "INVALID_AMOUNT" }, 400);
        }

        const idem = payload.idempotencyKey || (payload.roundId ? `${payload.roundId}-${action}` : "");
        if (!idem) return json({ error: "missing idempotencyKey", code: "MISSING_IDEMPOTENCY_KEY" }, 400);
        const refPath = `royal_refs/${encodeURIComponent(idem)}`;

        // Idempotency: replaying a key returns the original result, no money moves.
        const seen = await getDoc(refPath);
        if (seen) {
          return json({
            balance: num(seen.fields?.["balance"]),
            currency,
            transactionId: idem,
          });
        }

        if (action === "debit") {
          if (spendable() < amount) {
            return json({ error: "insufficient funds", code: "INSUFFICIENT_FUNDS" }, 402);
          }
          const fromBonus = Math.min(bonus, amount);
          bonus = round2(bonus - fromBonus);
          cash = round2(cash - (amount - fromBonus));
        } else {
          // credit and rollback both return money to the cash balance
          cash = round2(cash + amount);
        }

        await patchDoc(userPath, {
          balance: { doubleValue: cash },
          bonusBalance: { doubleValue: bonus },
        });
        await patchDoc(refPath, {
          balance: { doubleValue: spendable() },
          player: { stringValue: playerId },
          action: { stringValue: action },
          amount: { doubleValue: amount },
          roundId: { stringValue: payload.roundId ?? "" },
          at: { doubleValue: Date.now() },
        });

        await fetch(`${BASE}/transactions?key=${KEY}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            fields: {
              at: { doubleValue: Date.now() },
              userId: { stringValue: playerId },
              type: { stringValue: action === "debit" ? "bet" : "win" },
              method: { stringValue: "Royal Fortune" },
              amount: { doubleValue: action === "debit" ? -amount : amount },
              status: { stringValue: "completed" },
              note: { stringValue: `Royal Fortune ${payload.type ?? action}` },
            },
          }),
        });

        return json({ balance: spendable(), currency, transactionId: idem });
      },
    },
  },
});

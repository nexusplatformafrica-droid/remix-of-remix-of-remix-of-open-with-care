import { useEffect, useState } from "react";
import { PAY_COUNTRIES, walletBalance } from "./payments";

export const FLOAT_CURRENCIES = Array.from(
  new Set(PAY_COUNTRIES.flatMap((c) => [c.currency, c.altCurrency?.currency ?? ""])),
).filter(Boolean);

type Balances = Record<string, number | null>;

let cache: Balances = {};
const listeners = new Set<(b: Balances) => void>();
let timer: ReturnType<typeof setInterval> | null = null;

async function refresh() {
  const entries = await Promise.all(
    FLOAT_CURRENCIES.map(async (cur) => {
      try {
        const res = await walletBalance(cur);
        const value = Number(res.data.balance);
        return [cur, res.ok && Number.isFinite(value) ? value : null] as const;
      } catch {
        return [cur, null] as const;
      }
    }),
  );
  cache = Object.fromEntries(entries);
  listeners.forEach((l) => l(cache));
}

/**
 * Live provider float per currency, shared by every admin screen so the
 * "website balance" is always the real money held with the payment provider.
 */
export function useProviderBalances() {
  const [balances, setBalances] = useState<Balances>(cache);

  useEffect(() => {
    listeners.add(setBalances);
    void refresh();
    if (!timer) timer = setInterval(() => void refresh(), 30_000);
    return () => {
      listeners.delete(setBalances);
      if (listeners.size === 0 && timer) {
        clearInterval(timer);
        timer = null;
      }
    };
  }, []);

  const loaded = Object.values(balances).some((v) => v !== null);
  return { balances, ugx: balances["UGX"] ?? null, loaded, refresh };
}

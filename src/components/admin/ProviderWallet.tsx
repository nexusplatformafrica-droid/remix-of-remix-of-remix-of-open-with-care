import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Btn, Field, Panel, Stat, Table, downloadCsv, inputCls } from "@/components/admin/ui";
import {
  DEFAULT_COUNTRY,
  PAY_COUNTRIES,
  checkRequestStatus,
  countryByCode,
  formatMoney,
  limitsFor,
  makeReference,
  methodsFor,
  providerTransactions,
  readStatus,
  requestWithdraw,
  toMsisdn,
  walletBalance,
  type ProviderTransaction,
} from "@/lib/payments";

const CURRENCIES = Array.from(
  new Set(PAY_COUNTRIES.flatMap((c) => [c.currency, c.altCurrency?.currency ?? ""])),
).filter(Boolean);

/** Live provider float per currency plus real payouts and the provider ledger. */
export function ProviderWallet() {
  const [balances, setBalances] = useState<Record<string, number | null>>({});
  const [txs, setTxs] = useState<ProviderTransaction[]>([]);
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [currency, setCurrency] = useState(DEFAULT_COUNTRY.currency);
  const [msisdn, setMsisdn] = useState("");
  const [amount, setAmount] = useState(10000);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("all");

  const refresh = useCallback(async () => {
    const entries = await Promise.all(
      CURRENCIES.map(async (cur) => {
        try {
          const res = await walletBalance(cur);
          const value = Number(res.data.balance);
          return [cur, res.ok && Number.isFinite(value) ? value : null] as const;
        } catch {
          return [cur, null] as const;
        }
      }),
    );
    setBalances(Object.fromEntries(entries));
    try {
      const res = await providerTransactions();
      const list = res.data.transactions ?? res.data.data ?? [];
      setTxs(Array.isArray(list) ? list : []);
    } catch {
      /* keep last list */
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(timer);
  }, [refresh]);

  const payout = async () => {
    const method = methodsFor(country, "withdraw")[0]!;
    const limits = limitsFor(country, method, currency);
    if (!(amount >= limits.min && amount <= limits.max)) {
      toast.error(
        `Amount must be between ${formatMoney(limits.min, currency)} and ${formatMoney(limits.max, currency)}`,
      );
      return;
    }
    const target = toMsisdn(msisdn, country);
    if (target.replace(/\D/g, "").length < 11) {
      toast.error("Enter a valid mobile money number");
      return;
    }
    setBusy(true);
    const reference = makeReference("ADMW");
    try {
      const res = await requestWithdraw({
        msisdn: target,
        amount,
        currency,
        reference,
        description: "Admin payout",
      });
      if (!res.ok) throw new Error(String(res.data.message ?? res.data.error ?? "Payout rejected"));
      const internal = String(res.data.internal_reference ?? "");
      toast.success("Payout submitted", { description: reference });
      // Poll every second until the provider gives a final answer.
      let tries = 0;
      const poll = setInterval(async () => {
        tries += 1;
        if (!internal || tries > 300) {
          clearInterval(poll);
          return;
        }
        const status = await checkRequestStatus(internal);
        const state = readStatus(status.data);
        if (state === "pending") return;
        clearInterval(poll);
        void refresh();
        if (state === "success") toast.success(`Payout ${reference} completed`);
        else toast.error(`Payout ${reference} failed`, { description: String(status.data.message ?? "") });
      }, 1000);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const visible = txs.filter((t) => filter === "all" || (t.currency ?? "").toUpperCase() === filter);

  return (
    <div className="space-y-2 md:space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5 md:gap-3">
        {CURRENCIES.map((cur) => (
          <Stat
            key={cur}
            label={`Live ${cur} balance`}
            value={balances[cur] === null || balances[cur] === undefined ? "—" : formatMoney(balances[cur]!, cur)}
            tone="green"
          />
        ))}
      </div>

      <div className="grid gap-2 md:gap-3 xl:grid-cols-2">
        <Panel title="Real payout from provider wallet">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Country">
              <select
                className={inputCls}
                value={country.code}
                onChange={(e) => {
                  const next = countryByCode(e.target.value) ?? DEFAULT_COUNTRY;
                  setCountry(next);
                  setCurrency(next.currency);
                }}
              >
                {PAY_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Currency">
              <select className={inputCls} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option value={country.currency}>{country.currency}</option>
                {country.altCurrency && (
                  <option value={country.altCurrency.currency}>{country.altCurrency.currency}</option>
                )}
              </select>
            </Field>
            <Field label={`Mobile money number (${country.dial})`}>
              <input
                className={inputCls}
                value={msisdn}
                onChange={(e) => setMsisdn(e.target.value.replace(/[^\d+]/g, ""))}
                placeholder="700000000"
              />
            </Field>
            <Field label="Amount">
              <input
                type="number"
                className={inputCls}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </Field>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Btn tone="red" onClick={() => void payout()} disabled={busy}>
              {busy ? "Sending…" : "Send payout"}
            </Btn>
            <Btn onClick={() => void refresh()}>Refresh balances</Btn>
          </div>
        </Panel>

        <Panel title="Provider transactions">
          <div className="flex flex-wrap gap-2">
            <select className={`${inputCls} w-40`} value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All currencies</option>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <Btn
              onClick={() =>
                downloadCsv("provider-transactions.csv", [
                  ["Reference", "MSISDN", "Type", "Amount", "Currency", "Status", "When"],
                  ...visible.map((t) => [
                    t.customer_reference ?? t.reference ?? t.internal_reference ?? "",
                    t.msisdn ?? "",
                    t.type ?? "",
                    t.amount ?? 0,
                    t.currency ?? "",
                    t.status ?? "",
                    t.created_at ?? "",
                  ]),
                ])
              }
            >
              Export
            </Btn>
          </div>
          <div className="mt-2 max-h-72 overflow-auto">
            <Table head={["Reference", "Number", "Type", "Amount", "Status"]}>
              {visible.slice(0, 60).map((t, i) => (
                <tr key={`${t.internal_reference ?? t.reference ?? i}`} className="border-b border-xb-line/60 last:border-0">
                  <td className="px-2 py-1.5 font-bold text-xb-blue">
                    {t.customer_reference ?? t.reference ?? t.internal_reference ?? "—"}
                  </td>
                  <td className="px-2 py-1.5 text-xb-text-muted">{t.msisdn ?? "—"}</td>
                  <td className="px-2 py-1.5">{t.type ?? "—"}</td>
                  <td className="px-2 py-1.5 font-bold">
                    {formatMoney(Number(t.amount ?? 0), t.currency ?? "UGX")}
                  </td>
                  <td className="px-2 py-1.5">{t.status ?? "—"}</td>
                </tr>
              ))}
            </Table>
            {visible.length === 0 && (
              <p className="p-2 text-[11px] text-xb-text-muted">No provider transactions returned yet.</p>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

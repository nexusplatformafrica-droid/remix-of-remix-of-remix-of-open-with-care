import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useAdmin } from "@/components/admin/AdminDataContext";
import { ProviderWallet } from "@/components/admin/ProviderWallet";
import { betPayout } from "@/lib/admin-seed";
import { Btn, Field, Panel, Stat, Table, downloadCsv, inputCls, timeAgo, ugx } from "@/components/admin/ui";
import { useProviderBalances } from "@/lib/provider-float";

export const Route = createFileRoute("/admin/wallet")({ component: WalletPage });

function WalletPage() {
  const { state, adjustFloat, adjustUserBalance } = useAdmin();
  const { ugx: realFloat } = useProviderBalances();
  const [amount, setAmount] = useState(100000);
  const [q, setQ] = useState("");
  const [userAmount, setUserAmount] = useState(10000);

  const playerWallets = state.users.reduce((a, u) => a + u.balance, 0);
  const pending = state.bets.filter((b) => b.status === "pending").reduce((a, b) => a + betPayout(b), 0);
  const matches = state.users.filter((u) => {
    const n = q.trim().toLowerCase();
    return n ? [u.name, u.phone, u.email, u.id].some((v) => v.toLowerCase().includes(n)) : false;
  });

  return (
    <div className="space-y-2 md:space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <Stat label="Website balance (live)" value={realFloat === null ? "—" : ugx(realFloat)} tone="green" big />
        <Stat label="All player wallets" value={ugx(playerWallets)} tone="blue" big />
        <Stat label="Pending ticket liability" value={ugx(pending)} tone="blue" big />
        <Stat label="Net position" value={realFloat === null ? "—" : ugx(realFloat - playerWallets - pending)} big />
      </div>

      <ProviderWallet />



      <div className="grid gap-2 md:gap-3 xl:grid-cols-2">
        <Panel title="Website float">
          <Field label="Amount (UGX)">
            <input type="number" className={inputCls} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </Field>
          <div className="mt-2 flex flex-wrap gap-2">
            <Btn tone="green" onClick={() => { adjustFloat(Math.abs(amount), "Bank transfer", "Deposit to site float"); toast.success("Deposited"); }}>
              Deposit
            </Btn>
            <Btn tone="red" onClick={() => { adjustFloat(-Math.abs(amount), "Bank transfer", "Withdrawal from site float"); toast.success("Withdrawn"); }}>
              Withdraw
            </Btn>
            <Btn
              onClick={() =>
                downloadCsv("wallet-transactions.csv", [
                  ["Ref", "When", "Actor", "Type", "Amount", "Method", "Status"],
                  ...state.transactions.map((t) => [t.reference, new Date(t.at).toISOString(), t.actorName, t.kind, t.amount, t.method, t.status]),
                ])
              }
            >
              Export transactions
            </Btn>
          </div>
        </Panel>

        <Panel title="Add / remove money for players">
          <div className="flex flex-wrap gap-2">
            <input className={`${inputCls} min-w-[180px] flex-1`} placeholder="Search player by name, phone, ID…" value={q} onChange={(e) => setQ(e.target.value)} />
            <input type="number" className={`${inputCls} w-32`} value={userAmount} onChange={(e) => setUserAmount(Number(e.target.value))} />
          </div>
          <div className="mt-2 max-h-64 overflow-auto">
            {matches.length === 0 ? (
              <p className="p-2 text-[11px] text-xb-text-muted">Search a player to adjust their wallet.</p>
            ) : (
              <Table head={["Player", "Phone", "Balance", "Actions"]}>
                {matches.slice(0, 20).map((u) => (
                  <tr key={u.id} className="border-b border-xb-line/60 last:border-0">
                    <td className="px-2 py-1.5 font-bold">{u.name}</td>
                    <td className="px-2 py-1.5 text-xb-text-muted">{u.phone}</td>
                    <td className="px-2 py-1.5 font-bold text-xb-green">{ugx(u.balance)}</td>
                    <td className="px-2 py-1.5">
                      <div className="flex gap-1">
                        <Btn size="xs" tone="green" onClick={() => { adjustUserBalance(u.id, Math.abs(userAmount), "Admin", "Admin credit"); toast.success("Added"); }}>
                          Add
                        </Btn>
                        <Btn size="xs" tone="red" onClick={() => { adjustUserBalance(u.id, -Math.abs(userAmount), "Admin", "Admin debit"); toast.success("Removed"); }}>
                          Remove
                        </Btn>
                      </div>
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </div>
        </Panel>
      </div>

      <Panel title="Latest money movements">
        <Table head={["Ref", "Actor", "Type", "Amount", "Method", "When"]}>
          {state.transactions.slice(0, 25).map((t) => (
            <tr key={t.id} className="border-b border-xb-line/60 last:border-0">
              <td className="px-2 py-1.5 font-bold text-xb-blue">{t.reference}</td>
              <td className="px-2 py-1.5">{t.actorName}</td>
              <td className="px-2 py-1.5">{t.kind}</td>
              <td className={`px-2 py-1.5 font-bold ${t.amount < 0 ? "text-xb-red" : "text-xb-green"}`}>{ugx(t.amount)}</td>
              <td className="px-2 py-1.5 text-xb-text-muted">{t.method}</td>
              <td className="px-2 py-1.5 text-xb-text-muted">{timeAgo(t.at)}</td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}

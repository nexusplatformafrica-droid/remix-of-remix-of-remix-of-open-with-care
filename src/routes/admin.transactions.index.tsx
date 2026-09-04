import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useAdmin } from "@/components/admin/AdminDataContext";
import { Badge, Btn, Empty, Panel, Stat, Table, downloadCsv, inputCls, timeAgo, ugx } from "@/components/admin/ui";

export const Route = createFileRoute("/admin/transactions/")({
  component: TransactionsPage,
});

const kinds = ["all", "Deposit", "Withdrawal", "Bet", "Payout", "Bonus", "Commission", "Adjustment"] as const;

function TransactionsPage() {
  // Transactions are an audit trail: read-only records. The only write action
  // is clearing the whole log.
  const { state, deleteTransaction } = useAdmin();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<(typeof kinds)[number]>("all");

  const clearAll = () => {
    const ids = state.transactions.map((t) => t.id);
    if (ids.length === 0) return;
    if (!window.confirm(`Delete all ${ids.length} transaction records? This cannot be undone.`))
      return;
    for (const id of ids) deleteTransaction(id);
    toast.success("All transaction records cleared");
  };

  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return state.transactions.filter((t) => {
      if (kind !== "all" && t.kind !== kind) return false;
      if (!n) return true;
      return [t.reference, t.actorName, t.method, t.kind].some((v) => v.toLowerCase().includes(n));
    });
  }, [state.transactions, q, kind]);

  const inflow = list.filter((t) => t.amount > 0).reduce((a, t) => a + t.amount, 0);
  const outflow = list.filter((t) => t.amount < 0).reduce((a, t) => a + Math.abs(t.amount), 0);

  return (
    <div className="space-y-2 md:space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <Stat label="Records" value={String(list.length)} />
        <Stat label="Money in" value={ugx(inflow)} tone="green" big />
        <Stat label="Money out" value={ugx(outflow)} tone="red" big />
        <Stat label="Net" value={ugx(inflow - outflow)} tone={inflow - outflow >= 0 ? "green" : "red"} />
      </div>

      <Panel
        title={`Transactions (${list.length})`}
        action={
          <div className="flex gap-1">
            <Btn
              size="xs"
              onClick={() =>
                downloadCsv("transactions.csv", [
                  ["Ref", "When", "Actor", "Role", "Type", "Amount", "Method", "Status"],
                  ...list.map((t) => [
                    t.reference,
                    new Date(t.at).toISOString(),
                    t.actorName,
                    t.actorType,
                    t.kind,
                    t.amount,
                    t.method,
                    t.status,
                  ]),
                ])
              }
            >
              Export CSV
            </Btn>
            <Btn size="xs" tone="red" onClick={clearAll}>
              Clear all
            </Btn>
          </div>
        }
      >
        <div className="mb-2 flex flex-wrap gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search reference, actor, method…"
            className={`${inputCls} min-w-[200px] flex-1`}
          />
          <div className="flex flex-wrap gap-1">
            {kinds.map((k) => (
              <Btn key={k} size="xs" tone={kind === k ? "primary" : "default"} onClick={() => setKind(k)}>
                {k}
              </Btn>
            ))}
          </div>
        </div>
        {list.length === 0 ? (
          <Empty text="No transactions found." />
        ) : (
          <Table head={["Ref", "Actor", "Type", "Amount", "Method", "Status", "When", ""]}>
            {list.slice(0, 200).map((t) => (
              <tr
                key={t.id}
                className="cursor-pointer border-b border-xb-line/60 last:border-0 hover:bg-xb-panel-alt"
                onClick={() => navigate({ to: "/admin/transactions/$txId", params: { txId: t.id } })}
              >
                <td className="px-2 py-1.5 font-bold text-xb-blue">{t.reference}</td>
                <td className="px-2 py-1.5">{t.actorName}</td>
                <td className="px-2 py-1.5">{t.kind}</td>
                <td className={`px-2 py-1.5 font-bold ${t.amount < 0 ? "text-xb-red" : "text-xb-green"}`}>
                  {ugx(t.amount)}
                </td>
                <td className="px-2 py-1.5 text-xb-text-muted">{t.method}</td>
                <td className="px-2 py-1.5">
                  <Badge value={t.status} />
                </td>
                <td className="px-2 py-1.5 text-xb-text-muted">{timeAgo(t.at)}</td>
                <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                  <Link
                    to="/admin/transactions/$txId"
                    params={{ txId: t.id }}
                    className="rounded bg-xb-odds px-2 py-1 text-[10px] font-bold"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
    </div>
  );
}

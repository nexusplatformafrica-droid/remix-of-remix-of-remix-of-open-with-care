import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useAdmin } from "@/components/admin/AdminDataContext";
import { BackLink, Badge, Btn, Field, Panel, Stat, Table, dateTime, inputCls, ugx } from "@/components/admin/ui";

export const Route = createFileRoute("/admin/affiliates/$affiliateId")({ component: AffiliateDetailPage });

function AffiliateDetailPage() {
  const { affiliateId } = Route.useParams();
  const navigate = useNavigate();
  const { state, updateAffiliate, deleteAffiliate, payAffiliate } = useAdmin();
  const aff = state.affiliates.find((a) => a.id === affiliateId);
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState("MTN Mobile Money");

  if (!aff) {
    return (
      <Panel title="Affiliate not found">
        <BackLink to="/admin/affiliates" label="Back to affiliates" />
      </Panel>
    );
  }
  const txs = state.transactions.filter((t) => t.actorId === aff.id);

  return (
    <div className="space-y-2 md:space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <BackLink to="/admin/affiliates" label="All affiliates" />
          <h2 className="text-lg font-black text-xb-text">{aff.name}</h2>
          <p className="text-[11px] text-xb-text-muted">{aff.id} · {aff.code} · {aff.phone} · {aff.country}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge value={aff.status} />
          <Btn size="xs" onClick={() => updateAffiliate(aff.id, { status: aff.status === "active" ? "suspended" : "active" })}>
            {aff.status === "active" ? "Suspend" : "Activate"}
          </Btn>
          <Btn size="xs" tone="red" onClick={() => { deleteAffiliate(aff.id); toast.success("Affiliate deleted"); navigate({ to: "/admin/affiliates" }); }}>
            Delete
          </Btn>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <Stat label="Pending commission" value={ugx(aff.earnings - aff.paidOut)} tone="blue" big />
        <Stat label="Paid out" value={ugx(aff.paidOut)} tone="green" big />
        <Stat label="Referrals" value={String(aff.referrals)} tone="blue" />
        <Stat label="Commission rate" value={`${aff.commissionRate}%`} />
      </div>

      <div className="grid gap-2 md:gap-3 xl:grid-cols-2">
        <Panel title="Send money via mobile money">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Amount (UGX)">
              <input type="number" className={inputCls} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
            </Field>
            <Field label="Provider">
              <select className={inputCls} value={method} onChange={(e) => setMethod(e.target.value)}>
                <option>MTN Mobile Money</option>
                <option>Airtel Money</option>
              </select>
            </Field>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Btn tone="green" onClick={() => { if (amount <= 0) { toast.error("Enter an amount"); return; } payAffiliate(aff.id, amount, method); toast.success(`${method} payout sent to ${aff.phone}`); setAmount(0); }}>
              Send to {aff.phone}
            </Btn>
            <Btn onClick={() => { payAffiliate(aff.id, aff.earnings - aff.paidOut, method); toast.success("Full pending balance sent"); }}>
              Pay full pending
            </Btn>
          </div>
        </Panel>

        <Panel title="Affiliate management">
          <div className="grid gap-2 sm:grid-cols-2">
            {(["name", "phone", "email", "country", "code"] as const).map((k) => (
              <Field key={k} label={k}>
                <input className={inputCls} value={aff[k]} onChange={(e) => updateAffiliate(aff.id, { [k]: e.target.value })} />
              </Field>
            ))}
            <Field label="Commission rate (%)">
              <input type="number" className={inputCls} value={aff.commissionRate} onChange={(e) => updateAffiliate(aff.id, { commissionRate: Number(e.target.value) })} />
            </Field>
          </div>
        </Panel>
      </div>

      <Panel title={`Transactions (${txs.length})`}>
        <Table head={["Ref", "Type", "Amount", "Method", "When"]}>
          {txs.map((t) => (
            <tr key={t.id} className="border-b border-xb-line/60 last:border-0">
              <td className="px-2 py-1.5 font-bold text-xb-blue">{t.reference}</td>
              <td className="px-2 py-1.5">{t.kind}</td>
              <td className={`px-2 py-1.5 font-bold ${t.amount < 0 ? "text-xb-red" : "text-xb-green"}`}>{ugx(t.amount)}</td>
              <td className="px-2 py-1.5 text-xb-text-muted">{t.method}</td>
              <td className="px-2 py-1.5 text-xb-text-muted">{dateTime(t.at)}</td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}

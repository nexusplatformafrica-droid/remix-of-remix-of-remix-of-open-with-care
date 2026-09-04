import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useAdmin } from "@/components/admin/AdminDataContext";
import { Badge, Btn, Field, Panel, Stat, Table, inputCls, timeAgo, ugx } from "@/components/admin/ui";

export const Route = createFileRoute("/admin/affiliates/")({ component: AffiliatesPage });

const blank = { name: "", phone: "", email: "", country: "Uganda", code: "" };

function AffiliatesPage() {
  const { state, addAffiliate, deleteAffiliate, payAffiliate } = useAdmin();
  const navigate = useNavigate();
  const [form, setForm] = useState(blank);
  const [q, setQ] = useState("");

  const list = state.affiliates.filter((a) => {
    const n = q.trim().toLowerCase();
    return !n || [a.name, a.phone, a.code, a.email].some((v) => v.toLowerCase().includes(n));
  });

  return (
    <div className="space-y-2 md:space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <Stat label="Affiliates" value={String(state.affiliates.length)} big />
        <Stat label="Referred players" value={String(state.affiliates.reduce((a, x) => a + x.referrals, 0))} tone="blue" />
        <Stat label="Unpaid commission" value={ugx(state.affiliates.reduce((a, x) => a + (x.earnings - x.paidOut), 0))} tone="blue" big />
        <Stat label="Paid out" value={ugx(state.affiliates.reduce((a, x) => a + x.paidOut, 0))} tone="green" big />
      </div>

      <Panel title="Add affiliate member">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
          {(["name", "phone", "email", "country", "code"] as const).map((k) => (
            <Field key={k} label={k === "code" ? "Referral code" : k}>
              <input className={inputCls} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
            </Field>
          ))}
          <div className="flex items-end">
            <Btn
              tone="green"
              onClick={() => {
                if (!form.name.trim() || !form.phone.trim()) {
                  toast.error("Name and phone are required");
                  return;
                }
                addAffiliate({ ...form, referrals: 0, commissionRate: 15, earnings: 0, paidOut: 0, status: "active" });
                setForm(blank);
                toast.success("Affiliate added");
              }}
            >
              Add affiliate
            </Btn>
          </div>
        </div>
      </Panel>

      <Panel title={`Affiliate members (${list.length})`}>
        <input className={`${inputCls} mb-2 w-full`} placeholder="Search affiliates…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Table head={["Name", "Code", "Phone", "Referrals", "Pending", "Paid", "Status", "Joined", ""]}>
          {list.map((a) => (
            <tr
              key={a.id}
              className="cursor-pointer border-b border-xb-line/60 last:border-0 hover:bg-xb-panel-alt"
              onClick={() => navigate({ to: "/admin/affiliates/$affiliateId", params: { affiliateId: a.id } })}
            >
              <td className="px-2 py-1.5 font-bold">{a.name}</td>
              <td className="px-2 py-1.5 text-xb-blue">{a.code}</td>
              <td className="px-2 py-1.5 text-xb-text-muted">{a.phone}</td>
              <td className="px-2 py-1.5">{a.referrals}</td>
              <td className="px-2 py-1.5 font-bold text-xb-amber">{ugx(a.earnings - a.paidOut)}</td>
              <td className="px-2 py-1.5 text-xb-green">{ugx(a.paidOut)}</td>
              <td className="px-2 py-1.5"><Badge value={a.status} /></td>
              <td className="px-2 py-1.5 text-xb-text-muted">{timeAgo(a.createdAt)}</td>
              <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                <div className="flex flex-wrap gap-1">
                  <Btn size="xs" tone="green" onClick={() => { payAffiliate(a.id, a.earnings - a.paidOut, "MTN Mobile Money"); toast.success("Mobile money sent"); }}>
                    Pay mobile money
                  </Btn>
                  <Btn size="xs" tone="red" onClick={() => { deleteAffiliate(a.id); toast.success("Affiliate deleted"); }}>
                    Delete
                  </Btn>
                  <Link to="/admin/affiliates/$affiliateId" params={{ affiliateId: a.id }} className="rounded bg-xb-odds px-2 py-1 text-[10px] font-bold">
                    Open
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}

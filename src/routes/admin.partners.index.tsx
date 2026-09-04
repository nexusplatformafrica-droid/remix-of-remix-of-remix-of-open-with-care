import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useAdmin } from "@/components/admin/AdminDataContext";
import {
  Badge,
  Btn,
  Empty,
  Field,
  Panel,
  Stat,
  Table,
  inputCls,
  ugx,
} from "@/components/admin/ui";

export const Route = createFileRoute("/admin/partners/")({
  component: PartnersPage,
});

const blank = {
  name: "",
  location: "",
  contact: "",
  email: "",
  country: "Uganda",
  type: "Partnership" as "Partnership" | "Sale",
  company: "",
  registrationNo: "",
  contractValue: 0,
  status: "pending" as "active" | "pending" | "ended",
  notes: "",
};

function PartnersPage() {
  const { state, addPartner, deletePartner } = useAdmin();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [type, setType] = useState<"all" | "Sale" | "Partnership">("all");
  const [form, setForm] = useState(blank);
  const [showForm, setShowForm] = useState(false);

  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return state.partners.filter((p) => {
      if (type !== "all" && p.type !== type) return false;
      if (!n) return true;
      return [p.name, p.company, p.location, p.contact, p.country, p.id].some((v) =>
        v.toLowerCase().includes(n),
      );
    });
  }, [state.partners, q, type]);

  return (
    <div className="space-y-2 md:space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <Stat label="Partners" value={String(state.partners.length)} />
        <Stat
          label="Contract value"
          value={ugx(state.partners.reduce((a, p) => a + p.contractValue, 0))}
          tone="green"
          big
        />
        <Stat
          label="Partnership"
          value={String(state.partners.filter((p) => p.type === "Partnership").length)}
          tone="blue"
        />
        <Stat label="Sale" value={String(state.partners.filter((p) => p.type === "Sale").length)} />
      </div>

      {showForm && (
        <Panel title="Add partner">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <Field label="Contact name">
              <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Company">
              <input className={inputCls} value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            </Field>
            <Field label="Location">
              <input className={inputCls} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </Field>
            <Field label="Contact">
              <input className={inputCls} value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
            </Field>
            <Field label="Email">
              <input className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Country">
              <input className={inputCls} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
            </Field>
            <Field label="Type">
              <select
                className={inputCls}
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as typeof form.type })}
              >
                <option value="Partnership">Partnership</option>
                <option value="Sale">Sale</option>
              </select>
            </Field>
            <Field label="Contract value">
              <input
                type="number"
                className={inputCls}
                value={form.contractValue}
                onChange={(e) => setForm({ ...form, contractValue: Number(e.target.value) })}
              />
            </Field>
            <Field label="Registration no.">
              <input className={inputCls} value={form.registrationNo} onChange={(e) => setForm({ ...form, registrationNo: e.target.value })} />
            </Field>
            <Field label="Notes" className="sm:col-span-2 xl:col-span-3">
              <input className={inputCls} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
          </div>
          <div className="mt-2 flex gap-2">
            <Btn
              tone="green"
              onClick={() => {
                if (!form.company.trim() || !form.name.trim()) {
                  toast.error("Company and contact name are required");
                  return;
                }
                addPartner(form);
                setForm(blank);
                setShowForm(false);
                toast.success("Partner added");
              }}
            >
              Save partner
            </Btn>
            <Btn tone="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Btn>
          </div>
        </Panel>
      )}

      <Panel
        title={`Partners (${list.length})`}
        action={
          <Btn size="xs" tone="primary" onClick={() => setShowForm((s) => !s)}>
            <Plus className="h-3 w-3" /> Add partner
          </Btn>
        }
      >
        <div className="mb-2 flex flex-wrap gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-xb-text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search partner, company, location…"
              className={`${inputCls} pl-7`}
            />
          </div>
          <div className="flex gap-1">
            {(["all", "Sale", "Partnership"] as const).map((t) => (
              <Btn key={t} size="xs" tone={type === t ? "primary" : "default"} onClick={() => setType(t)}>
                {t}
              </Btn>
            ))}
          </div>
        </div>
        {list.length === 0 ? (
          <Empty text="No partners found." />
        ) : (
          <Table head={["Name", "Company", "Location", "Contact", "Country", "Type", "Value", "Status", ""]}>
            {list.map((p) => (
              <tr
                key={p.id}
                className="cursor-pointer border-b border-xb-line/60 last:border-0 hover:bg-xb-panel-alt"
                onClick={() => navigate({ to: "/admin/partners/$partnerId", params: { partnerId: p.id } })}
              >
                <td className="px-2 py-1.5">
                  <span className="font-bold text-xb-text">{p.name}</span>
                  <span className="block text-[10px] text-xb-text-muted">{p.id}</span>
                </td>
                <td className="px-2 py-1.5">{p.company}</td>
                <td className="px-2 py-1.5">{p.location}</td>
                <td className="px-2 py-1.5">{p.contact}</td>
                <td className="px-2 py-1.5">{p.country}</td>
                <td className="px-2 py-1.5">
                  <Badge value={p.type} />
                </td>
                <td className="px-2 py-1.5 font-bold">{ugx(p.contractValue)}</td>
                <td className="px-2 py-1.5">
                  <Badge value={p.status} />
                </td>
                <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-1">
                    <Link
                      to="/admin/partners/$partnerId"
                      params={{ partnerId: p.id }}
                      className="rounded bg-xb-odds px-2 py-1 text-[10px] font-bold"
                    >
                      Open
                    </Link>
                    <Btn
                      size="xs"
                      tone="red"
                      onClick={() => {
                        deletePartner(p.id);
                        toast.success("Partner deleted");
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Btn>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
    </div>
  );
}

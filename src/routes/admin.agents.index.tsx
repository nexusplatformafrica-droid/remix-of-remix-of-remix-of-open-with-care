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
  timeAgo,
  ugx,
} from "@/components/admin/ui";

export const Route = createFileRoute("/admin/agents/")({
  component: AgentsPage,
});

const blank = {
  name: "",
  idNumber: "",
  phone: "",
  shopName: "",
  shopBranch: "",
  country: "Uganda",
  status: "active" as const,
  balance: 0,
  commissionRate: 5,
  username: "",
  password: "",
};

function AgentsPage() {
  const { state, addAgent, updateAgent, deleteAgent } = useAdmin();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [form, setForm] = useState(blank);
  const [showForm, setShowForm] = useState(false);

  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return state.agents;
    return state.agents.filter((a) =>
      [a.name, a.phone, a.idNumber, a.shopName, a.shopBranch, a.country, a.id].some((v) =>
        v.toLowerCase().includes(n),
      ),
    );
  }, [state.agents, q]);

  const submit = () => {
    if (!form.name.trim() || !form.phone.trim() || !form.username.trim() || !form.password.trim()) {
      toast.error("Name, phone, username and password are required");
      return;
    }
    addAgent(form);
    setForm(blank);
    setShowForm(false);
    toast.success("Agent created with login");
  };

  return (
    <div className="space-y-2 md:space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <Stat label="Agents" value={String(state.agents.length)} />
        <Stat
          label="Agent float"
          value={ugx(state.agents.reduce((a, x) => a + x.balance, 0))}
          tone="green"
          big
        />
        <Stat
          label="Active"
          value={String(state.agents.filter((a) => a.status === "active").length)}
          tone="blue"
        />
        <Stat
          label="Blocked"
          value={String(state.agents.filter((a) => a.status === "blocked").length)}
          tone="red"
        />
      </div>

      {showForm && (
        <Panel title="Add agent">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <Field label="Agent name">
              <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="ID number">
              <input className={inputCls} value={form.idNumber} onChange={(e) => setForm({ ...form, idNumber: e.target.value })} />
            </Field>
            <Field label="Phone number">
              <input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Country">
              <input className={inputCls} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
            </Field>
            <Field label="Shop name">
              <input className={inputCls} value={form.shopName} onChange={(e) => setForm({ ...form, shopName: e.target.value })} />
            </Field>
            <Field label="Shop branch">
              <input className={inputCls} value={form.shopBranch} onChange={(e) => setForm({ ...form, shopBranch: e.target.value })} />
            </Field>
            <Field label="Opening float">
              <input type="number" className={inputCls} value={form.balance} onChange={(e) => setForm({ ...form, balance: Number(e.target.value) })} />
            </Field>
            <Field label="Commission %">
              <input type="number" className={inputCls} value={form.commissionRate} onChange={(e) => setForm({ ...form, commissionRate: Number(e.target.value) })} />
            </Field>
            <Field label="Login username">
              <input className={inputCls} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </Field>
            <Field label="Login password">
              <input className={inputCls} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </Field>
          </div>
          <div className="mt-2 flex gap-2">
            <Btn tone="green" onClick={submit}>
              Create agent
            </Btn>
            <Btn tone="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Btn>
          </div>
        </Panel>
      )}

      <Panel
        title={`Agents (${list.length})`}
        action={
          <Btn size="xs" tone="primary" onClick={() => setShowForm((s) => !s)}>
            <Plus className="h-3 w-3" /> Add agent
          </Btn>
        }
      >
        <div className="relative mb-2">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-xb-text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search agent, shop, phone, ID…"
            className={`${inputCls} pl-7`}
          />
        </div>
        {list.length === 0 ? (
          <Empty text="No agents found." />
        ) : (
          <Table
            head={["Agent", "ID number", "Phone", "Shop name", "Branch", "Country", "Float", "Status", "Actions"]}
          >
            {list.map((a) => (
              <tr
                key={a.id}
                className="cursor-pointer border-b border-xb-line/60 last:border-0 hover:bg-xb-panel-alt"
                onClick={() => navigate({ to: "/admin/agents/$agentId", params: { agentId: a.id } })}
              >
                <td className="px-2 py-1.5">
                  <span className="font-bold text-xb-text">{a.name}</span>
                  <span className="block text-[10px] text-xb-text-muted">{a.id}</span>
                </td>
                <td className="px-2 py-1.5">{a.idNumber}</td>
                <td className="px-2 py-1.5">{a.phone}</td>
                <td className="px-2 py-1.5">{a.shopName}</td>
                <td className="px-2 py-1.5">{a.shopBranch}</td>
                <td className="px-2 py-1.5">{a.country}</td>
                <td className="px-2 py-1.5 font-bold text-xb-green">{ugx(a.balance)}</td>
                <td className="px-2 py-1.5">
                  <Badge value={a.status} />
                  <span className="block text-[10px] text-xb-text-muted">{timeAgo(a.lastSeen)}</span>
                </td>
                <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                  <div className="flex flex-wrap gap-1">
                    <Link
                      to="/admin/agents/$agentId"
                      params={{ agentId: a.id }}
                      className="rounded bg-xb-odds px-2 py-1 text-[10px] font-bold"
                    >
                      Open
                    </Link>
                    <Btn
                      size="xs"
                      tone={a.status === "active" ? "red" : "green"}
                      onClick={() =>
                        updateAgent(a.id, { status: a.status === "active" ? "blocked" : "active" })
                      }
                    >
                      {a.status === "active" ? "Block" : "Unblock"}
                    </Btn>
                    <Btn
                      size="xs"
                      tone="ghost"
                      onClick={() => {
                        deleteAgent(a.id);
                        toast.success("Agent deleted");
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

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useAdmin } from "@/components/admin/AdminDataContext";
import {
  BackLink,
  Badge,
  Btn,
  Empty,
  Field,
  Panel,
  Stat,
  Table,
  Tabs,
  dateTime,
  inputCls,
  timeAgo,
  ugx,
} from "@/components/admin/ui";

export const Route = createFileRoute("/admin/agents/$agentId")({
  component: AgentDetailPage,
});

const tabs = ["overview", "transactions", "activities", "settings"] as const;
type Tab = (typeof tabs)[number];

function AgentDetailPage() {
  const { agentId } = Route.useParams();
  const navigate = useNavigate();
  const { state, updateAgent, deleteAgent, addTransaction, log } = useAdmin();
  const [tab, setTab] = useState<Tab>("overview");
  const [amount, setAmount] = useState(50000);

  const agent = state.agents.find((a) => a.id === agentId);
  const txs = useMemo(
    () => state.transactions.filter((t) => t.actorId === agentId),
    [state.transactions, agentId],
  );
  const acts = useMemo(
    () => state.activities.filter((a) => a.actorId === agentId),
    [state.activities, agentId],
  );

  if (!agent) {
    return (
      <Panel title="Agent not found">
        <BackLink to="/admin/agents" label="Back to agents" />
      </Panel>
    );
  }

  const move = (sign: 1 | -1) => {
    if (amount <= 0) {
      toast.error("Enter an amount");
      return;
    }
    updateAgent(agent.id, { balance: Math.max(0, agent.balance + sign * amount) });
    addTransaction({
      kind: "Adjustment",
      amount: sign * amount,
      method: "Agent float",
      actorType: "agent",
      actorId: agent.id,
      actorName: agent.name,
      status: "completed",
      reference: sign > 0 ? "Float top-up" : "Float withdrawal",
    });
    log({
      actorType: "admin",
      actorId: "ADMIN",
      actorName: "Administrator",
      action: sign > 0 ? "Topped up agent float" : "Withdrew agent float",
      target: agent.shopName,
    });
    toast.success(`${sign > 0 ? "Added" : "Removed"} ${ugx(amount)}`);
  };

  return (
    <div className="space-y-2 md:space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <BackLink to="/admin/agents" label="All agents" />
          <h2 className="text-lg font-black leading-tight text-xb-text">{agent.name}</h2>
          <p className="text-[11px] text-xb-text-muted">
            {agent.id} · {agent.shopName} · {agent.shopBranch} · seen {timeAgo(agent.lastSeen)}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge value={agent.status} />
          <Btn
            size="xs"
            tone={agent.status === "active" ? "red" : "green"}
            onClick={() =>
              updateAgent(agent.id, { status: agent.status === "active" ? "blocked" : "active" })
            }
          >
            {agent.status === "active" ? "Block agent" : "Unblock agent"}
          </Btn>
          <Btn
            size="xs"
            tone="red"
            onClick={() => {
              deleteAgent(agent.id);
              toast.success("Agent deleted");
              navigate({ to: "/admin/agents" });
            }}
          >
            Delete agent
          </Btn>
        </div>
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === "overview" && (
        <div className="space-y-2 md:space-y-3">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
            <Stat label="Agent float" value={ugx(agent.balance)} tone="green" big />
            <Stat label="Commission rate" value={`${agent.commissionRate}%`} />
            <Stat label="Transactions" value={String(txs.length)} />
            <Stat label="Activities" value={String(acts.length)} />
          </div>
          <div className="grid gap-2 md:gap-3 xl:grid-cols-2">
            <Panel title="Agent details">
              <dl className="grid grid-cols-2 gap-2 text-[11px]">
                {[
                  ["Agent name", agent.name],
                  ["ID number", agent.idNumber],
                  ["Phone number", agent.phone],
                  ["Shop name", agent.shopName],
                  ["Shop branch", agent.shopBranch],
                  ["Country", agent.country],
                  ["Created", dateTime(agent.createdAt)],
                  ["Last seen", dateTime(agent.lastSeen)],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-xb-panel-alt px-2 py-1.5">
                    <dt className="text-[10px] uppercase text-xb-text-muted">{k}</dt>
                    <dd className="font-bold text-xb-text">{v}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
            <Panel title="Float management">
              <div className="flex flex-wrap items-end gap-2">
                <Field label="Amount" className="w-32">
                  <input
                    type="number"
                    className={inputCls}
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                  />
                </Field>
                <Btn tone="green" onClick={() => move(1)}>
                  Add float
                </Btn>
                <Btn tone="red" onClick={() => move(-1)}>
                  Remove float
                </Btn>
              </div>
            </Panel>
          </div>
        </div>
      )}

      {tab === "transactions" && (
        <Panel title={`Transactions (${txs.length})`}>
          {txs.length === 0 ? (
            <Empty text="No transactions yet." />
          ) : (
            <Table head={["Ref", "Type", "Amount", "Method", "Status", "When", ""]}>
              {txs.map((t) => (
                <tr key={t.id} className="border-b border-xb-line/60 last:border-0">
                  <td className="px-2 py-1.5 font-bold">{t.reference}</td>
                  <td className="px-2 py-1.5">{t.kind}</td>
                  <td className={`px-2 py-1.5 font-bold ${t.amount < 0 ? "text-xb-red" : "text-xb-green"}`}>
                    {ugx(t.amount)}
                  </td>
                  <td className="px-2 py-1.5 text-xb-text-muted">{t.method}</td>
                  <td className="px-2 py-1.5">
                    <Badge value={t.status} />
                  </td>
                  <td className="px-2 py-1.5 text-xb-text-muted">{timeAgo(t.at)}</td>
                  <td className="px-2 py-1.5">
                    <Link
                      to="/admin/transactions/$txId"
                      params={{ txId: t.id }}
                      className="text-[10px] font-bold text-xb-blue"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>
      )}

      {tab === "activities" && (
        <Panel title={`Activity log (${acts.length})`}>
          {acts.length === 0 ? (
            <Empty text="No activity recorded." />
          ) : (
            <Table head={["When", "Action", "Target", "Device", "IP", ""]}>
              {acts.map((a) => (
                <tr key={a.id} className="border-b border-xb-line/60 last:border-0">
                  <td className="px-2 py-1.5 text-xb-text-muted">{dateTime(a.at)}</td>
                  <td className="px-2 py-1.5 font-bold">{a.action}</td>
                  <td className="px-2 py-1.5">{a.target}</td>
                  <td className="px-2 py-1.5 text-xb-text-muted">{a.device}</td>
                  <td className="px-2 py-1.5 text-xb-text-muted">{a.ip}</td>
                  <td className="px-2 py-1.5">
                    <Link
                      to="/admin/activities/$activityId"
                      params={{ activityId: a.id }}
                      className="text-[10px] font-bold text-xb-blue"
                    >
                      Details
                    </Link>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>
      )}

      {tab === "settings" && (
        <div className="grid gap-2 md:gap-3 xl:grid-cols-2">
          <Panel title="Profile & shop">
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["name", "Agent name"],
                  ["idNumber", "ID number"],
                  ["phone", "Phone number"],
                  ["shopName", "Shop name"],
                  ["shopBranch", "Shop branch"],
                  ["country", "Country"],
                ] as const
              ).map(([key, label]) => (
                <Field key={key} label={label}>
                  <input
                    className={inputCls}
                    value={agent[key]}
                    onChange={(e) => updateAgent(agent.id, { [key]: e.target.value })}
                  />
                </Field>
              ))}
              <Field label="Commission %">
                <input
                  type="number"
                  className={inputCls}
                  value={agent.commissionRate}
                  onChange={(e) => updateAgent(agent.id, { commissionRate: Number(e.target.value) })}
                />
              </Field>
            </div>
          </Panel>
          <Panel title="Login credentials">
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Username">
                <input
                  className={inputCls}
                  value={agent.username}
                  onChange={(e) => updateAgent(agent.id, { username: e.target.value })}
                />
              </Field>
              <Field label="Password">
                <input
                  className={inputCls}
                  value={agent.password}
                  onChange={(e) => updateAgent(agent.id, { password: e.target.value })}
                />
              </Field>
            </div>
            <div className="mt-2 flex gap-2">
              <Btn
                onClick={() => {
                  const pw = Math.random().toString(36).slice(2, 10);
                  updateAgent(agent.id, { password: pw });
                  toast.success(`New password: ${pw}`);
                }}
              >
                Generate password
              </Btn>
              <Btn onClick={() => toast.success("Credentials sent to agent phone")}>Send login</Btn>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}

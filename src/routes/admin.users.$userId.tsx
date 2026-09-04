import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useAdmin } from "@/components/admin/AdminDataContext";
import { betPayout } from "@/lib/admin-seed";
import type { UserSettings } from "@/lib/admin-types";
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
  Toggle,
  dateTime,
  inputCls,
  timeAgo,
  ugx,
} from "@/components/admin/ui";

export const Route = createFileRoute("/admin/users/$userId")({
  component: UserDetailPage,
});

const tabs = ["overview", "wallet", "bets", "activities", "settings", "message"] as const;
type Tab = (typeof tabs)[number];

function UserDetailPage() {
  const { userId } = Route.useParams();
  const navigate = useNavigate();
  const { state, updateUser, deleteUser, adjustUserBalance, sendUserMessage, setBetStatus, deleteBet } =
    useAdmin();
  const [tab, setTab] = useState<Tab>("overview");
  const [amount, setAmount] = useState(10000);
  const [method, setMethod] = useState("MTN Mobile Money");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState({ channel: "Message" as const, title: "", body: "" });
  const [channel, setChannel] = useState<"Message" | "Alert" | "Notification">("Message");

  const user = state.users.find((u) => u.id === userId);
  const bets = useMemo(() => state.bets.filter((b) => b.userId === userId), [state.bets, userId]);
  const acts = useMemo(
    () => state.activities.filter((a) => a.actorId === userId),
    [state.activities, userId],
  );
  const txs = useMemo(
    () => state.transactions.filter((t) => t.actorId === userId),
    [state.transactions, userId],
  );

  if (!user) {
    return (
      <Panel title="User not found">
        <BackLink to="/admin/users" label="Back to users" />
      </Panel>
    );
  }

  const setSetting = <K extends keyof UserSettings>(k: K, v: UserSettings[K]) =>
    updateUser(user.id, { settings: { ...user.settings, [k]: v } });

  const pendingLiability = bets
    .filter((b) => b.status === "pending")
    .reduce((a, b) => a + betPayout(b), 0);

  return (
    <div className="space-y-2 md:space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <BackLink to="/admin/users" label="All users" />
          <h2 className="text-lg font-black leading-tight text-xb-text">{user.name}</h2>
          <p className="text-[11px] text-xb-text-muted">
            {user.id} · {user.phone} · seen {timeAgo(user.lastSeen)}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge value={user.status} />
          <Btn
            size="xs"
            tone={user.status === "active" ? "red" : "green"}
            onClick={() => {
              updateUser(user.id, { status: user.status === "active" ? "blocked" : "active" });
              toast.success(user.status === "active" ? "User blocked" : "User unblocked");
            }}
          >
            {user.status === "active" ? "Block" : "Unblock"}
          </Btn>
          <Btn
            size="xs"
            onClick={() => {
              updateUser(user.id, { verified: !user.verified });
              toast.success(user.verified ? "KYC revoked" : "KYC verified");
            }}
          >
            {user.verified ? "Revoke KYC" : "Verify KYC"}
          </Btn>
          <Btn
            size="xs"
            tone="red"
            onClick={() => {
              deleteUser(user.id);
              toast.success("User deleted");
              navigate({ to: "/admin/users" });
            }}
          >
            Delete user
          </Btn>
        </div>
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === "overview" && (
        <div className="space-y-2 md:space-y-3">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
            <Stat label="Balance" value={ugx(user.balance)} tone="green" big />
            <Stat label="Total in" value={ugx(user.totalIn)} />
            <Stat label="Total out" value={ugx(user.totalOut)} tone="red" />
            <Stat label="Total lost" value={ugx(user.lostBalance)} tone="red" />
          </div>
          <div className="grid gap-2 md:gap-3 xl:grid-cols-2">
            <Panel title="Profile">
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Full name">
                  <input
                    className={inputCls}
                    value={user.name}
                    onChange={(e) => updateUser(user.id, { name: e.target.value })}
                  />
                </Field>
                <Field label="Phone number">
                  <input
                    className={inputCls}
                    value={user.phone}
                    onChange={(e) => updateUser(user.id, { phone: e.target.value })}
                  />
                </Field>
                <Field label="ID number">
                  <input
                    className={inputCls}
                    value={user.idNumber}
                    onChange={(e) => updateUser(user.id, { idNumber: e.target.value })}
                  />
                </Field>
                <Field label="Email">
                  <input
                    className={inputCls}
                    value={user.email}
                    onChange={(e) => updateUser(user.id, { email: e.target.value })}
                  />
                </Field>
                <Field label="Country">
                  <input
                    className={inputCls}
                    value={user.country}
                    onChange={(e) => updateUser(user.id, { country: e.target.value })}
                  />
                </Field>
                <Field label="City">
                  <input
                    className={inputCls}
                    value={user.city}
                    onChange={(e) => updateUser(user.id, { city: e.target.value })}
                  />
                </Field>
              </div>
              <p className="mt-2 text-[10px] text-xb-text-muted">
                Joined {dateTime(user.joinedAt)} · KYC {user.verified ? "verified" : "pending"} ·
                currency {user.currency}
              </p>
            </Panel>
            <Panel title="Betting summary">
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Tickets" value={String(bets.length)} />
                <Stat label="Pending" value={String(bets.filter((b) => b.status === "pending").length)} />
                <Stat label="Won" value={String(bets.filter((b) => b.status === "won").length)} tone="green" />
                <Stat label="Lost" value={String(bets.filter((b) => b.status === "lost").length)} tone="red" />
                <Stat label="Staked" value={ugx(bets.reduce((a, b) => a + b.stake, 0))} />
                <Stat label="Pending payout" value={ugx(pendingLiability)} tone="blue" />
              </div>
            </Panel>
          </div>
        </div>
      )}

      {tab === "wallet" && (
        <div className="space-y-2 md:space-y-3">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
            <Stat label="Wallet balance" value={ugx(user.balance)} tone="green" big />
            <Stat label="Total in" value={ugx(user.totalIn)} />
            <Stat label="Total out" value={ugx(user.totalOut)} tone="red" />
            <Stat label="Total lost balance" value={ugx(user.lostBalance)} tone="red" />
          </div>
          <Panel title="Adjust wallet">
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Amount" className="w-32">
                <input
                  type="number"
                  className={inputCls}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                />
              </Field>
              <Field label="Method" className="w-44">
                <select className={inputCls} value={method} onChange={(e) => setMethod(e.target.value)}>
                  {["MTN Mobile Money", "Airtel Money", "Bank Transfer", "Agent Cash", "Bonus"].map(
                    (m) => (
                      <option key={m}>{m}</option>
                    ),
                  )}
                </select>
              </Field>
              <Field label="Note" className="min-w-[160px] flex-1">
                <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
              <Btn
                tone="green"
                onClick={() => {
                  if (amount <= 0) {
                    toast.error("Enter an amount");
                    return;
                  }
                  adjustUserBalance(user.id, amount, method, note);
                  toast.success(`Added ${ugx(amount)} to ${user.name}`);
                }}
              >
                Add money
              </Btn>
              <Btn
                tone="red"
                onClick={() => {
                  if (amount <= 0) {
                    toast.error("Enter an amount");
                    return;
                  }
                  if (amount > user.balance) {
                    toast.error("Amount exceeds wallet balance");
                    return;
                  }
                  adjustUserBalance(user.id, -amount, method, note);
                  toast.success(`Removed ${ugx(amount)} from ${user.name}`);
                }}
              >
                Remove money
              </Btn>
            </div>
          </Panel>
          <Panel title={`Wallet transactions (${txs.length})`}>
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
        </div>
      )}

      {tab === "bets" && (
        <Panel title={`Tickets (${bets.length})`}>
          {bets.length === 0 ? (
            <Empty text="This player has no tickets." />
          ) : (
            <Table head={["Code", "Events", "Stake", "Odds", "Payout", "Status", "Placed", "Actions"]}>
              {bets.map((b) => (
                <tr key={b.id} className="border-b border-xb-line/60 last:border-0">
                  <td className="px-2 py-1.5 font-bold">
                    <Link to="/admin/bets/$betId" params={{ betId: b.id }} className="text-xb-blue">
                      {b.code}
                    </Link>
                  </td>
                  <td className="px-2 py-1.5">{b.matches.length}</td>
                  <td className="px-2 py-1.5">{ugx(b.stake)}</td>
                  <td className="px-2 py-1.5">
                    {b.matches.reduce((a, m) => a * m.odds, 1).toFixed(2)}
                  </td>
                  <td className="px-2 py-1.5 font-bold">{ugx(betPayout(b))}</td>
                  <td className="px-2 py-1.5">
                    <Badge value={b.status} />
                  </td>
                  <td className="px-2 py-1.5 text-xb-text-muted">{timeAgo(b.placedAt)}</td>
                  <td className="px-2 py-1.5">
                    <div className="flex flex-wrap gap-1">
                      <Btn size="xs" tone="green" onClick={() => setBetStatus(b.id, "won")}>
                        Won
                      </Btn>
                      <Btn size="xs" tone="red" onClick={() => setBetStatus(b.id, "lost")}>
                        Lost
                      </Btn>
                      <Btn size="xs" onClick={() => setBetStatus(b.id, "cancelled")}>
                        Cancel
                      </Btn>
                      <Btn size="xs" tone="ghost" onClick={() => deleteBet(b.id)}>
                        Delete
                      </Btn>
                    </div>
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
            <Empty text="No recorded activity." />
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
          <Panel title="Account settings">
            <div className="space-y-1.5">
              <Toggle
                label="Two-factor authentication"
                checked={user.settings.twoFactor}
                onChange={(v) => setSetting("twoFactor", v)}
              />
              <Toggle
                label="Require bet confirmation"
                checked={user.settings.betConfirmation}
                onChange={(v) => setSetting("betConfirmation", v)}
              />
              <Toggle
                label="Accept odds changes automatically"
                checked={user.settings.oddsChangeAccept}
                onChange={(v) => setSetting("oddsChangeAccept", v)}
              />
              <Toggle
                label="Self-exclusion (block betting)"
                checked={user.settings.selfExcluded}
                onChange={(v) => setSetting("selfExcluded", v)}
              />
            </div>
          </Panel>
          <Panel title="Notifications">
            <div className="space-y-1.5">
              <Toggle
                label="Email alerts"
                checked={user.settings.emailAlerts}
                onChange={(v) => setSetting("emailAlerts", v)}
              />
              <Toggle
                label="SMS alerts"
                checked={user.settings.smsAlerts}
                onChange={(v) => setSetting("smsAlerts", v)}
              />
              <Toggle
                label="Push notifications"
                checked={user.settings.pushAlerts}
                onChange={(v) => setSetting("pushAlerts", v)}
              />
            </div>
          </Panel>
          <Panel title="Limits & preferences">
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Daily deposit limit">
                <input
                  type="number"
                  className={inputCls}
                  value={user.settings.depositLimit}
                  onChange={(e) => setSetting("depositLimit", Number(e.target.value))}
                />
              </Field>
              <Field label="Max stake per ticket">
                <input
                  type="number"
                  className={inputCls}
                  value={user.settings.stakeLimit}
                  onChange={(e) => setSetting("stakeLimit", Number(e.target.value))}
                />
              </Field>
              <Field label="Language">
                <input
                  className={inputCls}
                  value={user.settings.language}
                  onChange={(e) => setSetting("language", e.target.value)}
                />
              </Field>
              <Field label="Timezone">
                <input
                  className={inputCls}
                  value={user.settings.timezone}
                  onChange={(e) => setSetting("timezone", e.target.value)}
                />
              </Field>
            </div>
          </Panel>
          <Panel title="Security actions">
            <div className="flex flex-wrap gap-2">
              <Btn onClick={() => toast.success("Password reset link sent")}>Send password reset</Btn>
              <Btn onClick={() => toast.success("All sessions signed out")}>Force logout</Btn>
              <Btn tone="red" onClick={() => updateUser(user.id, { status: "blocked" })}>
                Freeze account
              </Btn>
            </div>
          </Panel>
        </div>
      )}

      {tab === "message" && (
        <div className="grid gap-2 md:gap-3 xl:grid-cols-2">
          <Panel title="Send to player">
            <div className="space-y-2">
              <Field label="Channel">
                <select
                  className={inputCls}
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as typeof channel)}
                >
                  <option value="Message">Message</option>
                  <option value="Alert">Alert</option>
                  <option value="Notification">Notification</option>
                </select>
              </Field>
              <Field label="Title">
                <input
                  className={inputCls}
                  value={msg.title}
                  onChange={(e) => setMsg({ ...msg, title: e.target.value })}
                />
              </Field>
              <Field label="Body">
                <textarea
                  rows={4}
                  className={inputCls}
                  value={msg.body}
                  onChange={(e) => setMsg({ ...msg, body: e.target.value })}
                />
              </Field>
              <Btn
                tone="primary"
                onClick={() => {
                  if (!msg.title.trim()) {
                    toast.error("Add a title");
                    return;
                  }
                  sendUserMessage(user.id, { channel, title: msg.title, body: msg.body });
                  setMsg({ channel: "Message", title: "", body: "" });
                  toast.success(`${channel} sent to ${user.name}`);
                }}
              >
                Send {channel.toLowerCase()}
              </Btn>
            </div>
          </Panel>
          <Panel title={`Sent history (${user.messages.length})`}>
            {user.messages.length === 0 ? (
              <Empty text="Nothing sent yet." />
            ) : (
              <ul className="space-y-1.5">
                {user.messages.map((m) => (
                  <li key={m.id} className="rounded-lg bg-xb-panel-alt p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-xb-text">{m.title}</span>
                      <Badge value={m.channel} />
                    </div>
                    <p className="mt-0.5 text-[11px] text-xb-text-muted">{m.body}</p>
                    <p className="mt-0.5 text-[10px] text-xb-text-muted">{dateTime(m.at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}

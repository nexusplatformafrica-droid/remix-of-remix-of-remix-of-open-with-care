import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Banknote,
  Handshake,
  Store,
  Ticket,
  TrendingDown,
  TrendingUp,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { useAdmin } from "@/components/admin/AdminDataContext";
import { betPayout } from "@/lib/admin-seed";
import { Badge, Panel, Stat, Table, timeAgo, ugx } from "@/components/admin/ui";
import { useProviderBalances } from "@/lib/provider-float";

export const Route = createFileRoute("/admin/")({
  component: OverviewPage,
});

function OverviewPage() {
  const { state } = useAdmin();
  const { ugx: realFloat } = useProviderBalances();
  const { users, agents, partners, bets, transactions, affiliates, activities } = state;

  const usersWallet = users.reduce((a, u) => a + u.balance, 0);
  const pending = bets.filter((b) => b.status === "pending");
  const pendingLiability = pending.reduce((a, b) => a + betPayout(b), 0);
  const deposits = transactions
    .filter((t) => t.kind === "Deposit" && t.status === "completed")
    .reduce((a, t) => a + t.amount, 0);
  const withdrawals = transactions
    .filter((t) => t.kind === "Withdrawal" && t.status === "completed")
    .reduce((a, t) => a + Math.abs(t.amount), 0);
  const staked = bets.reduce((a, b) => a + b.stake, 0);
  const paidOut = bets.filter((b) => b.status === "won").reduce((a, b) => a + betPayout(b), 0);
  const ggr = staked - paidOut;
  const online = users.filter((u) => Date.now() - u.lastSeen < 15 * 60_000).length;

  return (
    <div className="space-y-2 md:space-y-3">
      <div className="grid gap-2 md:grid-cols-3 md:gap-3">
        <div className="rounded-2xl bg-xb-header p-4 shadow-sm md:col-span-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-xb-on-dark-muted">
                Website balance / float
              </span>
              <div className="mt-1 text-3xl font-black leading-none text-xb-on-dark md:text-5xl">
                {realFloat === null ? "—" : ugx(realFloat)}
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-xb-on-dark-muted">
                <span>
                  Players wallet <b className="text-xb-on-dark">{ugx(usersWallet)}</b>
                </span>
                <span>
                  Pending liability <b className="text-xb-on-dark">{ugx(pendingLiability)}</b>
                </span>
                <span>
                  Net position{" "}
                  <b className="text-xb-green">{realFloat === null ? "—" : ugx(realFloat - usersWallet - pendingLiability)}</b>
                </span>
              </div>
            </div>
            <Wallet className="hidden h-10 w-10 text-white/20 sm:block" />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              to="/admin/wallet"
              className="rounded-lg bg-xb-green px-3 py-1.5 text-[11px] font-bold text-xb-on-dark"
            >
              Manage wallet
            </Link>
            <Link
              to="/admin/transactions"
              className="rounded-lg bg-white/10 px-3 py-1.5 text-[11px] font-bold text-xb-on-dark"
            >
              Transactions
            </Link>
            <Link
              to="/admin/bets"
              className="rounded-lg bg-white/10 px-3 py-1.5 text-[11px] font-bold text-xb-on-dark"
            >
              Settle tickets
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 md:gap-3">
          <Stat label="Deposits" value={ugx(deposits)} tone="green" icon={TrendingUp} />
          <Stat label="Withdrawals" value={ugx(withdrawals)} tone="red" icon={TrendingDown} />
          <Stat label="Total staked" value={ugx(staked)} icon={Ticket} />
          <Stat
            label="Gross gaming revenue"
            value={ugx(ggr)}
            tone={ggr >= 0 ? "green" : "red"}
            icon={Banknote}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6 md:gap-3">
        <Stat label="Users" value={String(users.length)} sub={`${online} online now`} icon={Users} />
        <Stat
          label="Agents"
          value={String(agents.length)}
          sub={`${agents.filter((a) => a.status === "active").length} active`}
          icon={Store}
        />
        <Stat label="Partners" value={String(partners.length)} icon={Handshake} />
        <Stat label="Affiliates" value={String(affiliates.length)} icon={UserRound} />
        <Stat label="Pending tickets" value={String(pending.length)} icon={Ticket} tone="blue" />
        <Stat label="Activities" value={String(activities.length)} />
      </div>

      <div className="grid gap-2 md:gap-3 xl:grid-cols-2">
        <Panel
          title="Latest tickets"
          action={
            <Link to="/admin/bets" className="text-[10px] font-bold text-xb-blue">
              View all
            </Link>
          }
        >
          <Table head={["Code", "Player", "Stake", "Payout", "Status", "Placed"]}>
            {bets.slice(0, 8).map((b) => {
              const u = users.find((x) => x.id === b.userId);
              return (
                <tr key={b.id} className="border-b border-xb-line/60 last:border-0">
                  <td className="px-2 py-1.5 font-bold">
                    <Link to="/admin/bets/$betId" params={{ betId: b.id }} className="text-xb-blue">
                      {b.code}
                    </Link>
                  </td>
                  <td className="px-2 py-1.5">{u?.name ?? "—"}</td>
                  <td className="px-2 py-1.5">{ugx(b.stake)}</td>
                  <td className="px-2 py-1.5 font-bold">{ugx(betPayout(b))}</td>
                  <td className="px-2 py-1.5">
                    <Badge value={b.status} />
                  </td>
                  <td className="px-2 py-1.5 text-xb-text-muted">{timeAgo(b.placedAt)}</td>
                </tr>
              );
            })}
          </Table>
        </Panel>

        <Panel
          title="Live activity"
          action={
            <Link to="/admin/activities" className="text-[10px] font-bold text-xb-blue">
              View all
            </Link>
          }
        >
          <ul className="space-y-1.5">
            {activities.slice(0, 9).map((a) => (
              <li key={a.id} className="flex items-center gap-2 rounded-lg bg-xb-panel-alt px-2 py-1.5">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-xb-blue/15 text-[9px] font-black text-xb-blue">
                  {a.actorName.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-bold text-xb-text">
                    {a.actorName} · {a.action}
                  </p>
                  <p className="truncate text-[10px] text-xb-text-muted">
                    {a.target} · {a.actorType}
                  </p>
                </div>
                <Link
                  to="/admin/activities/$activityId"
                  params={{ activityId: a.id }}
                  className="shrink-0 text-[10px] font-bold text-xb-blue"
                >
                  {timeAgo(a.at)}
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel
        title="Recent transactions"
        action={
          <Link to="/admin/transactions" className="text-[10px] font-bold text-xb-blue">
            View all
          </Link>
        }
      >
        <Table head={["Ref", "Actor", "Type", "Amount", "Method", "Status", "When"]}>
          {state.transactions.slice(0, 10).map((t) => (
            <tr key={t.id} className="border-b border-xb-line/60 last:border-0">
              <td className="px-2 py-1.5 font-bold">
                <Link to="/admin/transactions/$txId" params={{ txId: t.id }} className="text-xb-blue">
                  {t.reference}
                </Link>
              </td>
              <td className="px-2 py-1.5">{t.actorName}</td>
              <td className="px-2 py-1.5">{t.kind}</td>
              <td
                className={`px-2 py-1.5 font-bold ${t.amount < 0 ? "text-xb-red" : "text-xb-green"}`}
              >
                {ugx(t.amount)}
              </td>
              <td className="px-2 py-1.5 text-xb-text-muted">{t.method}</td>
              <td className="px-2 py-1.5">
                <Badge value={t.status} />
              </td>
              <td className="px-2 py-1.5 text-xb-text-muted">{timeAgo(t.at)}</td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}

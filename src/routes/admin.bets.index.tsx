import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useAdmin } from "@/components/admin/AdminDataContext";
import { betOdds, betPayout } from "@/lib/admin-seed";
import { Badge, Btn, Empty, Panel, Stat, Table, inputCls, timeAgo, ugx } from "@/components/admin/ui";

export const Route = createFileRoute("/admin/bets/")({
  component: BetsPage,
});

const tabs = ["all", "pending", "won", "lost", "cancelled"] as const;

function BetsPage() {
  const { state, setBetStatus, deleteBet } = useAdmin();
  const navigate = useNavigate();
  const [tab, setTab] = useState<(typeof tabs)[number]>("all");
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return state.bets.filter((b) => {
      if (tab !== "all" && b.status !== tab) return false;
      if (!n) return true;
      const u = state.users.find((x) => x.id === b.userId);
      return [b.code, u?.name ?? "", u?.phone ?? ""].some((v) => v.toLowerCase().includes(n));
    });
  }, [state.bets, state.users, tab, q]);

  const sum = (s: string) => state.bets.filter((b) => b.status === s);

  return (
    <div className="space-y-2 md:space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <Stat label="All tickets" value={String(state.bets.length)} />
        <Stat
          label="Pending liability"
          value={ugx(sum("pending").reduce((a, b) => a + betPayout(b), 0))}
          tone="blue"
          big
        />
        <Stat label="Won" value={String(sum("won").length)} tone="green" />
        <Stat label="Lost" value={String(sum("lost").length)} tone="red" />
      </div>

      <Panel title={`Tickets (${list.length})`}>
        <div className="mb-2 flex flex-wrap gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search ticket code or player…"
            className={`${inputCls} min-w-[200px] flex-1`}
          />
          <div className="flex flex-wrap gap-1">
            {tabs.map((t) => (
              <Btn key={t} size="xs" tone={tab === t ? "primary" : "default"} onClick={() => setTab(t)}>
                {t}
              </Btn>
            ))}
          </div>
        </div>
        {list.length === 0 ? (
          <Empty text="No tickets found." />
        ) : (
          <Table head={["Code", "Player", "Events", "Stake", "Odds", "Payout", "Status", "Placed", "Actions"]}>
            {list.map((b) => {
              const u = state.users.find((x) => x.id === b.userId);
              return (
                <tr
                  key={b.id}
                  className="cursor-pointer border-b border-xb-line/60 last:border-0 hover:bg-xb-panel-alt"
                  onClick={() => navigate({ to: "/admin/bets/$betId", params: { betId: b.id } })}
                >
                  <td className="px-2 py-1.5 font-bold text-xb-blue">{b.code}</td>
                  <td className="px-2 py-1.5">{u?.name ?? "—"}</td>
                  <td className="px-2 py-1.5">{b.matches.length}</td>
                  <td className="px-2 py-1.5">{ugx(b.stake)}</td>
                  <td className="px-2 py-1.5">{betOdds(b).toFixed(2)}</td>
                  <td className="px-2 py-1.5 font-bold">{ugx(betPayout(b))}</td>
                  <td className="px-2 py-1.5">
                    <Badge value={b.status} />
                  </td>
                  <td className="px-2 py-1.5 text-xb-text-muted">{timeAgo(b.placedAt)}</td>
                  <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
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
                      <Btn
                        size="xs"
                        tone="ghost"
                        onClick={() => {
                          deleteBet(b.id);
                          toast.success("Ticket deleted");
                        }}
                      >
                        Delete
                      </Btn>
                      <Link
                        to="/admin/bets/$betId"
                        params={{ betId: b.id }}
                        className="rounded bg-xb-odds px-2 py-1 text-[10px] font-bold"
                      >
                        Open
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </Panel>
    </div>
  );
}

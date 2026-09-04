import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAdmin } from "@/components/admin/AdminDataContext";
import { TicketPreview } from "@/components/admin/TicketPreview";
import { betToTicket } from "@/lib/bet-ticket";
import { betOdds, betPayout } from "@/lib/admin-seed";
import {
  BackLink,
  Badge,
  Btn,
  Field,
  Panel,
  Stat,
  Table,
  dateTime,
  inputCls,
  ugx,
} from "@/components/admin/ui";

export const Route = createFileRoute("/admin/bets/$betId")({
  component: BetDetailPage,
});

function BetDetailPage() {
  const { betId } = Route.useParams();
  const navigate = useNavigate();
  const { state, setBetStatus, deleteBet, setMatchStatus, removeMatch, addMatch } = useAdmin();
  const bet = state.bets.find((b) => b.id === betId);
  const [leg, setLeg] = useState({ match: "", league: "", market: "1X2", pick: "Home", odds: 1.5 });
  const betOwner = state.users.find((u) => u.id === bet?.userId);

  // Same receipt payload the PDF export uses, so the admin sees exactly what
  // the player's printed ticket looks like.
  const ticket = useQuery({
    queryKey: ["admin-ticket", betId, bet?.status, bet?.matches.map((m) => `${m.id}:${m.status}`).join(",")],
    enabled: !!bet,
    queryFn: () =>
      betToTicket(bet!, {
        name: betOwner?.name ?? "Player",
        origin: typeof window === "undefined" ? "" : window.location.origin,
      }),
  });

  if (!bet) {
    return (
      <Panel title="Ticket not found">
        <BackLink to="/admin/bets" label="Back to tickets" />
      </Panel>
    );
  }
  const owner = state.users.find((u) => u.id === bet.userId);

  return (
    <div className="space-y-2 md:space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <BackLink to="/admin/bets" label="All bets" />
          <h2 className="text-lg font-black leading-tight text-xb-text">Ticket {bet.code}</h2>
          <p className="text-[11px] text-xb-text-muted">
            Placed {dateTime(bet.placedAt)} · {bet.matches.length} event(s)
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge value={bet.status} />
          <Btn size="xs" tone="green" onClick={() => setBetStatus(bet.id, "won")}>
            Mark won
          </Btn>
          <Btn size="xs" tone="red" onClick={() => setBetStatus(bet.id, "lost")}>
            Mark lost
          </Btn>
          <Btn size="xs" onClick={() => setBetStatus(bet.id, "cancelled")}>
            Cancel bet
          </Btn>
          <Btn
            size="xs"
            tone="red"
            onClick={() => {
              deleteBet(bet.id);
              toast.success("Ticket deleted");
              navigate({ to: "/admin/bets" });
            }}
          >
            Delete ticket
          </Btn>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <Stat label="Potential payout" value={ugx(betPayout(bet))} tone="green" big />
        <Stat label="Stake" value={ugx(bet.stake)} />
        <Stat label="Total odds" value={betOdds(bet).toFixed(2)} tone="blue" />
        <Stat label="Events" value={String(bet.matches.length)} />
      </div>

      <Panel title="Bet owner">
        {owner ? (
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0">
              <p className="text-sm font-black text-xb-text">{owner.name}</p>
              <p className="text-[11px] text-xb-text-muted">
                {owner.id} · {owner.phone} · {owner.email} · {owner.country}
              </p>
              <p className="text-[11px] text-xb-text-muted">
                Wallet <b className="text-xb-green">{ugx(owner.balance)}</b>
              </p>
            </div>
            <Link
              to="/admin/users/$userId"
              params={{ userId: owner.id }}
              className="ml-auto rounded-lg bg-xb-blue px-3 py-1.5 text-[11px] font-bold text-xb-on-dark"
            >
              View owner profile
            </Link>
          </div>
        ) : (
          <p className="text-[11px] text-xb-text-muted">Owner account has been deleted.</p>
        )}
      </Panel>

      <Panel title="Ticket preview (as printed)">
        {ticket.isPending && (
          <p className="py-6 text-center text-[11px] text-xb-text-muted">Building receipt…</p>
        )}
        {ticket.data && (
          <TicketPreview
            ticket={ticket.data}
            legControls={(i) => {
              const m = bet.matches[i];
              if (!m) return null;
              return (
                <>
                  <Btn size="xs" tone="green" onClick={() => setMatchStatus(bet.id, m.id, "won")}>
                    Won
                  </Btn>
                  <Btn size="xs" tone="red" onClick={() => setMatchStatus(bet.id, m.id, "lost")}>
                    Lost
                  </Btn>
                  <Btn size="xs" onClick={() => setMatchStatus(bet.id, m.id, "void")}>
                    Void
                  </Btn>
                  <Btn size="xs" tone="ghost" onClick={() => removeMatch(bet.id, m.id)}>
                    Remove
                  </Btn>
                </>
              );
            }}
          />
        )}
      </Panel>

      <Panel title={`Matches (${bet.matches.length})`}>
        <Table head={["Match", "League", "Market", "Pick", "Odds", "Kick-off", "Status", "Actions"]}>
          {bet.matches.map((m) => (
            <tr key={m.id} className="border-b border-xb-line/60 last:border-0">
              <td className="px-2 py-1.5 font-bold">{m.match}</td>
              <td className="px-2 py-1.5 text-xb-text-muted">{m.league}</td>
              <td className="px-2 py-1.5">{m.market}</td>
              <td className="px-2 py-1.5 font-bold">{m.pick}</td>
              <td className="px-2 py-1.5">{m.odds.toFixed(2)}</td>
              <td className="px-2 py-1.5 text-xb-text-muted">{dateTime(m.startsAt)}</td>
              <td className="px-2 py-1.5">
                <Badge value={m.status} />
              </td>
              <td className="px-2 py-1.5">
                <div className="flex flex-wrap gap-1">
                  <Btn size="xs" tone="green" onClick={() => setMatchStatus(bet.id, m.id, "won")}>
                    Won
                  </Btn>
                  <Btn size="xs" tone="red" onClick={() => setMatchStatus(bet.id, m.id, "lost")}>
                    Lost
                  </Btn>
                  <Btn size="xs" onClick={() => setMatchStatus(bet.id, m.id, "void")}>
                    Void
                  </Btn>
                  <Btn size="xs" tone="ghost" onClick={() => removeMatch(bet.id, m.id)}>
                    Remove
                  </Btn>
                </div>
              </td>
            </tr>
          ))}
        </Table>

        <div className="mt-3 grid gap-2 rounded-lg bg-xb-panel-alt p-2 sm:grid-cols-3 xl:grid-cols-6">
          <Field label="Match">
            <input className={inputCls} value={leg.match} onChange={(e) => setLeg({ ...leg, match: e.target.value })} />
          </Field>
          <Field label="League">
            <input className={inputCls} value={leg.league} onChange={(e) => setLeg({ ...leg, league: e.target.value })} />
          </Field>
          <Field label="Market">
            <input className={inputCls} value={leg.market} onChange={(e) => setLeg({ ...leg, market: e.target.value })} />
          </Field>
          <Field label="Pick">
            <input className={inputCls} value={leg.pick} onChange={(e) => setLeg({ ...leg, pick: e.target.value })} />
          </Field>
          <Field label="Odds">
            <input
              type="number"
              step="0.01"
              className={inputCls}
              value={leg.odds}
              onChange={(e) => setLeg({ ...leg, odds: Number(e.target.value) })}
            />
          </Field>
          <div className="flex items-end">
            <Btn
              tone="primary"
              onClick={() => {
                if (!leg.match.trim()) {
                  toast.error("Enter a match");
                  return;
                }
                addMatch(bet.id, { ...leg, startsAt: Date.now() + 3600_000, status: "pending" });
                setLeg({ match: "", league: "", market: "1X2", pick: "Home", odds: 1.5 });
                toast.success("Match added to ticket");
              }}
            >
              Add match
            </Btn>
          </div>
        </div>
      </Panel>
    </div>
  );
}

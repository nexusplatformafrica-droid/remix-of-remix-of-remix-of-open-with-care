import type { ReactNode } from "react";
import type { TicketPdfInput, LegStatus } from "@/lib/ticket-pdf";

const statusCls = (s: LegStatus | undefined) =>
  s === "lost"
    ? "bg-xb-red text-xb-on-dark"
    : s === "pending"
      ? "bg-xb-line text-xb-text"
      : "bg-xb-green text-xb-on-dark";

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-dashed border-xb-line px-3 py-1.5 last:border-0">
      <span className="text-[10px] uppercase tracking-wide text-xb-text-muted">{label}</span>
      <span className={`text-[12px] ${strong ? "font-black text-xb-green" : "font-bold text-xb-text"}`}>
        {value}
      </span>
    </div>
  );
}

/**
 * On-screen replica of the ticket PDF. `legControls` lets the admin manage each
 * selection right on the receipt it prints as.
 */
export function TicketPreview({
  ticket,
  legControls,
}: {
  ticket: TicketPdfInput;
  legControls?: (index: number) => ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[720px] overflow-hidden rounded-xl bg-xb-panel ring-1 ring-xb-line">
      <div className="flex items-center justify-between bg-xb-blue px-3 py-2 text-xb-on-dark">
        <div>
          <p className="text-[13px] font-black uppercase tracking-wide">BET PLUS+</p>
          <p className="text-[10px] opacity-80">Betting receipt</p>
        </div>
        <span className={`rounded px-2 py-1 text-[10px] font-black uppercase ${statusCls(ticket.status)}`}>
          {ticket.status ?? "won"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-3 bg-xb-panel-alt px-3 py-2 text-[11px] sm:grid-cols-4">
        <div>
          <p className="text-[9px] uppercase text-xb-text-muted">Ticket ID</p>
          <p className="font-black text-xb-text">{ticket.betId}</p>
        </div>
        <div>
          <p className="text-[9px] uppercase text-xb-text-muted">Player</p>
          <p className="truncate font-bold text-xb-text">{ticket.winner}</p>
        </div>
        <div>
          <p className="text-[9px] uppercase text-xb-text-muted">Placed</p>
          <p className="font-bold text-xb-text">{ticket.date}</p>
        </div>
        <div>
          <p className="text-[9px] uppercase text-xb-text-muted">Selections</p>
          <p className="font-bold text-xb-text">{ticket.game}</p>
        </div>
      </div>

      <div className="divide-y divide-xb-line">
        {ticket.legs.map((leg, i) => (
          <div key={`${leg.teams}-${i}`} className="px-3 py-2">
            <div className="flex items-start gap-2">
              <span
                className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-black uppercase ${statusCls(leg.status)}`}
              >
                {leg.status ?? "pending"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-black text-xb-text">{leg.teams}</p>
                <p className="truncate text-[10px] text-xb-text-muted">
                  {leg.league} · {leg.time}
                  {leg.score ? ` · ${leg.score}` : ""}
                </p>
                <p className="truncate text-[11px] text-xb-blue">{leg.market}</p>
              </div>
              <span className="shrink-0 text-[13px] font-black text-xb-text">{leg.odds}</span>
            </div>
            {legControls && <div className="mt-1.5 flex flex-wrap gap-1">{legControls(i)}</div>}
          </div>
        ))}
      </div>

      <div className="bg-xb-panel-alt">
        <Row label="Total odds" value={ticket.odds} />
        <Row label="Stake" value={ticket.stake} />
        <Row label="Bonus" value={ticket.bonus} />
        <Row label="Potential win" value={ticket.potential} />
        <Row label="Payout" value={ticket.payout} strong />
      </div>

      <div className="flex flex-col items-center gap-1 px-3 py-3">
        <div className="flex h-10 w-full max-w-[280px] items-end gap-[2px] overflow-hidden">
          {ticket.barcodeValue.split("").map((c, i) => (
            <span
              key={i}
              className="flex-1 bg-xb-text"
              style={{ height: `${40 + ((c.charCodeAt(0) * 7) % 60)}%` }}
            />
          ))}
        </div>
        <p className="text-[10px] tracking-[0.2em] text-xb-text-muted">{ticket.barcodeValue}</p>
      </div>
    </div>
  );
}

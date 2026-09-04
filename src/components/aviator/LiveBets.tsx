import { useState } from "react";

import { Avatar } from "./Avatar";
import { formatMoney, formatMultiplier, maskName, type BetRow } from "@/lib/aviator/game";

type Tab = "all" | "mine" | "top";

const tabs: { key: Tab; label: string }[] = [
  { key: "all", label: "All Bets" },
  { key: "mine", label: "My Bets" },
  { key: "top", label: "Top" },
];

function Row({ bet }: { bet: BetRow }) {
  const won = bet.result === "won";
  const lost = bet.result === "lost";

  return (
    <div
      className={`grid grid-cols-[1fr_auto_auto_auto] items-center gap-1 rounded-md px-2 py-1 text-[11px] ${
        won ? "bg-success/12 ring-1 ring-success/35" : "odd:bg-elevated/40"
      }`}
    >
      <span className="flex items-center gap-1.5 truncate">
        <Avatar username={bet.name} seed={bet.userId} size={18} />
        <span className="truncate text-muted-foreground">{maskName(bet.name)}</span>
      </span>
      <span className="tabular-nums text-foreground/90">{formatMoney(bet.amount)}</span>
      <span
        className={`chip-mult w-[52px] justify-center ${
          won ? "bg-success/25 text-success" : lost ? "text-muted-foreground/60" : "text-muted-foreground/60"
        }`}
      >
        {bet.cashoutMultiplier ? formatMultiplier(bet.cashoutMultiplier) : "—"}
      </span>
      <span className={`w-[62px] text-right tabular-nums ${won ? "text-success" : "text-muted-foreground/50"}`}>
        {won ? formatMoney(bet.payout ?? 0) : "—"}
      </span>
    </div>
  );
}

export function LiveBets({
  roundBets,
  myBets,
  topWins,
  currency,
}: {
  roundBets: BetRow[];
  myBets: BetRow[];
  topWins: BetRow[];
  currency: string;
}) {
  const [tab, setTab] = useState<Tab>("all");
  const list = tab === "all" ? roundBets : tab === "mine" ? myBets : topWins;
  const total = roundBets.reduce((sum, bet) => sum + bet.amount, 0);

  return (
    <section className="panel-surface flex h-full min-h-0 flex-col">
      <div className="flex gap-1 border-b border-border p-1.5">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`flex-1 rounded-md py-1 font-display text-[11px] uppercase tracking-wide transition-colors ${
              tab === item.key
                ? "bg-elevated text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between px-2.5 py-2 text-[11px] text-muted-foreground">
        <span className="font-display uppercase tracking-wide">
          {tab === "all"
            ? `Total bets: ${roundBets.length}`
            : tab === "mine"
              ? "Your bets"
              : "Biggest wins"}
        </span>
        {tab === "all" ? (
          <span className="tabular-nums">
            {formatMoney(total)} {currency}
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-1 px-2 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground/70">
        <span>Player</span>
        <span>Bet</span>
        <span className="w-[52px] text-center">Coeff.</span>
        <span className="w-[62px] text-right">Win</span>
      </div>

      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-1.5 pb-2 xb-slimscroll">
        {list.length === 0 ? (
          <p className="px-2 py-6 text-center text-[11px] text-muted-foreground">
            No bets yet for this round.
          </p>
        ) : (
          list.map((bet) => <Row key={bet.id} bet={bet} />)
        )}
      </div>
    </section>
  );
}
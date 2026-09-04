import { useState } from "react";
import { X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useBetSlip } from "./BetSlipContext";
import { money, useAuth } from "./AuthContext";

const quickStakes = [500, 1000, 5000, 10000];

export function MobileBetSlip({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { selections, remove, clear, totalOdds } = useBetSlip();
  const { user, addBet, openLogin, bets } = useAuth();
  const [tab, setTab] = useState<"slip" | "mybets">("slip");
  const [stake, setStake] = useState("1000");
  const [placing, setPlacing] = useState(false);

  const stakeNum = Number(stake) || 0;
  const payout = stakeNum * totalOdds;

  const placeBet = async () => {
    if (!user) {
      onOpenChange(false);
      toast.error("Log in to place a bet");
      openLogin();
      return;
    }
    if (selections.length === 0) {
      toast.error("Add at least one event to the bet slip");
      return;
    }
    if (stakeNum <= 0) {
      toast.error("Enter a stake amount");
      return;
    }
    setPlacing(true);
    try {
      await addBet({
        events: selections.length,
        stake: stakeNum,
        odds: totalOdds,
        matches: selections.map((s) => ({
          event: s.event,
          market: s.market,
          odd: s.odd,
          matchId: s.matchId,
          sport: s.sport,
          league: s.league,
          startsAt: s.kickoff ? Date.parse(s.kickoff) || undefined : undefined,
        })),
      });
      toast.success("Bet placed!", {
        description: `${selections.length} event(s) · possible win ${money(payout)}`,
      });
      clear();
      setTab("mybets");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPlacing(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[85dvh] rounded-t-2xl border-xb-line bg-xb-panel p-0 font-xb"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Bet slip</SheetTitle>
        </SheetHeader>

        <div className="grid grid-cols-2 border-b border-xb-line">
          {(["slip", "mybets"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`border-b-2 py-3 text-[13px] font-bold transition-colors ${
                tab === t
                  ? "border-xb-blue bg-xb-odds text-xb-text"
                  : "border-transparent text-xb-text-muted"
              }`}
            >
              {t === "slip"
                ? `Bet slip${selections.length ? ` (${selections.length})` : ""}`
                : `My bets${bets.length ? ` (${bets.length})` : ""}`}
            </button>
          ))}
        </div>

        {tab === "slip" ? (
          <div className="flex max-h-[70dvh] flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {selections.length === 0 ? (
                <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-xb-line px-6 text-center text-[13px] text-xb-text-muted">
                  Tap any odd to add it to your bet slip
                </div>
              ) : (
                <div className="space-y-1.5">
                  {selections.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-start justify-between gap-2 rounded-xl bg-xb-odds px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[13px] text-xb-text">{s.event}</div>
                        <div className="text-[11px] text-xb-text-muted">{s.market}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-[13px] font-bold text-xb-blue">
                          {s.odd.toFixed(2)}
                        </span>
                        <button aria-label="Remove selection" onClick={() => remove(s.id)}>
                          <X className="h-4 w-4 text-xb-text-muted" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={clear}
                    className="flex items-center gap-1 pt-1 text-[12px] text-xb-text-muted"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Clear all
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-2 border-t border-xb-line bg-xb-panel-alt p-3 pb-6">
              <div className="flex gap-2">
                {quickStakes.map((v) => (
                  <button
                    key={v}
                    onClick={() => setStake(String(v))}
                    className="flex-1 rounded-lg bg-xb-odds py-1.5 text-[11px] font-bold text-xb-text"
                  >
                    {v.toLocaleString()}
                  </button>
                ))}
              </div>
              <input
                value={stake}
                onChange={(e) => setStake(e.target.value.replace(/[^\d.]/g, ""))}
                inputMode="decimal"
                placeholder="Bet amount"
                className="w-full rounded-lg bg-xb-panel px-3 py-2.5 text-[14px] font-bold text-xb-text outline-none placeholder:text-xb-text-muted"
              />
              <div className="flex items-center justify-between text-[12px] text-xb-text">
                <span>Total odds</span>
                <span className="font-bold">{totalOdds.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-[12px] text-xb-text">
                <span>Possible win</span>
                <span className="font-bold text-xb-green-dark">{money(payout)}</span>
              </div>
              <button
                onClick={placeBet}
                disabled={placing}
                className="w-full rounded-lg bg-xb-green py-3 text-[14px] font-bold text-xb-on-dark disabled:opacity-60"
              >
                {placing ? "PLACING…" : "PLACE BET"}
              </button>
            </div>
          </div>
        ) : (
          <div className="max-h-[70dvh] space-y-1.5 overflow-y-auto p-3 pb-8">
            {bets.length === 0 ? (
              <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-xb-line text-center text-[13px] text-xb-text-muted">
                You have no placed bets yet
              </div>
            ) : (
              bets.map((b) => (
                <div key={b.id} className="rounded-xl bg-xb-odds px-3 py-2.5 text-[12px]">
                  <div className="flex justify-between text-xb-text">
                    <span>{b.events} event(s)</span>
                    <span className="font-bold text-xb-blue">{b.odds.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-xb-text-muted">
                    <span>Stake {money(b.stake)}</span>
                    <span>Win {money(b.stake * b.odds)}</span>
                  </div>
                  <div
                    className={`mt-1 text-[10px] font-bold uppercase ${
                      b.status === "won"
                        ? "text-xb-green"
                        : b.status === "lost"
                          ? "text-xb-red"
                          : "text-xb-text-muted"
                    }`}
                  >
                    {b.status === "open" ? "pending" : b.status}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { formatMoney, formatMultiplier, type BetRow, type Phase } from "@/lib/aviator/game";
import type { AviatorMoneyRules } from "@/lib/aviator-config";

type Props = {
  slot: number;
  phase: Phase;
  roundId: string | null;
  nextRoundId: string | null;
  multiplier: number;
  balance: number;
  signedIn: boolean;
  bets: BetRow[];
  rules: AviatorMoneyRules;
  onPlace: (input: { amount: number; autoCashout: number | null; roundId: string; slot: number }) => Promise<void>;
  onCashOut: (bet: BetRow, multiplier: number) => Promise<void>;
  onCancel: (bet: BetRow) => Promise<void>;
};

export function BetPanel({
  slot,
  phase,
  roundId,
  nextRoundId,
  multiplier,
  balance,
  signedIn,
  bets,
  rules,
  onPlace,
  onCashOut,
  onCancel,
}: Props) {
  const { min, max, step, currency, chips } = rules;
  const clamp = (value: number) =>
    Math.min(max, Math.max(min, Math.round(value * 100) / 100));
  const [amount, setAmount] = useState(min);
  const [autoBet, setAutoBet] = useState(false);
  const [autoCashEnabled, setAutoCashEnabled] = useState(false);
  const [autoCashValue, setAutoCashValue] = useState(2);
  const [mode, setMode] = useState<"bet" | "auto">("bet");
  const [busy, setBusy] = useState(false);
  const autoPlacedRef = useRef<string | null>(null);

  useEffect(() => {
    setAmount((value) => Math.min(max, Math.max(min, value)));
  }, [min, max]);

  const currentBet = bets.find((bet) => bet.roundId === roundId && bet.slot === slot) ?? null;
  const queuedBet = bets.find((bet) => bet.roundId === nextRoundId && bet.slot === slot) ?? null;
  const pendingCurrent = currentBet && currentBet.result === "pending" ? currentBet : null;

  const targetRoundId = phase === "betting" ? roundId : nextRoundId;
  const activeBet = phase === "betting" ? pendingCurrent : queuedBet;

  const place = async (targetId: string | null, silent = false) => {
    if (!signedIn) {
      toast.error("Log in to play");
      return;
    }
    if (!targetId) return;
    if (amount < min) {
      toast.error(`Minimum stake is ${formatMoney(min)} ${currency}`);
      return;
    }
    if (amount > max) {
      toast.error(`Maximum stake is ${formatMoney(max)} ${currency}`);
      return;
    }
    if (amount > balance) {
      toast.error("Insufficient balance");
      return;
    }
    setBusy(true);
    try {
      await onPlace({
        amount,
        autoCashout: autoCashEnabled ? autoCashValue : null,
        roundId: targetId,
        slot,
      });
      if (!silent) toast.success(`Bet placed: ${formatMoney(amount)} ${currency}`);
    } catch (error) {
      if (!silent) toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const cashOut = async () => {
    if (!pendingCurrent) return;
    setBusy(true);
    try {
      await onCashOut(pendingCurrent, multiplier);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!activeBet) return;
    setBusy(true);
    try {
      await onCancel(activeBet);
      toast.info("Bet cancelled");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  /* auto bet: place once per betting phase */
  useEffect(() => {
    if (!autoBet || !signedIn) return;
    if (phase !== "betting" || !roundId) return;
    if (pendingCurrent || autoPlacedRef.current === roundId) return;
    autoPlacedRef.current = roundId;
    void place(roundId, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoBet, phase, roundId, pendingCurrent, signedIn]);

  const potential = pendingCurrent ? pendingCurrent.amount * multiplier : 0;
  const showCashOut = phase === "flying" && pendingCurrent;

  return (
    <section className="panel-surface p-2.5">
      <div className="mb-2 flex items-center justify-center gap-1">
        <div className="flex rounded-full bg-elevated p-0.5">
          {(["bet", "auto"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setMode(item)}
              className={`rounded-full px-4 py-0.5 font-display text-[11px] uppercase tracking-wide transition-colors ${
                mode === item ? "bg-secondary text-foreground" : "text-muted-foreground"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_1.1fr] items-stretch gap-2.5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Decrease stake"
              onClick={() => setAmount((value) => clamp(value - step))}
              className="h-7 w-7 rounded-md bg-elevated font-display text-sm text-muted-foreground hover:text-foreground"
            >
              -
            </button>
            <input
              className="stepper-input text-center text-base"
              inputMode="decimal"
              value={amount}
              onChange={(event) => {
                const next = Number.parseFloat(event.target.value);
                setAmount(Number.isFinite(next) ? clamp(next) : min);
              }}
            />
            <button
              type="button"
              aria-label="Increase stake"
              onClick={() => setAmount((value) => clamp(value + step))}
              className="h-7 w-7 rounded-md bg-elevated font-display text-sm text-muted-foreground hover:text-foreground"
            >
              +
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1">
            {chips.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setAmount(clamp(value))}
                className="rounded-md bg-elevated py-1 font-display text-[11px] tabular-nums text-muted-foreground transition-colors hover:text-foreground"
              >
                {formatMoney(value)}
              </button>
            ))}
          </div>
        </div>

        {showCashOut ? (
          <button type="button" disabled={busy} onClick={() => void cashOut()} className="btn-cash py-1.5">
            <span className="text-xs">Cash out</span>
            <span className="text-base tabular-nums">{formatMoney(potential)}</span>
            <span className="text-[10px] font-normal normal-case tracking-normal">
              {formatMultiplier(multiplier)}
            </span>
          </button>
        ) : activeBet ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void cancel()}
            className="btn-cancel flex-col py-1.5"
          >
            <span className="text-xs">Cancel</span>
            <span className="text-[10px] font-normal normal-case tracking-normal opacity-90">
              {phase === "betting" ? "Bet accepted" : "Waiting for next round"}
            </span>
          </button>
        ) : (
          <button
            type="button"
            disabled={busy || !targetRoundId}
            onClick={() => void place(targetRoundId)}
            className="btn-bet py-1.5"
          >
            <span className="text-xs">Bet</span>
            <span className="text-base tabular-nums">{formatMoney(amount)}</span>
            {phase !== "betting" ? (
              <span className="text-[10px] font-normal normal-case tracking-normal">next round</span>
            ) : null}
          </button>
        )}
      </div>

      {mode === "auto" ? (
        <div className="mt-2.5 grid grid-cols-2 gap-2 border-t border-border pt-2.5">
          <label className="flex items-center justify-between gap-2 rounded-md bg-elevated px-2 py-1.5 text-[11px]">
            <span className="font-display uppercase tracking-wide text-muted-foreground">
              Auto bet
            </span>
            <input
              type="checkbox"
              checked={autoBet}
              onChange={(event) => setAutoBet(event.target.checked)}
              className="h-3.5 w-3.5"
            />
          </label>
          <div className="rounded-md bg-elevated px-2 py-1.5">
            <label className="flex items-center justify-between gap-2 text-[11px]">
              <span className="font-display uppercase tracking-wide text-muted-foreground">
                Auto cash out
              </span>
              <input
                type="checkbox"
                checked={autoCashEnabled}
                onChange={(event) => setAutoCashEnabled(event.target.checked)}
                className="h-3.5 w-3.5"
              />
            </label>
            <input
              className="stepper-input mt-1 text-center text-xs"
              inputMode="decimal"
              value={autoCashValue}
              disabled={!autoCashEnabled}
              onChange={(event) => {
                const next = Number.parseFloat(event.target.value);
                setAutoCashValue(Number.isFinite(next) ? Math.min(200, Math.max(1.01, next)) : 1.01);
              }}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
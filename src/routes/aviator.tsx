import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Lock, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/xbet/AuthContext";
import { ClientOnly } from "@/components/xbet/ClientOnly";
import { BetPanel } from "@/components/aviator/BetPanel";
import { ChatPanel } from "@/components/aviator/ChatPanel";
import { GameCanvas } from "@/components/aviator/GameCanvas";
import { HistoryBar } from "@/components/aviator/HistoryBar";
import { LiveBets } from "@/components/aviator/LiveBets";
import { LoadingScreen } from "@/components/aviator/LoadingScreen";
import { moneyRulesFor } from "@/lib/aviator-config";
import { formatMoney, formatMultiplier, type BetRow } from "@/lib/aviator/game";
import {
  useAmbientChat,
  useAviatorRound,
  useRoundTable,
  useTopWins,
} from "@/lib/aviator/useAviator";
import type { ChatMessage } from "@/lib/aviator/table";
import { roundById } from "@/lib/aviator/engine";
import { serverNow } from "@/lib/server-time";
import { useCountryLocale } from "@/lib/site-country";
import splashAsset from "@/assets/aviator/splash.jpg.asset.json";

function AviatorWordmark() {
  return (
    <span className="font-display text-lg font-extrabold uppercase leading-none tracking-[0.12em] sm:text-xl">
      <span className="text-foreground">BET</span>
      <span className="text-[hsl(210_100%_56%)]">PLUS+</span>
    </span>
  );
}

export const Route = createFileRoute("/aviator")({
  head: () => ({
    links: [{ rel: "preload", as: "image", href: splashAsset.url, fetchpriority: "high" }],
    meta: [
      { title: "Aviator Crash Game — BET PLUS+" },
      {
        name: "description",
        content:
          "Play the live Aviator crash game at BET PLUS+: place a stake, watch the multiplier climb and cash out before the plane flies away.",
      },
      { property: "og:title", content: "Aviator Crash Game — BET PLUS+" },
      {
        property: "og:description",
        content:
          "Live crash game with instant cash-out, played straight from your BET PLUS+ balance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AviatorPage,
});

function AviatorPage() {
  return (
    <ClientOnly fallback={<LoadingScreen />}>
      <AviatorGate />
    </ClientOnly>
  );
}

/**
 * Hard login wall: the game itself is never mounted for a signed-out visitor,
 * so there is no round, no bet panel and no canvas to reach around the overlay.
 */
function AviatorGate() {
  const { user, loading, openLogin, openRegister } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <AviatorLocked onLogin={openLogin} onRegister={openRegister} />;
  return <AviatorGame />;
}

function AviatorLocked({ onLogin, onRegister }: { onLogin: () => void; onRegister: () => void }) {
  return (
    <div className="aviator-root fixed inset-0 z-[45] flex flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
        <Link
          to="/"
          aria-label="Go back"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-elevated text-foreground/80 transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <AviatorWordmark />
      </header>
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-2xl">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-elevated">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <h2 className="font-display text-base font-bold text-foreground">Aviator is locked</h2>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Log in or create an account to play Aviator with your BET PLUS+ balance.
          </p>
          <div className="mt-4 space-y-2">
            <button type="button" onClick={onLogin} className="btn-bet w-full py-3 text-[13px]">
              Log in
            </button>
            <button
              type="button"
              onClick={onRegister}
              className="w-full rounded-xl bg-secondary py-3 font-display text-[13px] font-bold uppercase text-foreground"
            >
              Register
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AviatorGame() {
  const { user, balance, currency, stakeGame, creditWin } = useAuth();
  const loc = useCountryLocale();
  const snapshot = useAviatorRound();
  const { round, nextRound, phase, multiplier, countdown, history } = snapshot;

  const userId = user?.id ?? null;
  const playerName = user?.name || user?.label || "Player";
  const rules = useMemo(
    () => moneyRulesFor(currency || loc.country.currency),
    [currency, loc.country.currency],
  );

  const tableBets = useRoundTable(snapshot, rules.min);
  const topWins = useTopWins(history, rules.min);
  const ambientChat = useAmbientChat(history);

  /* The player's own bets live in memory only — the game persists nothing. */
  const [myBets, setMyBets] = useState<BetRow[]>([]);
  const [mine, setMine] = useState<ChatMessage[]>([]);
  const [muted, setMuted] = useState(true);
  const settledRef = useRef(new Set<string>());

  const roundBets = useMemo(() => {
    const own = myBets.filter((bet) => bet.roundId === round?.id);
    return [...own, ...tableBets];
  }, [myBets, tableBets, round?.id]);

  const chat = useMemo(
    () => [...ambientChat, ...mine].sort((a, b) => a.at - b.at).slice(-60),
    [ambientChat, mine],
  );

  const patchBet = useCallback((id: string, patch: Partial<BetRow>) => {
    setMyBets((rows) => rows.map((bet) => (bet.id === id ? { ...bet, ...patch } : bet)));
  }, []);

  const cashOut = useCallback(
    async (bet: BetRow, at: number) => {
      const target = Math.floor(at * 100) / 100;
      const payout = Math.round(bet.amount * target * 100) / 100;
      patchBet(bet.id, { result: "won", cashoutMultiplier: target, payout });
      creditWin(payout, "Aviator");
      toast.success(`Cashed out ${formatMultiplier(target)} — ${formatMoney(payout)} ${rules.currency}`);
    },
    [creditWin, patchBet, rules.currency],
  );

  /* Settle my pending bets: auto cash-out wins, everything else loses at crash. */
  useEffect(() => {
    const now = serverNow().getTime();
    for (const bet of myBets) {
      if (bet.result !== "pending") continue;
      if (settledRef.current.has(bet.id)) continue;
      const betRound = roundById(bet.roundId, now);
      if (!betRound || now < betRound.flightStartsAt) continue;

      const auto = bet.autoCashout;
      const autoHit = auto != null && auto <= betRound.crashPoint;
      const live = bet.roundId === round?.id && phase === "flying";

      if (autoHit && (!live || multiplier >= auto)) {
        settledRef.current.add(bet.id);
        void cashOut(bet, auto).catch(() => settledRef.current.delete(bet.id));
        continue;
      }
      if (now >= betRound.crashAt) {
        settledRef.current.add(bet.id);
        patchBet(bet.id, { result: "lost", payout: 0 });
      }
    }
  }, [myBets, round?.id, phase, multiplier, cashOut, patchBet]);

  const place = useCallback(
    // eslint-disable-next-line @typescript-eslint/require-await
    async (input: { amount: number; autoCashout: number | null; roundId: string; slot: number }) => {
      if (!userId) throw new Error("Log in to play");
      if (!stakeGame(input.amount, "Aviator")) throw new Error("Insufficient balance");
      setMyBets((rows) => [
        {
          id: `me-${input.roundId}-${input.slot}`,
          roundId: input.roundId,
          userId,
          name: playerName,
          slot: input.slot,
          amount: input.amount,
          autoCashout: input.autoCashout,
          cashoutMultiplier: null,
          payout: null,
          result: "pending" as const,
          at: Date.now(),
        },
        ...rows.filter((bet) => !(bet.roundId === input.roundId && bet.slot === input.slot)),
      ]);
    },
    [userId, playerName, stakeGame],
  );

  const cancel = useCallback(
    async (bet: BetRow) => {
      setMyBets((rows) => rows.filter((row) => row.id !== bet.id));
      creditWin(bet.amount, "Aviator refund");
    },
    [creditWin],
  );

  const manualCashOut = useCallback(
    async (bet: BetRow, at: number) => {
      if (settledRef.current.has(bet.id)) return;
      settledRef.current.add(bet.id);
      try {
        await cashOut(bet, at);
      } catch (error) {
        settledRef.current.delete(bet.id);
        throw error;
      }
    },
    [cashOut],
  );

  const sendChat = useCallback(
    (message: string) => {
      if (!userId) return;
      setMine((rows) => [
        ...rows.slice(-30),
        { id: `me-${Date.now()}`, userId, name: playerName, message, at: Date.now() },
      ]);
    },
    [userId, playerName],
  );

  const signedIn = Boolean(userId);

  return (
    <div className="aviator-root fixed inset-0 z-[45] flex flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <Link
            to="/"
            aria-label="Go back"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-elevated text-foreground/80 transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <AviatorWordmark />
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-elevated px-3 py-1 font-display text-xs tabular-nums text-foreground">
            {formatMoney(balance)}{" "}
            <span className="text-[10px] text-muted-foreground">{rules.currency}</span>
          </span>
          <button
            type="button"
            onClick={() => setMuted((value) => !value)}
            aria-label={muted ? "Unmute" : "Mute"}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-elevated text-muted-foreground hover:text-foreground"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>
      </header>

      <HistoryBar rounds={history} />

      <div className="grid min-h-0 flex-1 content-start gap-2 overflow-y-auto p-2 xb-slimscroll lg:grid-cols-[260px_1fr_260px] lg:content-stretch lg:overflow-hidden">
        <div className="hidden min-h-0 lg:block">
          <LiveBets
            roundBets={roundBets}
            myBets={myBets}
            topWins={topWins}
            currency={rules.currency}
          />
        </div>

        <div className="flex min-h-0 flex-col gap-2">
          <div className="aspect-[16/9] min-h-[210px] w-full shrink-0 sm:aspect-[2/1] lg:min-h-[220px] lg:flex-1 lg:shrink">
            <GameCanvas
              phase={phase}
              multiplier={multiplier}
              countdown={countdown}
              roundNumber={round?.roundNumber ?? null}
            />
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {[1, 2].map((slot) => (
              <div key={slot} className={slot === 2 ? "hidden md:block" : "min-w-0"}>
                <BetPanel
                  slot={slot}
                  phase={phase}
                  roundId={round?.id ?? null}
                  nextRoundId={nextRound?.id ?? null}
                  multiplier={multiplier}
                  balance={balance}
                  signedIn={signedIn}
                  bets={myBets}
                  rules={rules}
                  onPlace={place}
                  onCashOut={manualCashOut}
                  onCancel={cancel}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-2">
          <div className="h-[420px] min-h-0 lg:hidden">
            <LiveBets
              roundBets={roundBets}
              myBets={myBets}
              topWins={topWins}
              currency={rules.currency}
            />
          </div>
          <div className="hidden min-h-[260px] flex-1 lg:block">
            <ChatPanel
              messages={chat}
              userId={userId}
              onSend={sendChat}
              onlineCount={Math.max(roundBets.length, 1)}
            />
          </div>
        </div>
      </div>

    </div>
  );
}

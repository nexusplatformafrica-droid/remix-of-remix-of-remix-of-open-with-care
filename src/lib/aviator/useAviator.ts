import { useEffect, useMemo, useState } from "react";
import { serverNow, syncServerTime } from "@/lib/server-time";
import { snapshotAt, type Snapshot } from "./engine";
import { chatFor, tableFor, topWinsFor, type ChatMessage } from "./table";
import type { BetRow } from "./game";

/**
 * Live round state. The round is a pure function of internet time, so every
 * player is on the same round and a player who was offline resyncs instantly.
 */
export function useAviatorRound(): Snapshot {
  const [state, setState] = useState<Snapshot>(() => snapshotAt(Date.now()));

  useEffect(() => {
    void syncServerTime();
    let frame = 0;
    const tick = () => setState(snapshotAt(serverNow().getTime()));
    const loop = () => {
      tick();
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    const resync = () => {
      void syncServerTime();
      tick();
    };
    const timer = window.setInterval(tick, 250);
    document.addEventListener("visibilitychange", resync);
    window.addEventListener("focus", resync);
    window.addEventListener("online", resync);
    window.addEventListener("pageshow", resync);
    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", resync);
      window.removeEventListener("focus", resync);
      window.removeEventListener("online", resync);
      window.removeEventListener("pageshow", resync);
    };
  }, []);

  return state;
}

/** Everyone's bets on the live round, derived from the round seed. */
export function useRoundTable(snapshot: Snapshot, min: number): BetRow[] {
  const { round, phase, multiplier } = snapshot;
  const step = Math.floor(multiplier * 20);
  return useMemo(
    () => tableFor(round, phase, multiplier, min),
    // Recomputed in multiplier steps so cash-outs reveal smoothly without
    // rebuilding the table on every animation frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [round?.id, phase, step, min],
  );
}

export function useTopWins(history: Snapshot["history"], min: number): BetRow[] {
  const key = history[0]?.id ?? "";
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => topWinsFor(history, min), [key, min]);
}

export function useAmbientChat(history: Snapshot["history"]): ChatMessage[] {
  const key = history[0]?.id ?? "";
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => chatFor(history), [key]);
}

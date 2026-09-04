import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type Selection = {
  id: string;
  /** Groups selections by fixture so only one odd per match can be active. */
  matchId: string;
  event: string;
  market: string;
  odd: number;
  /** Fixture metadata carried onto the placed-bet ticket. */
  sport?: string | undefined;
  league?: string | undefined;
  /** Kick-off ISO timestamp. */
  kickoff?: string | undefined;
};

type BetSlipCtx = {
  selections: Selection[];
  toggle: (s: Selection) => void;
  remove: (id: string) => void;
  clear: () => void;
  has: (id: string) => boolean;
  totalOdds: number;
};

const Ctx = createContext<BetSlipCtx | null>(null);

export function BetSlipProvider({ children }: { children: ReactNode }) {
  const [selections, setSelections] = useState<Selection[]>([]);

  const value = useMemo<BetSlipCtx>(() => {
    return {
      selections,
      toggle: (s) =>
        setSelections((prev) => {
          if (prev.some((p) => p.id === s.id)) return prev.filter((p) => p.id !== s.id);
          // Replace any other pick from the same match — one odd per match only.
          return [...prev.filter((p) => p.matchId !== s.matchId), s];
        }),
      remove: (id) => setSelections((prev) => prev.filter((p) => p.id !== id)),
      clear: () => setSelections([]),
      has: (id) => selections.some((p) => p.id === id),
      totalOdds: selections.reduce((acc, s) => acc * s.odd, 1),
    };
  }, [selections]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBetSlip() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useBetSlip must be used within BetSlipProvider");
  return ctx;
}

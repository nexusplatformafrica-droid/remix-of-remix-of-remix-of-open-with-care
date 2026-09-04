import { formatMultiplier, multiplierTone } from "@/lib/aviator/game";
import type { EngineRound } from "@/lib/aviator/engine";

const toneClass: Record<string, string> = {
  low: "text-low",
  mid: "text-mid",
  high: "text-high",
};

export function HistoryBar({ rounds }: { rounds: EngineRound[] }) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto px-2 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {rounds.slice(0, 22).map((round) => (
        <span
          key={round.id}
          className={`chip-mult shrink-0 border border-border ${toneClass[multiplierTone(round.crashPoint)]}`}
          title={`Round #${round.roundNumber} · hash ${round.seedHash}`}
        >
          {formatMultiplier(round.crashPoint)}
        </span>
      ))}
    </div>
  );
}
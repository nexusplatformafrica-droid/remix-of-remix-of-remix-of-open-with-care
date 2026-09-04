import { AlertTriangle, Ticket, Trash2, X } from "lucide-react";
import { money } from "@/components/xbet/AuthContext";

export type VirtualSel = {
  id: string;
  matchId: string;
  no: number;
  event: string;
  pick: string;
  label: string;
  odd: number;
};

export function VirtualBetSlip({
  sels,
  onRemove,
  onClear,
  stake,
  setStake,
  totalOdds,
  onPlace,
  placing,
  loggedIn,
  balance,
  listClassName = "max-h-40",
}: {
  sels: VirtualSel[];
  onRemove: (id: string) => void;
  onClear: () => void;
  stake: number;
  setStake: (v: number) => void;
  totalOdds: number;
  onPlace: () => void;
  placing: boolean;
  loggedIn: boolean;
  balance: number;
  listClassName?: string;
}) {
  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-xb-line bg-xb-panel shadow-sm">
      <div className="flex items-center gap-2 bg-xb-header px-2 py-1.5">
        <Ticket className="h-3.5 w-3.5 text-xb-blue" />
        <h2 className="flex-1 text-[11px] font-black uppercase tracking-wide text-xb-on-dark">
          Virtual bet slip
        </h2>
        <span className="rounded-full bg-xb-blue px-2 py-0.5 text-[10px] font-black text-xb-on-dark">
          {sels.length}
        </span>
        {sels.length > 0 && (
          <button onClick={onClear} aria-label="Clear bet slip" className="text-xb-on-dark-muted hover:text-xb-red">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {sels.length === 0 ? (
        <div className="flex flex-col items-center gap-1 bg-xb-panel-alt px-3 py-6 text-center">
          <AlertTriangle className="h-5 w-5 text-xb-blue" />
          <p className="text-[11px] font-bold text-xb-text">Your ticket is empty</p>
          <p className="text-[10px] text-xb-text-muted">Tap any odd to add it to this round's ticket.</p>
        </div>
      ) : (
        <ul className={`${listClassName} divide-y divide-xb-line overflow-y-auto`}>
          {sels.map((s) => (
            <li key={s.id} className="flex items-center gap-2 px-2 py-1.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-medium text-xb-text">{s.label}</p>
                <p className="truncate text-[9px] uppercase tracking-wide text-xb-text-muted">{s.event}</p>
              </div>
              <span className="rounded bg-xb-odds px-1.5 py-0.5 text-[11px] font-black text-xb-blue">
                {s.odd.toFixed(2)}
              </span>
              <button
                onClick={() => onRemove(s.id)}
                aria-label="Remove selection"
                className="text-xb-text-muted hover:text-xb-red"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2 border-t border-xb-line p-2">
        <div className="flex items-center gap-1">
          {[500, 1000, 5000].map((v) => (
            <button
              key={v}
              onClick={() => setStake(v)}
              className={`flex-1 rounded-md py-1 text-[10px] font-bold transition-colors ${
                stake === v ? "bg-xb-blue text-xb-on-dark" : "bg-xb-odds text-xb-text hover:bg-xb-odds-hover"
              }`}
            >
              {v.toLocaleString()}
            </button>
          ))}
        </div>
        <label className="flex items-center justify-between gap-2 rounded-md bg-xb-panel-alt px-2 py-1 text-[10px] uppercase tracking-wide text-xb-text-muted">
          Stake
          <input
            type="number"
            min={100}
            step={100}
            value={stake}
            onChange={(e) => setStake(Math.max(0, Number(e.target.value)))}
            className="w-20 bg-transparent text-right text-[12px] font-black text-xb-text outline-none"
          />
        </label>
        <div className="flex justify-between text-[11px] text-xb-text-muted">
          Total odds <span className="font-black text-xb-text">{totalOdds.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between rounded-md bg-xb-green/10 px-2 py-1 text-[11px] text-xb-text-muted">
          Possible win
          <span className="font-black text-xb-green">UGX {money(Math.round(stake * totalOdds))}</span>
        </div>
        <button
          onClick={onPlace}
          disabled={placing}
          className="w-full rounded-md bg-xb-green py-2 text-[11px] font-black uppercase tracking-wide text-xb-on-dark transition-colors hover:bg-xb-green-dark disabled:opacity-60"
        >
          {placing ? "Placing…" : loggedIn ? "Place bet" : "Log in to bet"}
        </button>
        <p className="text-center text-[10px] text-xb-text-muted">
          Balance: <span className="font-bold text-xb-text">UGX {money(balance)}</span>
        </p>
      </div>
    </div>
  );
}

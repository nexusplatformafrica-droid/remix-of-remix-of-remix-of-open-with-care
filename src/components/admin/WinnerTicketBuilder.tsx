import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, X } from "lucide-react";
import { matchesQuery } from "@/lib/sports-queries";
import { SPORTS, SPORT_LABELS, type Sport } from "@/lib/sports-types";
import { ugDateLabel, ugDateKey, ugTime } from "@/lib/time";
import type { WinnerTicketLeg } from "@/lib/admin-types";
import { Btn, Field, inputCls } from "./ui";

const MARKETS = [
  "1X2 | Full Time (1)",
  "1X2 | Full Time (X)",
  "1X2 | Full Time (2)",
  "Over/Under | Full Time (Over) (1.5)",
  "Over/Under | Full Time (Over) (2.5)",
  "Over/Under | Full Time (Under) (2.5)",
  "Both Teams To Score | Full Time (Yes)",
  "Both Teams To Score | Full Time (No)",
  "Double Chance | Full Time (1X)",
  "Double Chance | Full Time (X2)",
];

/** Lets the admin assemble a real ticket from settled results. */
export function WinnerTicketBuilder({
  legs,
  onChange,
}: {
  legs: WinnerTicketLeg[];
  onChange: (legs: WinnerTicketLeg[]) => void;
}) {
  const [sport, setSport] = useState<Sport>("football");
  const [q, setQ] = useState("");

  const results = useQuery(matchesQuery({ sport, scope: "results" }));

  const visible = useMemo(() => {
    const list = results.data ?? [];
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? list.filter((m) => `${m.home} ${m.away} ${m.league}`.toLowerCase().includes(needle))
      : list;
    return filtered.slice(0, 60);
  }, [results.data, q]);

  const add = (m: (typeof visible)[number]) => {
    if (legs.some((l) => l.matchId === m.id)) return;
    onChange([
      ...legs,
      {
        matchId: m.id,
        time: `${ugTime(m.date, m.time)} ${ugDateLabel(ugDateKey(m.date, m.time))}`,
        teams: `${m.home} - ${m.away}`,
        league: `${m.country ?? ""} ${m.league}`.trim(),
        market: MARKETS[0]!,
        odds: 1.5,
        score: `${m.homeScore ?? "-"}-${m.awayScore ?? "-"}`,
        status: "won",
      },
    ]);
  };

  const patch = (i: number, p: Partial<WinnerTicketLeg>) =>
    onChange(legs.map((l, idx) => (idx === i ? { ...l, ...p } : l)));

  return (
    <div className="grid gap-2 lg:grid-cols-2">
      {/* Results picker */}
      <div className="rounded-lg border border-xb-line bg-xb-panel p-2">
        <div className="flex items-center gap-1.5">
          {SPORTS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSport(s)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
                sport === s ? "bg-xb-blue text-xb-on-dark" : "text-xb-text-muted hover:text-xb-text"
              }`}
            >
              {SPORT_LABELS[s]}
            </button>
          ))}
          <span className="ml-auto flex items-center gap-1 rounded-full border border-xb-line px-2 py-1">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search result"
              className="w-24 bg-transparent text-[11px] text-xb-text outline-none placeholder:text-xb-text-muted"
            />
            <Search className="h-3 w-3 text-xb-blue" />
          </span>
        </div>

        <div className="mt-2 max-h-[260px] divide-y divide-xb-line overflow-y-auto">
          {results.isPending && (
            <p className="py-6 text-center text-[12px] text-xb-text-muted">Loading results…</p>
          )}
          {!results.isPending && visible.length === 0 && (
            <p className="py-6 text-center text-[12px] text-xb-text-muted">No results found.</p>
          )}
          {visible.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => add(m)}
              className="flex w-full items-center gap-2 px-1 py-1.5 text-left hover:bg-xb-panel-alt"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] text-xb-text">
                  {m.home} - {m.away}
                </p>
                <p className="truncate text-[10px] text-xb-text-muted">
                  {m.country}. {m.league} · {ugTime(m.date, m.time)}
                </p>
              </div>
              <span className="shrink-0 text-[12px] font-black text-xb-text">
                {m.homeScore ?? "-"}-{m.awayScore ?? "-"}
              </span>
              <Plus className="h-3.5 w-3.5 shrink-0 text-xb-green" />
            </button>
          ))}
        </div>
      </div>

      {/* Selected legs */}
      <div className="rounded-lg border border-xb-line bg-xb-panel p-2">
        <p className="text-[11px] font-bold uppercase text-xb-text-muted">
          Ticket selections ({legs.length})
        </p>
        {legs.length === 0 ? (
          <p className="py-6 text-center text-[12px] text-xb-text-muted">
            Pick settled matches on the left to build the ticket.
          </p>
        ) : (
          <div className="mt-2 max-h-[260px] space-y-2 overflow-y-auto">
            {legs.map((l, i) => (
              <div
                key={`${l.matchId ?? l.teams}-${i}`}
                className={`rounded-lg p-2 ${
                  l.status === "lost"
                    ? "bg-xb-red/10 ring-1 ring-xb-red/40"
                    : l.status === "pending"
                      ? "bg-xb-panel-alt ring-1 ring-xb-line"
                      : "bg-xb-panel-alt"
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-bold text-xb-text">{l.teams}</p>
                    <p className="truncate text-[10px] text-xb-text-muted">
                      {l.league} · {l.time} · {l.score}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Remove selection"
                    onClick={() => onChange(legs.filter((_, idx) => idx !== i))}
                  >
                    <X className="h-3.5 w-3.5 text-xb-text-muted hover:text-xb-red" />
                  </button>
                </div>
                <div className="mt-1 grid gap-1.5 sm:grid-cols-3">
                  <Field label="Market">
                    <select
                      className={inputCls}
                      value={l.market}
                      onChange={(e) => patch(i, { market: e.target.value })}
                    >
                      {[...new Set([l.market, ...MARKETS])].map((mk) => (
                        <option key={mk} value={mk}>
                          {mk}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Odds">
                    <input
                      type="number"
                      step="0.01"
                      className={inputCls}
                      value={l.odds}
                      onChange={(e) => patch(i, { odds: Number(e.target.value) })}
                    />
                  </Field>
                  <Field label="Status">
                    <select
                      className={inputCls}
                      value={l.status}
                      onChange={(e) =>
                        patch(i, { status: e.target.value as WinnerTicketLeg["status"] })
                      }
                    >
                      <option value="won">Won (green)</option>
                      <option value="pending">Pending (silver)</option>
                      <option value="lost">Lost (red)</option>
                    </select>
                  </Field>
                </div>
              </div>
            ))}
            <Btn size="xs" tone="red" onClick={() => onChange([])}>
              Clear selections
            </Btn>
          </div>
        )}
      </div>
    </div>
  );
}

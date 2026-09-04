import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { leaguesQuery } from "@/lib/sports-queries";
import { SPORTS, SPORT_LABELS, type Sport } from "@/lib/sports-types";

/** Sport tabs + searchable competition list, shared by the provider data pages. */
export function LeaguePicker({
  sport,
  leagueKey,
  onSport,
  onLeague,
}: {
  sport: Sport;
  leagueKey: number;
  onSport: (s: Sport) => void;
  onLeague: (key: number, name: string) => void;
}) {
  const [q, setQ] = useState("");
  const leagues = useQuery(leaguesQuery(sport));

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    const all = leagues.data ?? [];
    const filtered = term
      ? all.filter(
          (l) =>
            l.name.toLowerCase().includes(term) || l.country.toLowerCase().includes(term),
        )
      : all;
    return filtered.slice(0, 400);
  }, [leagues.data, q]);

  return (
    <div className="overflow-hidden rounded-xl bg-xb-panel shadow-sm">
      <div className="flex gap-1 border-b border-xb-line p-1">
        {SPORTS.map((s: Sport) => (
          <button
            key={s}
            onClick={() => onSport(s)}
            className={`flex-1 rounded-lg py-1.5 text-[12px] font-bold transition-colors ${
              sport === s ? "bg-xb-blue text-white" : "text-xb-text-muted hover:bg-xb-odds"
            }`}
          >
            {SPORT_LABELS[s]}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 border-b border-xb-line px-3 py-2">
        <Search className="h-3.5 w-3.5 shrink-0 text-xb-text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search competition or country"
          className="w-full bg-transparent text-[13px] text-xb-text outline-none placeholder:text-xb-text-muted"
        />
      </div>

      <div className="max-h-[320px] overflow-y-auto md:max-h-[520px]">
        {leagues.isLoading && (
          <div className="px-3 py-4 text-[12px] text-xb-text-muted">Loading competitions…</div>
        )}
        {!leagues.isLoading && list.length === 0 && (
          <div className="px-3 py-4 text-[12px] text-xb-text-muted">No competition found.</div>
        )}
        {list.map((l) => (
          <button
            key={l.key}
            onClick={() => onLeague(l.key, l.name)}
            className={`flex w-full items-center gap-2 border-b border-xb-line px-3 py-2 text-left transition-colors hover:bg-xb-odds ${
              leagueKey === l.key ? "bg-xb-odds" : ""
            }`}
          >
            {l.logo ? (
              <img src={l.logo} alt="" loading="lazy" className="h-4 w-4 object-contain" />
            ) : (
              <span className="h-4 w-4 rounded-full bg-xb-odds-hover" />
            )}
            <span className="min-w-0 flex-1 truncate text-[13px] text-xb-text">{l.name}</span>
            <span className="shrink-0 text-[11px] text-xb-text-muted">{l.country}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

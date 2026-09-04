import { useQuery } from "@tanstack/react-query";
import { Play } from "lucide-react";
import { matchDetailsQuery } from "@/lib/sports-queries";
import type { Sport } from "@/lib/sports-types";
import { ugDateTime } from "@/lib/time";
import { thumbUrl, useVideoPlayer } from "@/components/xbet/VideoPlayerContext";

export function Panel({
  title,
  children,
  right,
  className,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`flex min-h-0 flex-col overflow-hidden rounded-xl bg-xb-panel shadow-sm lg:rounded-none ${className ?? ""}`}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-xb-line px-3 py-2">
        <h2 className="flex-1 truncate text-[12px] font-black uppercase tracking-wide text-xb-text">
          {title}
        </h2>
        {right}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </section>
  );
}

export function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="bg-xb-odds px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-xb-blue">
        {title}
      </div>
      {children}
    </div>
  );
}

type LineupPlayer = { name: string; number: string; position: string };

/** Split the outfield players into defence / midfield / attack lines. */
function outfieldLines(count: number): number[] {
  const shapes: Record<number, number[]> = {
    10: [4, 4, 2],
    9: [4, 3, 2],
    8: [4, 3, 1],
    7: [3, 3, 1],
    6: [3, 2, 1],
    5: [2, 2, 1],
  };
  return shapes[count] ?? [count];
}

function shortName(name: string): string {
  const parts = name.replace(/\(.*?\)/g, "").trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!;
  return `${parts[0]![0]}. ${parts[parts.length - 1]}`;
}

function PlayerDot({ p, away }: { p: LineupPlayer; away?: boolean | undefined }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-0.5">
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-black shadow ring-1 ring-black/20 ${
          away ? "bg-xb-panel text-xb-text" : "bg-xb-blue text-xb-on-dark"
        }`}
      >
        {p.number || "-"}
      </span>
      <span className="max-w-[68px] truncate rounded bg-black/45 px-1 text-[9px] font-bold leading-tight text-white">
        {shortName(p.name)}
      </span>
    </div>
  );
}

function TeamHalf({ players, away }: { players: LineupPlayer[]; away?: boolean | undefined }) {
  const gk = players[0];
  const rest = players.slice(1);
  const lines: LineupPlayer[][] = [];
  let i = 0;
  for (const size of outfieldLines(rest.length)) {
    lines.push(rest.slice(i, i + size));
    i += size;
  }
  const ordered = away ? [...lines].reverse() : lines;

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col justify-between py-1.5 ${away ? "" : "flex-col-reverse"}`}
    >
      {gk && (
        <div className="flex justify-center">
          <PlayerDot p={gk} away={away} />
        </div>
      )}
      {(away ? ordered : [...ordered].reverse()).map((line, idx) => (
        <div key={idx} className="flex items-start justify-evenly px-2">
          {line.map((p, j) => (
            <PlayerDot key={`${p.name}-${j}`} p={p} away={away} />
          ))}
        </div>
      ))}
    </div>
  );
}

function Pitch({
  home,
  away,
  lineups,
}: {
  home: string;
  away: string;
  lineups?: { home: { starting: LineupPlayer[] }; away: { starting: LineupPlayer[] } } | null;
}) {
  const hasReal =
    (lineups?.home.starting.length ?? 0) > 0 && (lineups?.away.starting.length ?? 0) > 0;
  return (
    <div className="relative m-3 aspect-[3/4] overflow-hidden rounded-lg ring-1 ring-xb-line">
      {/* turf */}
      <div className="absolute inset-0 bg-[linear-gradient(0deg,var(--xb-turf-a)_0_10%,var(--xb-turf-b)_10%_20%)] bg-[length:100%_20%]" />
      {/* markings */}
      <div className="pointer-events-none absolute inset-2 rounded-sm border-2 border-white/60" />
      <div className="pointer-events-none absolute left-2 right-2 top-1/2 border-t-2 border-white/60" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[18%] w-[24%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/60" />
      <div className="pointer-events-none absolute left-1/2 top-2 h-[14%] w-[44%] -translate-x-1/2 border-2 border-t-0 border-white/60" />
      <div className="pointer-events-none absolute bottom-2 left-1/2 h-[14%] w-[44%] -translate-x-1/2 border-2 border-b-0 border-white/60" />
      <div className="pointer-events-none absolute left-1/2 top-2 h-[6%] w-[20%] -translate-x-1/2 border-2 border-t-0 border-white/60" />
      <div className="pointer-events-none absolute bottom-2 left-1/2 h-[6%] w-[20%] -translate-x-1/2 border-2 border-b-0 border-white/60" />

      <div className="absolute inset-0 flex flex-col">
        <div className="flex items-center justify-center gap-1 px-2 pt-2.5 text-[10px] font-black uppercase text-white drop-shadow">
          {away}
        </div>
        {hasReal ? (
          <>
            <TeamHalf players={lineups!.away.starting} away />
            <TeamHalf players={lineups!.home.starting} />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center px-4 text-center text-[11px] font-bold text-white/90 drop-shadow">
            Line-ups not published yet for this match.
          </div>
        )}
        <div className="flex items-center justify-center gap-1 px-2 pb-2.5 text-[10px] font-black uppercase text-white drop-shadow">
          {home}
        </div>
      </div>
    </div>
  );
}

function useDetails(sport: Sport, matchId: string | null) {
  return useQuery({
    ...matchDetailsQuery(sport, matchId ?? ""),
    enabled: Boolean(matchId),
  });
}

/** Score header, events and statistics for one finished match. */
export function MatchDetailsSection({
  sport,
  matchId,
}: {
  sport: Sport;
  matchId: string | null;
}) {
  const details = useDetails(sport, matchId);
  const d = details.data;
  const m = d?.match;

  const events = [
    { title: "Goals", rows: d?.goals ?? [] },
    { title: "Cards", rows: d?.cards ?? [] },
    { title: "Substitutions", rows: d?.substitutions ?? [] },
  ].filter((b) => b.rows.length > 0);

  if (!matchId)
    return (
      <p className="px-3 py-10 text-center text-[12px] text-xb-text-muted">
        Select a result to see the details.
      </p>
    );
  if (details.isPending)
    return (
      <p className="px-3 py-10 text-center text-[12px] text-xb-text-muted">Loading details…</p>
    );
  if (!m || !d)
    return (
      <p className="px-3 py-10 text-center text-[12px] text-xb-text-muted">
        Details are not available for this match.
      </p>
    );

  return (
    <>
      <div className="border-b border-xb-line px-3 py-3">
        <p className="text-center text-[11px] text-xb-blue">
          {m.country}. {m.league}
          {m.round ? ` · Round ${m.round}` : ""}
        </p>
        <div className="mt-2 grid grid-cols-3 items-center gap-2">
          <div className="flex flex-col items-center gap-1 text-center">
            {m.homeLogo && <img src={m.homeLogo} alt="" className="h-9 w-9 object-contain" />}
            <span className="text-[12px] text-xb-text">{m.home}</span>
          </div>
          <div className="text-center">
            <p className="text-2xl font-black text-xb-text">
              {m.homeScore ?? "-"} : {m.awayScore ?? "-"}
            </p>
            <p className="mt-1 text-[11px] text-xb-text-muted">
              {m.status || ugDateTime(m.date, m.time)}
            </p>
          </div>
          <div className="flex flex-col items-center gap-1 text-center">
            {m.awayLogo && <img src={m.awayLogo} alt="" className="h-9 w-9 object-contain" />}
            <span className="text-[12px] text-xb-text">{m.away}</span>
          </div>
        </div>
        {m.periods.length > 0 && (
          <div className="mt-2 flex flex-wrap justify-center gap-1.5 text-[10px] text-xb-text-muted">
            {m.periods.map((p) => (
              <span key={p.label} className="rounded bg-xb-odds px-1.5 py-0.5">
                {p.label}: {p.home}-{p.away}
              </span>
            ))}
          </div>
        )}
      </div>

      {(m.stadium || d.referee) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 px-3 py-2 text-[11px] text-xb-text-muted">
          {m.stadium && <span>Venue: {m.stadium}</span>}
          {d.referee && <span>Referee: {d.referee}</span>}
        </div>
      )}

      {events.length === 0 && (
        <p className="px-3 py-6 text-center text-[12px] text-xb-text-muted">
          No match events published for this game.
        </p>
      )}
      {events.map((b) => (
        <Block key={b.title} title={b.title}>
          {b.rows.map((e, i) => (
            <div
              key={`${b.title}-${i}`}
              className="flex items-center gap-2 border-b border-xb-line px-3 py-1.5 text-[12px] last:border-0"
            >
              <span className="w-9 shrink-0 rounded bg-xb-odds text-center text-[10px] font-bold text-xb-blue">
                {e.time || "-"}'
              </span>
              <span
                className={`min-w-0 flex-1 truncate text-xb-text ${
                  e.side === "home" ? "text-left" : "text-right"
                }`}
              >
                {e.player}
                {e.detail ? ` · ${e.detail}` : ""}
              </span>
            </div>
          ))}
        </Block>
      ))}

      {d.statistics.length > 0 && (
        <Block title="Statistics">
          <div className="p-3">
            {d.statistics.map((s, i) => {
              const num = (v: string) => {
                const n = Number(String(v).replace("%", ""));
                return Number.isFinite(n) ? n : 0;
              };
              const h = num(s.home);
              const a = num(s.away);
              const total = h + a || 1;
              return (
                <div key={`${s.type}-${i}`} className="mb-2.5">
                  <div className="flex justify-between text-[11px] text-xb-text">
                    <span className="font-bold">{s.home}</span>
                    <span className="text-xb-text-muted">{s.type}</span>
                    <span className="font-bold">{s.away}</span>
                  </div>
                  <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-xb-odds">
                    <span className="bg-xb-blue" style={{ width: `${(h / total) * 100}%` }} />
                    <span className="bg-xb-green" style={{ width: `${(a / total) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Block>
      )}
    </>
  );
}

/** Highlights video, pitch formation, line-ups, head-to-head and standings. */
export function MatchHighlightsSection({
  sport,
  matchId,
}: {
  sport: Sport;
  matchId: string | null;
}) {
  const details = useDetails(sport, matchId);
  const d = details.data;
  const m = d?.match;
  const clips = d?.videos ?? [];
  const { open } = useVideoPlayer();

  if (!matchId)
    return (
      <p className="px-3 py-10 text-center text-[12px] text-xb-text-muted">
        Highlights, lineups and head-to-head appear here.
      </p>
    );
  if (details.isPending)
    return (
      <p className="px-3 py-10 text-center text-[12px] text-xb-text-muted">Loading highlights…</p>
    );
  if (!m || !d)
    return (
      <p className="px-3 py-10 text-center text-[12px] text-xb-text-muted">
        Nothing published for this match yet.
      </p>
    );

  return (
    <>
      {clips.length > 0 && (
        <Block title="Highlights">
          <div className="grid gap-2 p-2 sm:grid-cols-2">
            {clips.map((v, i) => {
              const thumb = thumbUrl(v.url);
              return (
                <button
                  key={v.url}
                  type="button"
                  onClick={() => open(clips, i)}
                  className="group overflow-hidden rounded-lg bg-xb-panel-alt text-left"
                >
                  <span className="relative flex aspect-video w-full items-center justify-center bg-black">
                    {thumb && (
                      <img
                        src={thumb}
                        alt={v.title}
                        loading="lazy"
                        className="h-full w-full object-cover opacity-90 transition group-hover:opacity-100"
                      />
                    )}
                    <span className="absolute flex h-11 w-11 items-center justify-center rounded-full bg-xb-blue text-xb-on-dark shadow-lg">
                      <Play className="h-5 w-5" />
                    </span>
                  </span>
                  <span className="block truncate px-2 py-1.5 text-[11px] font-medium text-xb-text">
                    {v.title}
                  </span>
                </button>
              );
            })}
          </div>
        </Block>
      )}

      <Block title="Formation on the pitch">
        <Pitch home={m.home} away={m.away} lineups={d.lineups} />
      </Block>

      {d.lineups ? (
        <Block title="Line-ups">
          <div className="grid gap-px bg-xb-line sm:grid-cols-2">
            {(
              [
                [m.home, d.lineups.home],
                [m.away, d.lineups.away],
              ] as const
            ).map(([side, team]) => (
              <div key={side} className="min-w-0 bg-xb-panel">
                <div className="flex items-center justify-between gap-2 border-b border-xb-line px-3 py-1.5">
                  <span className="truncate text-[12px] font-bold text-xb-text">{side}</span>
                  {team.coach && (
                    <span className="truncate text-[10px] text-xb-text-muted">{team.coach}</span>
                  )}
                </div>
                {(
                  [
                    ["Starting XI", team.starting],
                    ["Substitutes", team.substitutes],
                    ["Missing", team.missing],
                  ] as const
                )
                  .filter(([, list]) => list.length > 0)
                  .map(([label, list]) => (
                    <div key={label}>
                      <div className="px-3 py-1 text-[10px] font-bold uppercase text-xb-text-muted">
                        {label}
                      </div>
                      {list.map((p, i) => (
                        <div
                          key={`${label}-${i}`}
                          className="flex items-center gap-2 border-b border-xb-line px-3 py-1 text-[11px] last:border-0"
                        >
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-xb-odds text-[9px] font-bold text-xb-blue">
                            {p.number || "-"}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-xb-text">{p.name}</span>
                          {p.position && (
                            <span className="text-[9px] text-xb-text-muted">{p.position}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </Block>
      ) : (
        <p className="px-3 py-4 text-center text-[11px] text-xb-text-muted">
          Line-ups were not published for this match.
        </p>
      )}

      {d.h2h.length > 0 && (
        <Block title="Head to head">
          {d.h2h.slice(0, 8).map((g) => (
            <div
              key={g.id}
              className="flex items-center gap-2 border-b border-xb-line px-3 py-1.5 text-[11px] last:border-0"
            >
              <span className="w-16 shrink-0 text-xb-text-muted">{g.date}</span>
              <span className="min-w-0 flex-1 truncate text-xb-text">
                {g.home} vs {g.away}
              </span>
              <span className="font-black text-xb-blue">{g.result}</span>
            </div>
          ))}
        </Block>
      )}

      {d.standings.length > 0 && (
        <Block title={`${m.league} table`}>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-xb-text-muted">
                  <th className="px-2 py-1 text-left font-bold">#</th>
                  <th className="px-2 py-1 text-left font-bold">Team</th>
                  <th className="px-1 py-1 text-center font-bold">P</th>
                  <th className="px-1 py-1 text-center font-bold">W</th>
                  <th className="px-1 py-1 text-center font-bold">D</th>
                  <th className="px-1 py-1 text-center font-bold">L</th>
                  <th className="px-1 py-1 text-center font-bold">GF</th>
                  <th className="px-1 py-1 text-center font-bold">GA</th>
                  <th className="px-2 py-1 text-center font-bold">Pts</th>
                </tr>
              </thead>
              <tbody>
                {d.standings.map((r) => {
                  const isTeam = r.team === m.home || r.team === m.away;
                  return (
                    <tr
                      key={`${r.place}-${r.team}`}
                      className={`border-t border-xb-line ${isTeam ? "bg-xb-panel-alt font-bold" : ""}`}
                    >
                      <td className="px-2 py-1 text-xb-text-muted">{r.place}</td>
                      <td className="max-w-[140px] truncate px-2 py-1 text-xb-text">{r.team}</td>
                      <td className="px-1 py-1 text-center text-xb-text">{r.played}</td>
                      <td className="px-1 py-1 text-center text-xb-text">{r.win}</td>
                      <td className="px-1 py-1 text-center text-xb-text">{r.draw}</td>
                      <td className="px-1 py-1 text-center text-xb-text">{r.loss}</td>
                      <td className="px-1 py-1 text-center text-xb-text">{r.goalsFor}</td>
                      <td className="px-1 py-1 text-center text-xb-text">{r.goalsAgainst}</td>
                      <td className="px-2 py-1 text-center text-xb-blue">{r.points}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Block>
      )}
    </>
  );
}

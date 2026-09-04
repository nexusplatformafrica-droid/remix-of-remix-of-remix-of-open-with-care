import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Loader2,
  Lock,
  Play,
  Sparkles,
} from "lucide-react";
import { Header } from "@/components/xbet/Header";
import { LeftSidebar } from "@/components/xbet/LeftSidebar";
import { RightSidebar } from "@/components/xbet/RightSidebar";
import { SportFilterProvider } from "@/components/xbet/SportFilterContext";
import { MobileNav } from "@/components/xbet/MobileNav";
import { MatchDetailSkeleton } from "@/components/xbet/Skeletons";
import { ugDateTime } from "@/lib/time";
import { outcomeLocked, lockReason, type LockableMatch } from "@/lib/live-lock";
import { useOddsFlash, oddsFlashClass } from "@/lib/use-odds-flash";

import { useBetSlip } from "@/components/xbet/BetSlipContext";
import { useVideoPlayer, thumbUrl } from "@/components/xbet/VideoPlayerContext";
import {
  matchDetailsQuery,
  type EventRow,
  type Market,
  type MatchDetails,
  type MatchLineups,
  type VideoItem,
} from "@/lib/sports-queries";


import { askMatchAssistant } from "@/lib/sports.functions";
import { SPORTS, type Sport } from "@/lib/sports-types";

type Search = { sport: Sport };

export const Route = createFileRoute("/match/$matchId")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    sport: SPORTS.includes(search["sport"] as Sport) ? (search["sport"] as Sport) : "football",
  }),
  head: () => ({
    meta: [
      { title: "Match Centre — Live Odds, Stats & H2H | BET PLUS+" },
      {
        name: "description",
        content:
          "Full match centre with every available betting market, live statistics, head-to-head history, standings and an AI match assistant.",
      },
      { property: "og:title", content: "Match Centre — BET PLUS+" },
      {
        property: "og:description",
        content: "All markets, live stats, head-to-head and AI insights for the selected match.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MatchPage,
});

const ALL_TABS = [
  "Markets",
  "Summary",
  "Statistics",
  "Box score",
  "Probabilities",
  "Commentary",
  "Lineups",
  "Videos",
  "Head to head",
  "Standings",
  "AI assistant",
] as const;

type Tab = (typeof ALL_TABS)[number];

function MatchPage() {
  const { matchId } = Route.useParams();
  const { sport } = Route.useSearch();
  const [tab, setTab] = useState<Tab | null>(null);
  const details = useQuery(matchDetailsQuery(sport, matchId));
  const d = details.data;
  const m = d?.match;

  const tabs = useMemo<Tab[]>(() => {
    if (!d || !m) return [...ALL_TABS];
    // Everything the provider returns stays reachable; only betting markets are
    // hidden once a game is over, cancelled or postponed.
    return ALL_TABS.filter((t) => {
      if (t === "Markets") return !m.finished && d.markets.length > 0;
      if (t === "Lineups") return Boolean(d.lineups);
      if (t === "Box score") return Boolean(d.boxScore);
      if (t === "Probabilities") return d.probabilities.length > 0;
      if (t === "Commentary") return d.comments.length > 0;
      return true;
    });

  }, [d, m]);


  const activeTab: Tab = tab && tabs.includes(tab) ? tab : (tabs[0] ?? "AI assistant");


  return (
    <SportFilterProvider>
      <div className="flex h-[100dvh] flex-col overflow-hidden bg-xb-page font-xb">
        <Header />
        <main className="flex min-h-0 flex-1 gap-2 overflow-hidden px-0 pt-1 md:px-2 md:pt-2">
          <div className="hidden lg:block">
            <LeftSidebar />
          </div>
          <div className="min-w-0 flex-1 overflow-y-auto pb-20 pr-0.5 md:pb-4">
            <Link
              to="/"
              className="mb-2 inline-flex items-center gap-1 rounded-lg bg-xb-panel-alt px-3 py-1.5 text-[12px] text-xb-text-muted hover:text-xb-blue"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to all events
            </Link>

            {details.isPending && <MatchDetailSkeleton />}

            {!details.isPending && !m && (
              <div className="rounded-xl bg-xb-panel px-3 py-16 text-center text-[13px] text-xb-text-muted">
                This match is no longer available.
              </div>
            )}


          {m && d && (
            <>
              <div className="overflow-hidden rounded-xl bg-xb-panel shadow-sm">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 bg-xb-odds px-3 py-2 text-[11px] text-xb-blue md:text-[12px]">
                  {m.leagueLogo && (
                    <img src={m.leagueLogo} alt="" className="h-4 w-4 rounded-full object-contain" />
                  )}
                  <span className="font-bold">
                    {m.country}. {m.league}
                  </span>
                  {m.round && <span className="text-xb-text-muted">Round {m.round}</span>}
                  {m.live && (
                    <span className="ml-auto rounded bg-xb-green px-1.5 py-0.5 font-bold text-xb-on-dark">
                      LIVE
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 items-center gap-2 px-3 py-4 md:gap-3 md:px-4 md:py-6">
                  <div className="flex flex-col items-center gap-2 text-center">
                    {m.homeLogo && <img src={m.homeLogo} alt="" className="h-10 w-10 object-contain md:h-12 md:w-12" />}
                    <span className="text-[12px] font-medium leading-tight text-xb-text md:text-[14px]">{m.home}</span>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-xb-text md:text-3xl">
                      {m.homeScore ?? "-"} : {m.awayScore ?? "-"}
                    </div>
                    <div className="mt-1 text-[12px] text-xb-text-muted">
                      {m.status || ugDateTime(m.date, m.time)}
                    </div>
                    {m.periods.length > 0 && (
                      <div className="mt-2 flex flex-wrap justify-center gap-2 text-[11px] text-xb-text-muted">
                        {m.periods.map((p) => (
                          <span key={p.label} className="rounded bg-xb-odds px-1.5 py-0.5">
                            {p.label}: {p.home}-{p.away}
                          </span>
                        ))}
                      </div>
                    )}
                    {m.stadium && (
                      <div className="mt-2 text-[11px] text-xb-text-muted">{m.stadium}</div>
                    )}
                  </div>
                  <div className="flex flex-col items-center gap-2 text-center">
                    {m.awayLogo && <img src={m.awayLogo} alt="" className="h-10 w-10 object-contain md:h-12 md:w-12" />}
                    <span className="text-[12px] font-medium leading-tight text-xb-text md:text-[14px]">{m.away}</span>
                  </div>
                </div>
              </div>

              <div className="xb-noscroll mt-2 flex gap-2 overflow-x-auto rounded-xl bg-xb-panel px-3 py-2">
                {tabs.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-bold transition-colors ${
                      activeTab === t
                        ? "bg-xb-blue text-xb-on-dark"
                        : "text-xb-text-muted hover:text-xb-text"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {activeTab === "Markets" && (
                <MarketsTab
                  markets={d.markets}
                  match={m}
                  event={`${m.home} — ${m.away}`}
                  matchId={matchId}
                  sport={m.sport}
                  league={`${m.country ?? ""} ${m.league ?? ""}`.trim()}
                  kickoff={m.kickoff}
                />
              )}

              {activeTab !== "Markets" && (
                <div className="mt-2 overflow-hidden rounded-xl bg-xb-panel shadow-sm">
                  {activeTab === "Summary" && (
                    <SummaryTab
                      goals={d.goals}
                      cards={d.cards}
                      substitutions={d.substitutions}
                      home={m.home}
                      away={m.away}
                      referee={d.referee}
                      stadium={m.stadium}
                    />
                  )}
                  {activeTab === "Statistics" && (
                    <StatisticsTab stats={d.statistics} home={m.home} away={m.away} />
                  )}
                  {activeTab === "Box score" && d.boxScore && (
                    <BoxScoreTab box={d.boxScore} home={m.home} away={m.away} />
                  )}
                  {activeTab === "Probabilities" && (
                    <ProbabilitiesTab rows={d.probabilities} home={m.home} away={m.away} />
                  )}
                  {activeTab === "Commentary" && <CommentaryTab rows={d.comments} />}

                  {activeTab === "Lineups" && d.lineups && (
                    <LineupsTab lineups={d.lineups} home={m.home} away={m.away} />
                  )}
                  {activeTab === "Videos" && <VideosTab videos={d.videos} />}
                  {activeTab === "Head to head" && (
                    <H2HTab
                      h2h={d.h2h}
                      homeRecent={d.homeRecent}
                      awayRecent={d.awayRecent}
                      home={m.home}
                      away={m.away}
                    />
                  )}
                  {activeTab === "Standings" && (
                    <StandingsTab
                      rows={d.standings}
                      league={m.league}
                      country={m.country}
                      season={m.season}
                      logo={m.leagueLogo}
                      home={m.home}
                      away={m.away}
                    />
                  )}
                  {activeTab === "AI assistant" && (
                    <AiTab sport={sport} matchId={matchId} home={m.home} away={m.away} />
                  )}
                </div>
              )}

              </>
            )}
          </div>
          <div className="hidden lg:block">
            <RightSidebar />
          </div>
        </main>
        <MobileNav />
      </div>
    </SportFilterProvider>
  );
}

function MarketOutcome({
  event,
  market,
  label,
  odd,
  id,
  matchId,
  sport,
  league,
  kickoff,
  locked,
  lockedTitle,
}: {
  event: string;
  market: string;
  label: string;
  odd: number;
  id: string;
  matchId: string;
  sport?: string | undefined;
  league?: string | undefined;
  kickoff?: string | undefined;
  locked?: boolean;
  lockedTitle?: string;
}) {
  const { toggle, has } = useBetSlip();
  const active = has(id);
  const flash = useOddsFlash(odd);
  if (locked) {
    return (
      <span
        title={lockedTitle}
        aria-label="Betting closed for this outcome"
        className="flex flex-col items-center gap-1 rounded-lg bg-xb-odds px-2 py-2 text-xb-text-muted opacity-70"
      >
        <span className="text-[11px] font-medium uppercase">{label}</span>
        <Lock className="h-3.5 w-3.5" />
      </span>
    );
  }
  return (
    <button
      onClick={() => toggle({ id, matchId, event, market, odd, sport, league, kickoff })}
      className={`flex flex-col items-center gap-1 rounded-lg px-2 py-2 transition-colors ${
        active ? "bg-xb-blue text-xb-on-dark" : "bg-xb-odds text-xb-text hover:bg-xb-odds-hover"
      } ${oddsFlashClass(flash)}`}
    >
      <span
        className={`text-[11px] font-medium uppercase ${
          active ? "text-xb-on-dark/80" : "text-xb-text-muted"
        }`}
      >
        {label}
      </span>
      <span className="inline-flex items-center gap-0.5 text-[14px] font-bold">
        {odd.toFixed(2)}
        {flash === "up" && <ArrowUp className="h-3 w-3" />}
        {flash === "down" && <ArrowDown className="h-3 w-3" />}
      </span>
    </button>
  );
}

function MarketsTab({
  markets,
  match,
  event,
  matchId,
  sport,
  league,
  kickoff,
}: {
  markets: Market[];
  match: LockableMatch;
  event: string;
  matchId: string;
  sport?: string | undefined;
  league?: string | undefined;
  kickoff?: string | undefined;
}) {
  if (markets.length === 0) {
    return (
      <div className="mt-2 rounded-xl bg-xb-panel px-3 py-16 text-center text-[13px] text-xb-text-muted">
        No betting markets are available for this match.
      </div>
    );
  }
  return (
    <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
      {markets.map((mk) => (
        <div key={mk.name} className="overflow-hidden rounded-xl bg-xb-panel shadow-sm">
          <div className="flex items-center gap-2 border-b border-xb-line px-3 py-2">
            <span className="truncate text-[13px] font-bold text-xb-blue">{mk.name}</span>
            <span className="ml-auto shrink-0 text-[11px] text-xb-text-muted">
              {mk.outcomes.length} options
            </span>
          </div>
          <div
            className={`grid gap-1.5 p-2 ${
              mk.outcomes.length === 2
                ? "grid-cols-2"
                : mk.outcomes.length % 3 === 0
                  ? "grid-cols-3"
                  : "grid-cols-2"
            }`}
          >
            {mk.outcomes.map((o) => (
              <MarketOutcome
                key={o.label}
                id={`${mk.name}-${o.label}-${event}`}
                matchId={matchId}
                event={event}
                sport={sport}
                league={league}
                kickoff={kickoff}
                market={`${mk.name} · ${o.label}`}
                label={o.label}
                odd={o.odd}
                locked={outcomeLocked(match, mk.name, o.label)}
                lockedTitle={lockReason(match)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}


function StatisticsTab({
  stats,
  home,
  away,
}: {
  stats: { type: string; home: string; away: string }[];
  home: string;
  away: string;
}) {
  if (stats.length === 0) {
    return (
      <div className="px-3 py-10 text-center text-[13px] text-xb-text-muted">
        Statistics become available once the match is under way.
      </div>
    );
  }
  const pct = (v: string) => {
    const n = Number(String(v).replace("%", ""));
    return Number.isFinite(n) ? n : 0;
  };
  return (
    <div className="p-3">
      <div className="mb-3 flex justify-between text-[12px] font-bold text-xb-text">
        <span>{home}</span>
        <span>{away}</span>
      </div>
      {stats.map((s, i) => {
        const h = pct(s.home);
        const a = pct(s.away);
        const total = h + a || 1;
        return (
          <div key={`${s.type}-${i}`} className="mb-3">
            <div className="flex justify-between text-[12px] text-xb-text">
              <span className="font-medium">{s.home}</span>
              <span className="text-xb-text-muted">{s.type}</span>
              <span className="font-medium">{s.away}</span>
            </div>
            <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-xb-odds">
              <span className="bg-xb-blue" style={{ width: `${(h / total) * 100}%` }} />
              <span className="bg-xb-green" style={{ width: `${(a / total) * 100}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

type Game = { id: string; date: string; league: string; home: string; away: string; result: string };

function scoreParts(result: string): [number, number] | null {
  const m = /(\d+)\s*-\s*(\d+)/.exec(result);
  if (!m) return null;
  return [Number(m[1]), Number(m[2])];
}

type Verdict = "W" | "D" | "L" | null;

const sameTeam = (a: string, b: string) => {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x.includes(y.slice(0, 6)) || y.includes(x.slice(0, 6));
};

function verdictFor(team: string, g: Game): Verdict {
  const sc = scoreParts(g.result);
  if (!sc) return null;
  const [h, a] = sc;
  const isHome = sameTeam(g.home, team);
  const mine = isHome ? h : a;
  const theirs = isHome ? a : h;
  if (mine === theirs) return "D";
  return mine > theirs ? "W" : "L";
}

const verdictClass: Record<"W" | "D" | "L", string> = {
  W: "bg-xb-green text-xb-on-dark",
  D: "bg-xb-odds-hover text-xb-text",
  L: "bg-xb-red text-xb-on-dark",
};

function FormBadge({ v }: { v: Verdict }) {
  if (!v) return <span className="h-5 w-5 rounded-md bg-xb-odds" />;
  return (
    <span
      className={`flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-bold ${verdictClass[v]}`}
    >
      {v}
    </span>
  );
}

function GameCard({ game, highlight }: { game: Game; highlight?: string }) {
  const sc = scoreParts(game.result);
  const homeWin = sc ? sc[0]! > sc[1]! : false;
  const awayWin = sc ? sc[1]! > sc[0]! : false;
  const hl = (name: string) => (highlight ? sameTeam(name, highlight) : false);

  return (
    <div className="rounded-xl bg-xb-panel-alt p-3 ring-1 ring-xb-line transition-colors hover:bg-xb-odds">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-xb-text-muted">
        <span>{game.date}</span>
        <span className="truncate pl-2 text-right">{game.league}</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span
          className={`flex-1 truncate text-[12.5px] ${homeWin ? "font-bold text-xb-text" : "text-xb-text-muted"} ${hl(game.home) ? "text-xb-blue" : ""}`}
        >
          {game.home}
        </span>
        <span className="rounded-lg bg-xb-panel px-2 py-1 text-[13px] font-bold tabular-nums text-xb-text">
          {sc ? `${sc[0]} : ${sc[1]}` : "-"}
        </span>
        <span
          className={`flex-1 truncate text-right text-[12.5px] ${awayWin ? "font-bold text-xb-text" : "text-xb-text-muted"} ${hl(game.away) ? "text-xb-blue" : ""}`}
        >
          {game.away}
        </span>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-xb-panel p-3 ring-1 ring-xb-line">
      <header className="mb-3 flex items-center gap-2">
        <span className="h-4 w-1 rounded-full bg-xb-blue" />
        <div className="min-w-0">
          <h3 className="truncate text-[13px] font-bold text-xb-text">{title}</h3>
          {subtitle && <p className="text-[11px] text-xb-text-muted">{subtitle}</p>}
        </div>
        {right && <div className="ml-auto shrink-0">{right}</div>}
      </header>
      {children}
    </section>
  );
}

function FormStrip({ team, games }: { team: string; games: Game[] }) {
  return (
    <div className="flex items-center gap-1">
      {games.slice(0, 5).map((g) => (
        <FormBadge key={`${g.id}-${g.date}`} v={verdictFor(team, g)} />
      ))}
    </div>
  );
}

function H2HTab({
  h2h,
  homeRecent,
  awayRecent,
  home,
  away,
}: {
  h2h: Game[];
  homeRecent: Game[];
  awayRecent: Game[];
  home: string;
  away: string;
}) {
  const summary = useMemo(() => {
    let hw = 0;
    let d = 0;
    let aw = 0;
    let gh = 0;
    let ga = 0;
    for (const g of h2h) {
      const v = verdictFor(home, g);
      if (v === "W") hw += 1;
      else if (v === "L") aw += 1;
      else if (v === "D") d += 1;
      const sc = scoreParts(g.result);
      if (sc) {
        const isHome = sameTeam(g.home, home);
        gh += isHome ? sc[0]! : sc[1]!;
        ga += isHome ? sc[1]! : sc[0]!;
      }
    }
    const total = hw + d + aw || 1;
    return { hw, d, aw, gh, ga, total, played: h2h.length };
  }, [h2h, home]);

  if (h2h.length === 0 && homeRecent.length === 0 && awayRecent.length === 0) {
    return (
      <div className="px-3 py-10 text-center text-[13px] text-xb-text-muted">
        No head-to-head history is available for this pairing.
      </div>
    );
  }

  return (
    <div className="space-y-3 bg-xb-panel-alt/60 p-3">
      <div className="rounded-2xl bg-gradient-to-br from-xb-odds to-xb-panel p-4 ring-1 ring-xb-line">
        <div className="flex items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-wide text-xb-text-muted">
          <span className="flex-1 truncate">{home}</span>
          <span className="shrink-0 rounded-full bg-xb-panel px-2 py-0.5">
            {summary.played} meetings
          </span>
          <span className="flex-1 truncate text-right">{away}</span>
        </div>
        <div className="mt-3 flex items-end justify-between">
          <div className="text-center">
            <div className="text-2xl font-bold leading-none text-xb-blue">{summary.hw}</div>
            <div className="mt-1 text-[10px] uppercase text-xb-text-muted">wins</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold leading-none text-xb-text">{summary.d}</div>
            <div className="mt-1 text-[10px] uppercase text-xb-text-muted">draws</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold leading-none text-xb-green">{summary.aw}</div>
            <div className="mt-1 text-[10px] uppercase text-xb-text-muted">wins</div>
          </div>
        </div>
        <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-xb-panel">
          <span className="bg-xb-blue" style={{ width: `${(summary.hw / summary.total) * 100}%` }} />
          <span
            className="bg-xb-odds-hover"
            style={{ width: `${(summary.d / summary.total) * 100}%` }}
          />
          <span
            className="bg-xb-green"
            style={{ width: `${(summary.aw / summary.total) * 100}%` }}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-xb-panel/70 px-3 py-2">
            <div className="text-[10px] uppercase text-xb-text-muted">Goals scored</div>
            <div className="text-[15px] font-bold text-xb-text">{summary.gh}</div>
          </div>
          <div className="rounded-xl bg-xb-panel/70 px-3 py-2 text-right">
            <div className="text-[10px] uppercase text-xb-text-muted">Goals scored</div>
            <div className="text-[15px] font-bold text-xb-text">{summary.ga}</div>
          </div>
        </div>
      </div>

      <SectionCard
        title="Previous meetings"
        subtitle="Most recent first"
        right={<FormStrip team={home} games={h2h} />}
      >
        <div className="grid gap-2 md:grid-cols-2">
          {h2h.length === 0 && (
            <div className="text-[12px] text-xb-text-muted">No previous meetings.</div>
          )}
          {h2h.map((g) => (
            <GameCard key={`${g.id}-${g.date}`} game={g} highlight={home} />
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-3 lg:grid-cols-2">
        <SectionCard
          title={`${home} — recent form`}
          subtitle="Last matches"
          right={<FormStrip team={home} games={homeRecent} />}
        >
          <div className="space-y-2">
            {homeRecent.length === 0 && (
              <div className="text-[12px] text-xb-text-muted">No recent data.</div>
            )}
            {homeRecent.map((g) => (
              <GameCard key={`${g.id}-${g.date}`} game={g} highlight={home} />
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title={`${away} — recent form`}
          subtitle="Last matches"
          right={<FormStrip team={away} games={awayRecent} />}
        >
          <div className="space-y-2">
            {awayRecent.length === 0 && (
              <div className="text-[12px] text-xb-text-muted">No recent data.</div>
            )}
            {awayRecent.map((g) => (
              <GameCard key={`${g.id}-${g.date}`} game={g} highlight={away} />
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function StandingsTab({
  rows,
  league,
  country,
  season,
  logo,
  home,
  away,
}: {
  rows: {
    place: number;
    team: string;
    played: number;
    win: number;
    draw: number;
    loss: number;
    goalsFor: number;
    goalsAgainst: number;
    points: number;
  }[];
  league: string;
  country: string;
  season: string;
  logo: string | null;
  home: string;
  away: string;
}) {
  return (
    <div className="p-3">
      <div className="mb-3 flex items-center gap-3 rounded-2xl bg-gradient-to-br from-xb-odds to-xb-panel px-4 py-3 ring-1 ring-xb-line">
        {logo && <img src={logo} alt="" className="h-8 w-8 rounded-full object-contain" />}
        <div className="min-w-0">
          <div className="truncate text-[14px] font-bold text-xb-text">{league || "Standings"}</div>
          <div className="text-[11px] text-xb-text-muted">
            {country}
            {season ? ` · Season ${season}` : ""}
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl bg-xb-panel-alt px-3 py-10 text-center text-[13px] text-xb-text-muted">
          No standings published for {league || "this competition"}.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl ring-1 ring-xb-line">
          <table className="w-full text-[12px]">
            <thead className="bg-xb-odds text-xb-text-muted">
              <tr>
                {["#", "Team", "P", "W", "D", "L", "F", "A", "Pts"].map((h) => (
                  <th
                    key={h}
                    className={`px-2 py-2 font-medium ${h === "Team" ? "text-left" : "text-center"}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const active = sameTeam(r.team, home) || sameTeam(r.team, away);
                return (
                  <tr
                    key={`${r.place}-${r.team}`}
                    className={`border-b border-xb-line text-xb-text last:border-0 ${
                      active ? "bg-xb-panel-alt font-bold" : "bg-xb-panel"
                    }`}
                  >
                    <td className="px-2 py-2 text-center">
                      <span
                        className={`inline-flex h-5 w-5 items-center justify-center rounded-md text-[11px] ${
                          active ? "bg-xb-blue text-xb-on-dark" : "bg-xb-odds text-xb-text-muted"
                        }`}
                      >
                        {r.place}
                      </span>
                    </td>
                    <td className="max-w-[180px] truncate px-2 py-2">{r.team}</td>
                    <td className="px-2 py-2 text-center">{r.played}</td>
                    <td className="px-2 py-2 text-center text-xb-green">{r.win}</td>
                    <td className="px-2 py-2 text-center">{r.draw}</td>
                    <td className="px-2 py-2 text-center text-xb-red">{r.loss}</td>
                    <td className="px-2 py-2 text-center">{r.goalsFor}</td>
                    <td className="px-2 py-2 text-center">{r.goalsAgainst}</td>
                    <td className="px-2 py-2 text-center font-bold">{r.points}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AiTab({
  sport,
  matchId,
  home,
  away,
}: {
  sport: Sport;
  matchId: string;
  home: string;
  away: string;
}) {
  const [question, setQuestion] = useState("");
  const [thread, setThread] = useState<{ q: string; a: string }[]>([]);
  const ask = useServerFn(askMatchAssistant);

  const mutation = useMutation({
    mutationFn: (q: string) => ask({ data: { sport, matchId, question: q } }),
    onSuccess: (res, q) => {
      setThread((t) => [...t, { q, a: res.error ? res.error : res.answer }]);
      setQuestion("");
    },
  });

  const suggestions = [
    `Who is more likely to win, ${home} or ${away}?`,
    "Which market offers the best value right now?",
    "How do the head-to-head results shape this match?",
    "What does recent form say about goals in this game?",
    "Summarise the key statistics so far.",
  ];

  return (
    <div className="p-3">
      <div className="flex items-center gap-2 text-[13px] font-bold text-xb-text">
        <Sparkles className="h-4 w-4 text-xb-blue" /> AI match assistant
      </div>
      <p className="mt-1 text-[12px] text-xb-text-muted">
        Answers are generated from this match's live odds, statistics, form and standings.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <button
            key={s}
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(s)}
            className="rounded-full bg-xb-odds px-3 py-1.5 text-[12px] text-xb-text transition-colors hover:bg-xb-odds-hover disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {thread.map((t, i) => (
          <div key={i} className="rounded-lg bg-xb-panel-alt p-3">
            <div className="text-[12px] font-bold text-xb-blue">{t.q}</div>
            <div className="mt-1 whitespace-pre-wrap text-[13px] text-xb-text">{t.a}</div>
          </div>
        ))}
        {mutation.isPending && (
          <div className="flex items-center gap-2 text-[12px] text-xb-text-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analysing the match…
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (question.trim()) mutation.mutate(question.trim());
        }}
        className="mt-4 flex gap-2"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask anything about this match…"
          className="flex-1 rounded-full border border-xb-line bg-transparent px-3 py-2 text-[12px] text-xb-text outline-none placeholder:text-xb-text-muted"
        />
        <button
          type="submit"
          disabled={mutation.isPending || !question.trim()}
          className="rounded-full bg-xb-blue px-4 py-2 text-[12px] font-bold text-xb-on-dark disabled:opacity-50"
        >
          Ask
        </button>
      </form>
    </div>
  );
}

function EventLine({ e, home, away }: { e: EventRow; home: string; away: string }) {
  const isHome = e.side === "home";
  return (
    <div className="flex items-center gap-3 border-b border-xb-line px-3 py-2 text-[12px] last:border-0">
      <span className="w-10 shrink-0 rounded-md bg-xb-odds px-1.5 py-0.5 text-center text-[11px] font-bold text-xb-blue">
        {e.time || "-"}'
      </span>
      <div className={`min-w-0 flex-1 ${isHome ? "text-left" : "text-right"}`}>
        <div className="truncate font-medium text-xb-text">{e.player}</div>
        {e.detail && <div className="truncate text-[11px] text-xb-text-muted">{e.detail}</div>}
      </div>
      <span className="w-24 shrink-0 truncate text-right text-[11px] text-xb-text-muted">
        {isHome ? home : away}
      </span>
    </div>
  );
}

function SummaryTab({
  goals,
  cards,
  substitutions,
  home,
  away,
  referee,
  stadium,
}: {
  goals: EventRow[];
  cards: EventRow[];
  substitutions: EventRow[];
  home: string;
  away: string;
  referee: string;
  stadium?: string | null;
}) {
  const blocks: { title: string; rows: EventRow[] }[] = [
    { title: "Goals", rows: goals },
    { title: "Cards", rows: cards },
    { title: "Substitutions", rows: substitutions },
  ].filter((b) => b.rows.length > 0);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-xb-line bg-xb-odds px-3 py-2 text-[12px] text-xb-text-muted">
        {stadium && <span>Venue: {stadium}</span>}
        {referee && <span>Referee: {referee}</span>}
      </div>
      {blocks.length === 0 && (
        <div className="px-3 py-6 text-center text-[12px] text-xb-text-muted">
          No match events available.
        </div>
      )}
      {blocks.map((b) => (
        <div key={b.title}>
          <div className="bg-xb-panel-alt px-3 py-2 text-[12px] font-bold uppercase text-xb-text">
            {b.title}
          </div>
          {b.rows.map((e, i) => (
            <EventLine key={`${b.title}-${i}`} e={e} home={home} away={away} />
          ))}
        </div>
      ))}
    </div>
  );
}

function LineupColumn({
  team,
  side,
}: {
  team: MatchLineups["home"];
  side: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between border-b border-xb-line bg-xb-odds px-3 py-2">
        <span className="truncate text-[13px] font-bold text-xb-text">{side}</span>
        {team.coach && <span className="text-[11px] text-xb-text-muted">Coach: {team.coach}</span>}
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
            <div className="px-3 py-1.5 text-[11px] font-bold uppercase text-xb-text-muted">
              {label}
            </div>
            {list.map((p, i) => (
              <div
                key={`${label}-${i}`}
                className="flex items-center gap-2 border-b border-xb-line px-3 py-1.5 text-[12px] last:border-0"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-xb-odds text-[10px] font-bold text-xb-blue">
                  {p.number || "-"}
                </span>
                <span className="min-w-0 flex-1 truncate text-xb-text">{p.name}</span>
                {p.position && (
                  <span className="text-[10px] text-xb-text-muted">{p.position}</span>
                )}
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}

function LineupsTab({
  lineups,
  home,
  away,
}: {
  lineups: MatchLineups;
  home: string;
  away: string;
}) {
  return (
    <div className="grid gap-px bg-xb-line md:grid-cols-2">
      <LineupColumn team={lineups.home} side={home} />
      <LineupColumn team={lineups.away} side={away} />
    </div>
  );
}

function VideosTab({ videos }: { videos: VideoItem[] }) {
  const { open } = useVideoPlayer();

  if (videos.length === 0) {
    return (
      <div className="px-3 py-6 text-center text-[12px] text-xb-text-muted">
        No highlight videos published for this match yet.
      </div>
    );
  }

  return (
    <div className="grid gap-3 p-3 md:grid-cols-2">
      {videos.map((v, i) => {
        const thumb = thumbUrl(v.url);
        return (
          <button
            key={v.url || i}
            type="button"
            onClick={() => open(videos, i)}
            className="group overflow-hidden rounded-xl bg-xb-odds text-left ring-1 ring-xb-line transition hover:ring-xb-blue"
          >
            <div className="relative aspect-video w-full overflow-hidden bg-xb-panel-alt">
              {thumb ? (
                <img
                  src={thumb}
                  alt={v.title}
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                />
              ) : null}
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-xb-blue/90 text-xb-on-dark shadow-lg transition group-hover:scale-110">
                  <Play className="h-5 w-5 translate-x-[1px]" />
                </span>
              </span>
            </div>
            <span className="block truncate px-3 py-2 text-[12px] font-medium text-xb-text group-hover:text-xb-blue">
              {v.title}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- provider extras ---------------- */

function BoxScoreTab({
  box,
  home,
  away,
}: {
  box: NonNullable<MatchDetails["boxScore"]>;
  home: string;
  away: string;
}) {
  const cols = [
    ["Min", "minutes"],
    ["Pts", "points"],
    ["Reb", "rebounds"],
    ["Ast", "assists"],
    ["Stl", "steals"],
    ["Blk", "blocks"],
    ["TO", "turnovers"],
    ["PF", "fouls"],
    ["+/-", "plusMinus"],
  ] as const;

  const table = (title: string, rows: NonNullable<MatchDetails["boxScore"]>["home"]) => (
    <div className="min-w-0">
      <h3 className="px-3 py-2 text-[13px] font-bold text-xb-text">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-xb-odds text-left text-xb-text-muted">
              <th className="px-2 py-2">Player</th>
              <th className="px-2 py-2">Pos</th>
              {cols.map(([label]) => (
                <th key={label} className="px-2 py-2 text-right">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => (
              <tr key={`${p.name}-${i}`} className="border-b border-xb-line">
                <td className="px-2 py-2 font-medium text-xb-text">{p.name}</td>
                <td className="px-2 py-2 text-xb-text-muted">{p.position}</td>
                {cols.map(([label, key]) => (
                  <td key={label} className="px-2 py-2 text-right tabular-nums text-xb-text">
                    {p[key] || "-"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="grid gap-2 xl:grid-cols-2">
      {table(home, box.home)}
      {table(away, box.away)}
    </div>
  );
}

function ProbabilitiesTab({
  rows,
  home,
  away,
}: {
  rows: MatchDetails["probabilities"];
  home: string;
  away: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="px-3 py-6 text-[13px] text-xb-text-muted">
        No probability model published for this match.
      </div>
    );
  }
  return (
    <div className="p-3">
      <p className="mb-3 text-[12px] text-xb-text-muted">
        Provider probability model — left side favours {home}, right side favours {away}.
      </p>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="mb-1 flex items-center justify-between text-[12px]">
              <span className="font-semibold tabular-nums text-xb-text">{r.home}%</span>
              <span className="text-xb-text-muted">{r.label}</span>
              <span className="font-semibold tabular-nums text-xb-text">{r.away}%</span>
            </div>
            <div className="flex h-1.5 gap-1">
              <div className="flex flex-1 justify-end rounded-full bg-xb-odds">
                <div
                  className="h-full rounded-full bg-xb-accent"
                  style={{ width: `${Math.min(100, r.home)}%` }}
                />
              </div>
              <div className="flex-1 rounded-full bg-xb-odds">
                <div
                  className="h-full rounded-full bg-xb-accent"
                  style={{ width: `${Math.min(100, r.away)}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CommentaryTab({ rows }: { rows: MatchDetails["comments"] }) {
  if (rows.length === 0) {
    return (
      <div className="px-3 py-6 text-[13px] text-xb-text-muted">
        No live commentary published for this match.
      </div>
    );
  }
  return (
    <ul className="divide-y divide-xb-line">
      {rows.map((c, i) => (
        <li key={`${c.time}-${i}`} className="flex gap-3 px-3 py-2">
          <span className="w-12 shrink-0 text-[12px] font-bold tabular-nums text-xb-text-muted">
            {c.time}
          </span>
          <span className="min-w-0 text-[13px] text-xb-text">
            {c.text}
            {c.info ? <span className="text-xb-text-muted"> · {c.info}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

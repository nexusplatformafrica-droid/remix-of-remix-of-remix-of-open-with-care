import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, ListOrdered, Maximize2, Play } from "lucide-react";
import { Header } from "@/components/xbet/Header";
import { MobileNav } from "@/components/xbet/MobileNav";
import { ClientOnly } from "@/components/xbet/ClientOnly";
import { VirtualSkeleton, VirtualMatchSkeleton } from "@/components/xbet/VirtualSkeleton";
import { VirtualBetSlip } from "@/components/xbet/VirtualBetSlip";
import { resetVirtualSlip, setVirtualSlip } from "@/components/xbet/virtual-slip-store";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { money, useAuth } from "@/components/xbet/AuthContext";
import { virtualOfferQuery, virtualResultsQuery } from "@/lib/virtual-queries";
import { serverNow, syncServerTime } from "@/lib/server-time";
import type { VirtualMatch } from "@/lib/virtual.server";


export const Route = createFileRoute("/virtual")({
  head: () => ({
    meta: [
      { title: "Virtual Soccer League — BET PLUS+" },
      {
        name: "description",
        content:
          "Bet on BET PLUS+ virtual soccer: full time, half time, totals, correct score and both teams to score markets with a new match every few minutes.",
      },
      { property: "og:title", content: "Virtual Soccer League — BET PLUS+" },
      {
        property: "og:description",
        content: "Virtual soccer with full market depth, live tracker and instant settlement.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VirtualPage,
});

const STREAM_URL = "https://zweb4ug.com/forteugvideo/index.php";
const TRACKER_URL = "https://zweb4ug.com/forteug/index.php";
/** Both provider pages are authored on a fixed 277x231 canvas. */
const EMBED_W = 277;
const EMBED_H = 231;

type Sel = { id: string; matchId: string; no: number; event: string; pick: string; label: string; odd: number };

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Scales the fixed-size provider page to fill the available width without exceeding a max height. */
function ScaledEmbed({
  src,
  title,
  maxHeight = 280,
}: {
  src: string;
  title: string;
  maxHeight?: number;
}) {
  const [size, setSize] = useState({ width: EMBED_W, height: EMBED_H });
  const [node, setNode] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!node) return;
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const width = entry.contentRect.width;
      if (!width) return;
      const height = Math.min(maxHeight, (EMBED_H / EMBED_W) * width);
      setSize({ width, height });
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, [node, maxHeight]);

  return (
    <div ref={setNode} className="w-full overflow-hidden bg-black" style={{ height: size.height }}>
      <iframe
        src={src}
        title={title}
        loading="lazy"
        scrolling="no"
        allow="autoplay; fullscreen"
        allowFullScreen
        className="border-0"
        style={{
          width: EMBED_W,
          height: EMBED_H,
          transform: `scale(${size.width / EMBED_W}, ${size.height / EMBED_H})`,
          transformOrigin: "top left",
        }}
      />
    </div>
  );
}

function Cell({
  name,
  odd,
  active,
  onClick,
}: {
  name: string;
  odd: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group flex h-full min-h-[32px] w-full flex-col items-center justify-center rounded-md border px-1 text-[9px] leading-none transition-all active:scale-[0.97] ${
        active
          ? "border-xb-blue bg-xb-blue text-xb-on-dark shadow-sm"
          : "border-xb-line bg-xb-panel-alt text-xb-text-muted hover:border-xb-blue hover:bg-xb-odds-hover"
      }`}
    >
      <span className="w-full truncate text-center uppercase tracking-wide">{name}</span>
      <span className={`mt-0.5 text-[11px] font-black ${active ? "text-xb-on-dark" : "text-xb-blue"}`}>
        {odd.toFixed(2)}
      </span>
    </button>
  );
}

function GroupTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="shrink-0 border-y border-xb-line bg-xb-header/90 px-2 py-[1px] text-center text-[8px] font-bold uppercase tracking-wider text-xb-on-dark-muted">
      {children}
    </div>
  );
}

/** Grid width per market group so long lists stay readable. */
function columnsFor(group: VirtualMatch["groups"][number]) {
  if (group.type === "Correct score") return 3;
  if (group.odds.length >= 5) return 5;
  return Math.max(1, Math.min(3, group.odds.length));
}

function VirtualPageInner() {
  const { user, balance, addBet, openLogin, rawBets } = useAuth();
  const offer = useQuery(virtualOfferQuery());
  const results = useQuery(virtualResultsQuery());

  const [sels, setSels] = useState<Sel[]>([]);
  const [stake, setStake] = useState(1000);
  const [tab, setTab] = useState<"stream" | "tracker">("stream");
  const [now, setNow] = useState(() => Date.now());
  const [placing, setPlacing] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [slipOpen, setSlipOpen] = useState(false);
  const [streamOpen, setStreamOpen] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);
  const isMobile = useIsMobile();


  useEffect(() => {
    void syncServerTime();
    const id = setInterval(() => setNow(serverNow().getTime()), 1000);
    return () => clearInterval(id);
  }, []);

  const matches = offer.data?.matches ?? [];
  const featured = matches[0];

  // Drop selections whose match has rolled out of the offer.
  useEffect(() => {
    if (matches.length === 0) return;
    const live = new Set(matches.map((m) => m.id));
    setSels((s) => (s.every((x) => live.has(x.matchId)) ? s : s.filter((x) => live.has(x.matchId))));
  }, [matches]);

  // Keep the mobile match tab in range as the offer rolls over.
  useEffect(() => {
    setActiveIdx((i) => (matches.length === 0 ? 0 : Math.min(i, matches.length - 1)));
  }, [matches.length]);


  const secondsLeft = featured
    ? Math.max(0, Math.floor((Date.parse(featured.kickoff) - now) / 1000))
    : 0;
  const clock = `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(secondsLeft % 60).padStart(2, "0")}`;

  const totalOdds = useMemo(() => round2(sels.reduce((a, s) => a * s.odd, 1)), [sels]);

  // Only one odd per match: picking another market on the same fixture replaces it.
  const toggle = (sel: Sel) =>
    setSels((s) =>
      s.some((x) => x.id === sel.id)
        ? s.filter((x) => x.id !== sel.id)
        : [...s.filter((x) => x.matchId !== sel.matchId), sel],
    );


  const openTickets = rawBets.filter(
    (b) => b.status === "pending" && b.matches.some((m) => m.sport === "virtual"),
  );

  const place = async () => {
    if (!user) return openLogin();
    if (sels.length === 0) return toast.error("Select at least one market.");
    setPlacing(true);
    try {
      await addBet({
        events: sels.length,
        stake,
        odds: totalOdds,
        matches: sels.map((s) => ({
          event: s.event,
          market: s.pick,
          odd: s.odd,
          matchId: s.matchId,
          sport: "virtual",
          league: "Virtual soccer",
          startsAt: Date.parse(matches.find((m) => m.id === s.matchId)?.kickoff ?? "") || Date.now(),
        })),
      });
      setSels([]);
      setSlipOpen(false);
      toast.success("Virtual ticket placed — it settles automatically.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPlacing(false);
    }
  };

  // Route the shared mobile nav bet-slip button to the virtual slip on this page.
  useEffect(() => {
    setVirtualSlip({ active: true, open: () => setSlipOpen(true) });
    return () => resetVirtualSlip();
  }, []);
  useEffect(() => {
    setVirtualSlip({ count: sels.length });
  }, [sels.length]);

  // The offer feed carries the last 3 finished rounds — those show first, then
  // every other result underneath, newest round number down to the oldest.
  const latest = [...(offer.data?.results ?? [])].sort((a, b) => b.no - a.no).slice(0, 3);
  const latestIds = new Set(latest.map((r) => r.id));
  const older = [...(results.data ?? [])]
    .filter((r) => !latestIds.has(r.id))
    .sort((a, b) => b.no - a.no);
  const recent = latest.length ? latest : [...(results.data ?? [])].sort((a, b) => b.no - a.no).slice(0, 3);
  const rest = latest.length ? older : older.slice(3);

  const slipPanel = (
    <VirtualBetSlip
      sels={sels}
      onRemove={(id) => setSels((x) => x.filter((y) => y.id !== id))}
      onClear={() => setSels([])}
      stake={stake}
      setStake={setStake}
      totalOdds={totalOdds}
      onPlace={() => void place()}
      placing={placing}
      loggedIn={!!user}
      balance={balance}
      listClassName={isMobile ? "max-h-[45dvh]" : "max-h-40"}
    />
  );


  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-xb-page font-xb">
      <Header />
      <main className="flex w-full flex-1 flex-col gap-1.5 overflow-hidden px-0 pb-28 pt-1.5 md:px-1.5 md:pb-16 lg:pb-1.5">
        <div className="flex items-center justify-between rounded-lg bg-xb-panel px-3 py-[2px] text-[11px] font-bold text-xb-text shadow-sm">
          <span>
            Time to kickoff: <span className="text-xb-blue">{clock}</span>
          </span>
          <h1 className="flex items-center gap-2 text-sm font-black tracking-tight">
            <span className="text-xb-text">VIRTUAL</span>
            <span className="text-xb-blue">SOCCER</span>
          </h1>
          <span className="hidden text-xb-text-muted sm:block">
            Match <span className="text-xb-blue">#{featured?.no ?? "—"}</span> · new match every 5 minutes
          </span>
        </div>

        {/* Mobile-only match switcher — one match at a time instead of a 3-way grid */}
        {matches.length > 0 && (
          <div className="flex shrink-0 gap-1 overflow-x-auto px-1 lg:hidden xb-noscroll">
            {matches.map((m, i) => (
              <button
                key={m.id}
                onClick={() => setActiveIdx(i)}
                className={`shrink-0 rounded-md px-3 py-1.5 text-[11px] font-bold transition-colors ${
                  i === activeIdx ? "bg-xb-blue text-xb-on-dark" : "bg-xb-panel text-xb-text-muted"
                }`}
              >
                #{m.no} · {m.home} v {m.away}
              </button>
            ))}
          </div>
        )}


        <div className="flex min-h-0 w-full flex-1 flex-col gap-1.5 overflow-y-auto pb-24 lg:grid lg:grid-cols-[repeat(3,minmax(0,1fr))_minmax(260px,22%)] lg:overflow-hidden lg:pb-0">
          {matches.length === 0 && offer.isError && (
            <div className="col-span-full flex items-center justify-center gap-2 rounded-lg bg-xb-panel py-10 text-[12px] text-xb-text-muted">
              <AlertTriangle className="h-4 w-4 text-xb-red" />
              Virtual feed unavailable — retrying…
            </div>
          )}

          {matches.length === 0 &&
            !offer.isError &&
            Array.from({ length: 3 }).map((_, i) => <VirtualMatchSkeleton key={i} />)}


          {matches.map((m, idx) => (
            <section
              key={m.id}
              className={`flex min-h-0 shrink-0 flex-col overflow-hidden rounded-lg border bg-xb-panel pb-1 shadow-sm lg:shrink ${
                idx === 0 ? "border-xb-blue" : "border-xb-line"
              } ${idx === activeIdx ? "" : "hidden lg:flex"}`}

            >
              <div
                className={`sticky top-0 z-10 flex shrink-0 items-center gap-2 px-2 py-[2px] text-[11px] font-bold ${
                  idx === 0 ? "bg-xb-blue text-xb-on-dark" : "bg-xb-header text-xb-on-dark"
                }`}
              >
                <span className="rounded bg-black/20 px-1">{m.no}</span>
                <span className="flex-1 truncate text-center">
                  {m.home} <span className="opacity-70">vs</span> {m.away}
                </span>
                <span className="rounded bg-black/20 px-1 text-[9px] uppercase">{m.league}</span>
              </div>

              {m.groups.map((g, gi) => (
                <div key={`${m.id}-${g.key}`} className="flex flex-col lg:flex-1">
                  {m.groups[gi - 1]?.label !== g.label && <GroupTitle>{g.label}</GroupTitle>}
                  <div
                    className="grid gap-1 p-1 lg:h-full lg:flex-1 lg:auto-rows-fr"
                    style={{ gridTemplateColumns: `repeat(${columnsFor(g)}, minmax(0, 1fr))` }}
                  >

                    {g.odds.map((o) => {
                      const type = g.key === "10" ? "OTHER" : g.type;
                      const pick = `${type}|${o.name}`;
                      const id = `${m.id}-${g.key}-${o.id}`;
                      return (
                        <Cell
                          key={id}
                          name={o.name}
                          odd={o.odd}
                          active={sels.some((s) => s.id === id)}
                          onClick={() =>
                            toggle({
                              id,
                              matchId: m.id,
                              no: m.no,
                              event: `${m.home} — ${m.away}`,
                              pick,
                              label: `#${m.no} ${g.label}: ${o.name}`,
                              odd: o.odd,
                            })
                          }
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </section>
          ))}

          <aside className="hidden min-h-0 flex-col gap-2 lg:flex lg:overflow-y-auto">
            <div className="overflow-hidden rounded-lg shadow-sm">
              <div className="grid grid-cols-2">
                {(["stream", "tracker"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`py-1.5 text-[11px] font-bold uppercase ${
                      tab === t ? "bg-xb-blue text-xb-on-dark" : "bg-xb-header text-xb-on-dark-muted"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between bg-xb-panel-alt px-2 py-1 text-[10px] font-bold text-xb-text">
                <span>Next match: {featured?.no ?? "—"}</span>
                <span className="text-xb-blue">{clock}</span>
              </div>
              <ScaledEmbed
                src={tab === "stream" ? STREAM_URL : TRACKER_URL}
                title={tab === "stream" ? "Virtual soccer stream" : "Virtual soccer tracker"}
              />
              <div className="grid grid-cols-2">
                <a
                  href={tab === "stream" ? STREAM_URL : TRACKER_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-full items-center justify-center gap-1.5 bg-xb-blue px-2 py-1.5 text-[11px] font-bold uppercase text-xb-on-dark"
                >
                  <Maximize2 className="h-3.5 w-3.5" /> Expand
                </a>
                <button
                  onClick={() => setResultsOpen(true)}
                  className="flex w-full items-center justify-center gap-1.5 bg-xb-header px-2 py-1.5 text-[11px] font-bold uppercase text-xb-on-dark"
                >
                  <ListOrdered className="h-3.5 w-3.5 text-xb-blue" /> Results
                </button>
              </div>
            </div>

            {slipPanel}


            {openTickets.length > 0 && (
              <div className="overflow-hidden rounded-lg border border-xb-line bg-xb-panel shadow-sm">
                <div className="bg-xb-header px-2 py-1.5 text-[11px] font-black uppercase text-xb-on-dark">
                  Running virtual tickets
                </div>
                <ul className="divide-y divide-xb-line">
                  {openTickets.slice(0, 4).map((b) => (
                    <li key={b.id} className="px-2 py-1.5 text-[10px] text-xb-text">
                      <div className="flex justify-between font-bold">
                        <span className="text-xb-blue">{b.code}</span>
                        <span>UGX {money(b.stake)}</span>
                      </div>
                      <p className="truncate text-xb-text-muted">
                        {b.matches.length} leg(s) · settles automatically after kickoff
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>

        {/* Mobile-only: virtual stream + results triggers */}
        <div className="fixed inset-x-0 bottom-14 z-30 flex items-center gap-2 border-t border-xb-line bg-xb-panel px-2 py-1.5 md:bottom-0 lg:hidden">
          <button
            onClick={() => setStreamOpen(true)}
            className="flex items-center gap-1.5 rounded-md bg-xb-header px-3 py-2 text-[11px] font-bold uppercase text-xb-on-dark"
          >
            <Play className="h-3.5 w-3.5 text-xb-blue" /> Stream
          </button>
          <button
            onClick={() => setResultsOpen(true)}
            className="flex items-center gap-1.5 rounded-md bg-xb-header px-3 py-2 text-[11px] font-bold uppercase text-xb-on-dark"
          >
            <ListOrdered className="h-3.5 w-3.5 text-xb-blue" /> Results
          </button>
          <span className="flex-1 text-right text-[11px] font-bold text-xb-text-muted">
            Slip: {sels.length} · {totalOdds.toFixed(2)}
          </span>
        </div>
      </main>

      <Sheet open={streamOpen} onOpenChange={setStreamOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl border-xb-line bg-xb-panel p-0 font-xb lg:hidden">
          <SheetHeader className="border-b border-xb-line px-3 py-2 text-left">
            <SheetTitle className="text-[12px] font-black uppercase text-xb-text">
              Virtual {tab} · next match {featured?.no ?? "—"} in {clock}
            </SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-2">
            {(["stream", "tracker"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`py-2 text-[11px] font-bold uppercase ${
                  tab === t ? "bg-xb-blue text-xb-on-dark" : "bg-xb-header text-xb-on-dark-muted"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          {streamOpen && (
            <ScaledEmbed
              src={tab === "stream" ? STREAM_URL : TRACKER_URL}
              title={tab === "stream" ? "Virtual soccer stream" : "Virtual soccer tracker"}
              maxHeight={320}
            />
          )}
          <a
            href={tab === "stream" ? STREAM_URL : TRACKER_URL}
            target="_blank"
            rel="noreferrer"
            className="flex w-full items-center justify-center gap-2 bg-xb-blue px-2 py-3 text-[11px] font-bold uppercase text-xb-on-dark"
          >
            <Maximize2 className="h-3.5 w-3.5" /> Open full {tab}
          </a>
        </SheetContent>
      </Sheet>

      <Sheet open={slipOpen} onOpenChange={setSlipOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] overflow-y-auto rounded-t-2xl border-xb-line bg-xb-panel p-2 font-xb lg:hidden"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Virtual bet slip</SheetTitle>
          </SheetHeader>
          {slipPanel}
        </SheetContent>
      </Sheet>

      <Sheet open={resultsOpen} onOpenChange={setResultsOpen}>
        <SheetContent side="bottom" className="max-h-[80dvh] rounded-t-2xl border-xb-line bg-xb-panel p-0 font-xb">
          <SheetHeader className="border-b border-xb-line px-3 py-2 text-left">
            <SheetTitle className="text-[12px] font-black uppercase text-xb-text">
              Latest virtual results {results.isFetching ? "· updating…" : ""}
            </SheetTitle>
          </SheetHeader>
          {recent.length === 0 && rest.length === 0 ? (
            <p className="px-3 py-4 text-[11px] text-xb-text-muted">Waiting for the first result…</p>
          ) : (
            <div className="max-h-[65dvh] overflow-y-auto">
              <p className="bg-xb-panel-alt px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-xb-text-muted">
                Last 3 rounds
              </p>
              <ul className="divide-y divide-xb-line">
                {recent.map((r) => (
                  <li key={r.id} className="flex items-center gap-2 px-3 py-2 text-[11px]">
                    <span className="w-8 shrink-0 font-black text-xb-blue">#{r.no}</span>
                    <span className="min-w-0 flex-1 truncate text-xb-text">
                      {r.home} <span className="text-xb-text-muted">vs</span> {r.away}
                    </span>
                    <span className="shrink-0 rounded bg-xb-odds px-1.5 py-0.5 font-black text-xb-text">
                      {r.ft.h}:{r.ft.a}
                    </span>
                    <span className="shrink-0 text-[10px] text-xb-text-muted">
                      HT {r.ht.h}:{r.ht.a}
                    </span>
                  </li>
                ))}
              </ul>
              {rest.length > 0 && (
                <>
                  <p className="bg-xb-panel-alt px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-xb-text-muted">
                    All results · newest round first
                  </p>
                  <ul className="divide-y divide-xb-line">
                    {rest.map((r) => (
                      <li key={r.id} className="flex items-center gap-2 px-3 py-2 text-[11px]">
                        <span className="w-8 shrink-0 font-black text-xb-blue">#{r.no}</span>
                        <span className="min-w-0 flex-1 truncate text-xb-text">
                          {r.home} <span className="text-xb-text-muted">vs</span> {r.away}
                        </span>
                        <span className="shrink-0 rounded bg-xb-odds px-1.5 py-0.5 font-black text-xb-text">
                          {r.ft.h}:{r.ft.a}
                        </span>
                        <span className="shrink-0 text-[10px] text-xb-text-muted">
                          HT {r.ht.h}:{r.ht.a}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <MobileNav />
    </div>
  );
}

function VirtualPage() {
  return (
    <ClientOnly fallback={<VirtualSkeleton />}>
      <VirtualPageInner />
    </ClientOnly>
  );
}

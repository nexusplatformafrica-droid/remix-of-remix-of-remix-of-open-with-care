import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
import { PageShell } from "@/components/xbet/PageShell";
import { money } from "@/components/xbet/AuthContext";
import { useSiteContent } from "@/components/admin/AdminDataContext";
import { WinnerDetailsSection, WinnerTicketSection } from "@/components/xbet/WinnerSections";

export const Route = createFileRoute("/lucky-winner")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Lucky Winners — Latest Payouts at BET PLUS+" },
      {
        name: "description",
        content:
          "See the latest lucky winners on BET PLUS+ — real payouts published by our team, with full winning ticket previews.",
      },
      { property: "og:title", content: "Lucky Winners — Latest Payouts at BET PLUS+" },
      {
        property: "og:description",
        content: "Real winning tickets and payouts published by BET PLUS+.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LuckyWinnerPage,
});

/** Desktop keeps the 3-column board; mobile navigates to a dedicated page. */
function isDesktop() {
  return typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches;
}

function LuckyWinnerPage() {
  const { content, ready } = useSiteContent();
  const [selected, setSelected] = useState<string | null>(null);

  const feed = useMemo(
    () => content.winners.filter((w) => w.active).sort((a, b) => b.at - a.at),
    [content.winners],
  );

  useEffect(() => {
    if (feed.length === 0) return;
    if (!feed.some((w) => w.id === selected)) setSelected(feed[0]!.id);
  }, [feed, selected]);

  const featured = useMemo(() => feed.find((w) => w.id === selected) ?? null, [feed, selected]);

  if (!ready) return <LuckyWinnerSkeleton />;

  return (
    <PageShell fullBleed>
      <div className="flex h-full min-h-0 w-full flex-col gap-2 overflow-y-auto pb-4 md:grid md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.7fr)_minmax(0,0.85fr)] md:gap-px md:overflow-hidden md:pb-0">
        {/* Left — winners list (the only section shown on mobile) */}
        <section className="flex min-h-0 flex-col overflow-hidden rounded-xl bg-xb-panel shadow-sm md:rounded-none">
          <header className="flex shrink-0 items-center gap-2 border-b border-xb-line px-3 py-2">
            <Trophy className="h-4 w-4 shrink-0 text-xb-green" />
            <h2 className="min-w-0 flex-1 truncate text-[12px] font-black uppercase tracking-wide text-xb-text">
              Lucky winners
            </h2>
            <span className="shrink-0 rounded-full bg-xb-green/10 px-2 py-0.5 text-[10px] font-bold text-xb-green">
              LIVE
            </span>
          </header>
          <ul className="min-h-0 flex-1 divide-y divide-xb-line overflow-y-auto">
            {feed.length === 0 && (
              <li className="px-3 py-6 text-center text-[12px] text-xb-text-muted">
                No winners published yet. Check back soon.
              </li>
            )}
            {feed.map((w) => (
              <li key={w.id}>
                <Link
                  to="/winner/$winnerId"
                  params={{ winnerId: w.id }}
                  onClick={(e) => {
                    if (isDesktop()) {
                      e.preventDefault();
                      setSelected(w.id);
                    }
                  }}
                  className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 text-left transition-colors ${
                    selected === w.id ? "md:bg-xb-panel-alt" : "hover:bg-xb-panel-alt"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-bold text-xb-text">{w.name}</p>
                    <p className="truncate text-[10px] text-xb-text-muted">
                      {w.game ?? "Sports multibet"}
                      {w.location ? ` · ${w.location}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-[12px] font-black text-xb-green">
                    UGX {money(w.amount)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Middle — winner details (desktop only) */}
        <section className="hidden min-h-0 flex-col gap-2 overflow-y-auto rounded-xl bg-xb-panel p-3 shadow-sm md:flex md:rounded-none">
          <WinnerDetailsSection featured={featured} />
        </section>

        {/* Right — full ticket preview (desktop only) */}
        <section
          id="ticket-print"
          className="hidden min-h-0 flex-col overflow-hidden rounded-xl bg-xb-panel shadow-sm md:flex md:rounded-none"
        >
          <WinnerTicketSection featured={featured} />
        </section>
      </div>
    </PageShell>
  );
}

/** Loading placeholder shown until the live winners feed arrives. */
function LuckyWinnerSkeleton() {
  return (
    <PageShell fullBleed>
      <div className="flex h-full min-h-0 w-full animate-pulse flex-col gap-2 overflow-y-auto md:grid md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.7fr)_minmax(0,0.85fr)] md:gap-px md:overflow-hidden">
        <section className="flex min-h-0 flex-col gap-2 overflow-hidden rounded-xl bg-xb-panel p-3 shadow-sm md:rounded-none">
          <div className="h-4 w-1/2 rounded bg-xb-odds" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              <div className="space-y-1">
                <div className="h-3 w-3/4 rounded bg-xb-odds" />
                <div className="h-2 w-1/2 rounded bg-xb-odds" />
              </div>
              <div className="h-3 w-16 rounded bg-xb-odds" />
            </div>
          ))}
        </section>
        <section className="hidden min-h-0 flex-col gap-2 rounded-xl bg-xb-panel p-3 shadow-sm md:flex md:rounded-none">
          <div className="h-[190px] shrink-0 rounded-xl bg-xb-odds md:h-[240px]" />
          <div className="space-y-2 rounded-xl bg-xb-panel-alt p-3">
            <div className="h-3 w-20 rounded bg-xb-odds" />
            <div className="h-6 w-2/3 rounded bg-xb-odds" />
            <div className="h-7 w-1/2 rounded bg-xb-odds" />
          </div>
          <div className="space-y-2 rounded-xl bg-xb-panel-alt p-3">
            <div className="h-3 w-24 rounded bg-xb-odds" />
            <div className="h-3 w-full rounded bg-xb-odds" />
            <div className="h-3 w-4/5 rounded bg-xb-odds" />
          </div>
        </section>
        <section className="hidden min-h-0 flex-col gap-2 rounded-xl bg-xb-panel p-3 shadow-sm md:flex md:rounded-none">
          <div className="h-4 w-2/3 rounded bg-xb-odds" />
          <div className="h-14 w-full rounded-lg bg-xb-odds" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <div className="h-3 w-full rounded bg-xb-odds" />
              <div className="h-2 w-2/3 rounded bg-xb-odds" />
            </div>
          ))}
        </section>
      </div>
    </PageShell>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/xbet/Header";
import { LeftSidebar } from "@/components/xbet/LeftSidebar";
import { HeroBanner, GameTiles } from "@/components/xbet/HeroBanner";
import { MatchesPanel } from "@/components/xbet/MatchesPanel";
import { RightSidebar } from "@/components/xbet/RightSidebar";
import { SportFilterProvider } from "@/components/xbet/SportFilterContext";
import { MobileNav } from "@/components/xbet/MobileNav";
import type { Sport } from "@/lib/sports-types";


type HomeSearch = { sport: Sport; league: number; country: number };

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): Partial<HomeSearch> => {
    const out: Partial<HomeSearch> = {};
    const sport = search["sport"];
    if (sport === "football" || sport === "basketball" || sport === "tennis" || sport === "cricket") out.sport = sport;
    if (Number(search["league"]) > 0) out.league = Number(search["league"]);
    if (Number(search["country"]) > 0) out.country = Number(search["country"]);
    return out;
  },
  head: () => ({
    meta: [
      { title: "BET PLUS+ — Best Online Betting Site, Live Odds & Aviator" },
      {
        name: "description",
        content:
          "Bet on Premier League, La Liga, Serie A, UCL, AFCON and 1000+ live events with the best odds. Play Aviator, virtual soccer and slots. Instant Mobile Money deposits and fast payouts.",
      },
      {
        name: "keywords",
        content:
          "best betting site, online betting, live odds, football betting today, Premier League odds, Champions League betting, Aviator, virtual soccer, slots, mobile money betting, Uganda, Kenya, Tanzania, Nigeria, Ghana",
      },
      { property: "og:title", content: "BET PLUS+ — Best Online Betting Site, Live Odds & Aviator" },
      {
        property: "og:description",
        content:
          "Live odds on 1000+ events, Aviator, virtual soccer, slots and instant Mobile Money payouts at BET PLUS+.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "How do I deposit on BET PLUS+?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Open your account menu, choose Deposit, pick your Mobile Money network and confirm the prompt on your phone. Funds land in your wallet instantly.",
              },
            },
            {
              "@type": "Question",
              name: "Which sports and leagues can I bet on?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Football (Premier League, La Liga, Serie A, Bundesliga, Ligue 1, UEFA Champions League, AFCON and local leagues), basketball, tennis, plus virtual soccer and Aviator.",
              },
            },
            {
              "@type": "Question",
              name: "How fast are withdrawals?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Withdrawals are sent straight to your Mobile Money wallet and usually complete within minutes.",
              },
            },
          ],
        }),
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { sport, league, country } = Route.useSearch();
  return (
    <SportFilterProvider
      initialSport={sport ?? "football"}
      initialScope={league || country ? "upcoming" : "today"}
      initialLeagueIds={league ? [league] : []}
      initialCountryIds={country ? [country] : []}
    >
      <div className="flex h-[100dvh] flex-col overflow-hidden bg-xb-page font-xb">
        <Header />
        <main className="flex min-h-0 flex-1 gap-2 overflow-hidden px-0 pt-1 md:px-2 md:pt-2">
          <div className="hidden lg:block">
            <LeftSidebar />
          </div>
          <div className="min-w-0 flex-1 overflow-y-auto pb-20 md:pb-4 md:pr-0.5">
            <HeroBanner />
            <GameTiles />
            <MatchesPanel />
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



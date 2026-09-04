import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/xbet/Header";
import { ResultsBoard } from "@/components/xbet/ResultsBoard";
import { SportFilterProvider, useSportFilters } from "@/components/xbet/SportFilterContext";
import { MobileNav } from "@/components/xbet/MobileNav";
import { StatsLinks } from "@/components/xbet/StatsLinks";

export const Route = createFileRoute("/results")({
  head: () => ({
    meta: [
      { title: "Live Scores & Results — BET PLUS+" },
      {
        name: "description",
        content:
          "Final scores and settled results for football, basketball and tennis from the last 7 days, filterable by country and league.",
      },
      { property: "og:title", content: "Live Scores & Results — BET PLUS+" },
      {
        property: "og:description",
        content: "Football, basketball and tennis results updated as matches finish.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResultsPage,
});

function ResultsPage() {
  return (
    <SportFilterProvider initialScope="results">
      <div className="flex h-[100dvh] flex-col overflow-hidden bg-xb-page font-xb">
        <Header />
        <main className="flex min-h-0 w-full flex-1 flex-col gap-2 overflow-y-auto px-0 pb-14 pt-1 md:overflow-hidden md:px-0 md:pb-0 md:pt-0">
          <h1 className="sr-only">Football, basketball and tennis results</h1>
          <ResultsStats />
          <ResultsBoard />
        </main>
        <MobileNav />
      </div>
    </SportFilterProvider>
  );
}

/** Stats & tables shortcuts, moved here from the sidebar/mobile menu. */
function ResultsStats() {
  const { sport } = useSportFilters();
  return (
    <div className="shrink-0 px-2 pt-1">
      <StatsLinks sport={sport} />
    </div>
  );
}

import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, ListOrdered } from "lucide-react";
import { Header } from "@/components/xbet/Header";
import { MobileNav } from "@/components/xbet/MobileNav";
import { MatchHighlightsSection } from "@/components/xbet/ResultSections";
import { SPORTS, type Sport } from "@/lib/sports-types";

export const Route = createFileRoute("/result-highlights/$sport/$matchId")({
  head: () => ({
    meta: [
      { title: "Match Highlights & Line-ups — BET PLUS+" },
      {
        name: "description",
        content: "Watch the highlights and review line-ups, head-to-head and the league table.",
      },
      { property: "og:title", content: "Match Highlights & Line-ups — BET PLUS+" },
      {
        property: "og:description",
        content: "Highlights video, formations, line-ups, head-to-head and standings.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResultHighlightsPage,
});

function ResultHighlightsPage() {
  const { sport, matchId } = Route.useParams();
  const router = useRouter();
  const s = (SPORTS as readonly string[]).includes(sport) ? (sport as Sport) : "football";

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-xb-page font-xb">
      <Header />
      <main className="min-h-0 flex-1 overflow-y-auto pb-20 md:pb-4">
        <div className="sticky top-0 z-10 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-xb-line bg-xb-panel px-3 py-2">
          <button
            type="button"
            onClick={() => router.history.back()}
            aria-label="Back"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-xb-odds text-xb-text"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="min-w-0 truncate text-[12px] font-black uppercase tracking-wide text-xb-text">
            Highlights &amp; line-ups
          </h1>
          <Link
            to="/result-detail/$sport/$matchId"
            params={{ sport, matchId }}
            className="flex shrink-0 items-center gap-1 rounded-full bg-xb-odds px-2.5 py-1 text-[10px] font-bold text-xb-text"
          >
            <ListOrdered className="h-3 w-3" />
            Details
          </Link>
        </div>
        <MatchHighlightsSection sport={s} matchId={matchId} />
      </main>
      <MobileNav />
    </div>
  );
}

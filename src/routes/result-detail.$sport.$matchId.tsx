import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Film } from "lucide-react";
import { Header } from "@/components/xbet/Header";
import { MobileNav } from "@/components/xbet/MobileNav";
import { MatchDetailsSection } from "@/components/xbet/ResultSections";
import { SPORTS, type Sport } from "@/lib/sports-types";

export const Route = createFileRoute("/result-detail/$sport/$matchId")({
  head: () => ({
    meta: [
      { title: "Match Result Details — BET PLUS+" },
      {
        name: "description",
        content: "Full time score, goals, cards, substitutions and match statistics.",
      },
      { property: "og:title", content: "Match Result Details — BET PLUS+" },
      {
        property: "og:description",
        content: "Score, goals, cards and statistics for this finished match.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResultDetailPage,
});

function ResultDetailPage() {
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
            aria-label="Back to results"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-xb-odds text-xb-text"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="min-w-0 truncate text-[12px] font-black uppercase tracking-wide text-xb-text">
            Match details
          </h1>
          <Link
            to="/result-highlights/$sport/$matchId"
            params={{ sport, matchId }}
            className="flex shrink-0 items-center gap-1 rounded-full bg-xb-blue px-2.5 py-1 text-[10px] font-bold text-xb-on-dark"
          >
            <Film className="h-3 w-3" />
            Highlights
          </Link>
        </div>
        <MatchDetailsSection sport={s} matchId={matchId} />
      </main>
      <MobileNav />
    </div>
  );
}

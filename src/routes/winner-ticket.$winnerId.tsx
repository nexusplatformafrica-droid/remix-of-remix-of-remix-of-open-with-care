import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, User } from "lucide-react";
import { PageShell } from "@/components/xbet/PageShell";
import { useSiteContent } from "@/components/admin/AdminDataContext";
import { WinnerTicketSection } from "@/components/xbet/WinnerSections";

export const Route = createFileRoute("/winner-ticket/$winnerId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Winning Ticket — BET PLUS+" },
      {
        name: "description",
        content: "Full winning ticket breakdown: odds, stake, bonus, payout and every selection.",
      },
      { property: "og:title", content: "Winning Ticket — BET PLUS+" },
      {
        property: "og:description",
        content: "Odds, stake, bonus, payout and all selections on this winning BET PLUS+ ticket.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WinnerTicketPage,
});

function WinnerTicketPage() {
  const { winnerId } = Route.useParams();
  const { content, ready } = useSiteContent();
  const router = useRouter();
  const featured = content.winners.find((w) => w.id === winnerId) ?? null;

  return (
    <PageShell fullBleed>
      <div className="flex h-full min-h-0 flex-col">
        <div className="grid shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-xb-line bg-xb-panel px-3 py-2">
          <button
            type="button"
            onClick={() => router.history.back()}
            aria-label="Back"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-xb-odds text-xb-text"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="min-w-0 truncate text-[12px] font-black uppercase tracking-wide text-xb-text">
            Winning ticket
          </h1>
          <Link
            to="/winner/$winnerId"
            params={{ winnerId }}
            className="flex shrink-0 items-center gap-1 rounded-full bg-xb-odds px-2.5 py-1 text-[10px] font-bold text-xb-text"
          >
            <User className="h-3 w-3" />
            Winner
          </Link>
        </div>

        {!ready ? (
          <p className="px-3 py-10 text-center text-[12px] text-xb-text-muted">Loading ticket…</p>
        ) : !featured ? (
          <p className="px-3 py-10 text-center text-[12px] text-xb-text-muted">
            This ticket is no longer published.
          </p>
        ) : (
          <section id="ticket-print" className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <WinnerTicketSection featured={featured} />
          </section>
        )}
      </div>
    </PageShell>
  );
}

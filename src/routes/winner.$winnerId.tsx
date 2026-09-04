import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Ticket } from "lucide-react";
import { PageShell } from "@/components/xbet/PageShell";
import { useSiteContent } from "@/components/admin/AdminDataContext";
import { WinnerDetailsSection, WinnerTicketSection } from "@/components/xbet/WinnerSections";

export const Route = createFileRoute("/winner/$winnerId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Lucky Winner — BET PLUS+" },
      {
        name: "description",
        content: "Meet this BET PLUS+ lucky winner, their payout and their message.",
      },
      { property: "og:title", content: "Lucky Winner — BET PLUS+" },
      {
        property: "og:description",
        content: "A real BET PLUS+ payout, the winning amount and the winner's message.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WinnerDetailPage,
});

function WinnerDetailPage() {
  const { winnerId } = Route.useParams();
  const { content, ready } = useSiteContent();
  const router = useRouter();
  const featured = content.winners.find((w) => w.id === winnerId) ?? null;

  return (
    <PageShell>
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-xb-line bg-xb-panel px-3 py-2">
        <button
          type="button"
          onClick={() => router.history.back()}
          aria-label="Back to winners"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-xb-odds text-xb-text"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="min-w-0 truncate text-[12px] font-black uppercase tracking-wide text-xb-text">
          Winner details
        </h1>
        <Link
          to="/winner-ticket/$winnerId"
          params={{ winnerId }}
          className="flex shrink-0 items-center gap-1 rounded-full bg-xb-blue px-2.5 py-1 text-[10px] font-bold text-xb-on-dark"
        >
          <Ticket className="h-3 w-3" />
          Ticket
        </Link>
      </div>

      {!ready ? (
        <p className="px-3 py-10 text-center text-[12px] text-xb-text-muted">Loading winner…</p>
      ) : !featured ? (
        <p className="px-3 py-10 text-center text-[12px] text-xb-text-muted">
          This winner is no longer published.
        </p>
      ) : (
        <div className="flex flex-col gap-2 p-2">
          <WinnerDetailsSection featured={featured} />
          {/* Mobile only — the winning ticket right under the winner's talk */}
          <div
            id="ticket-print"
            className="flex flex-col overflow-hidden rounded-xl bg-xb-panel shadow-sm md:hidden"
          >
            <WinnerTicketSection featured={featured} />
          </div>
        </div>
      )}
    </PageShell>
  );
}

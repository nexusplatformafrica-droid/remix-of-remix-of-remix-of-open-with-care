import { createFileRoute } from "@tanstack/react-router";
import { Handshake, Store, Megaphone, Code2, Coins } from "lucide-react";
import { PageShell } from "@/components/xbet/PageShell";

export const Route = createFileRoute("/partnership")({
  head: () => ({
    meta: [
      { title: "Partnership & Branch Opportunities — BET PLUS+" },
      {
        name: "description",
        content:
          "Partner with BET PLUS+ Uganda: affiliate revenue share, shop and branch creation, advertising, payment integrations and API partnerships.",
      },
      { property: "og:title", content: "Partnership & Branch Opportunities — BET PLUS+" },
      {
        property: "og:description",
        content: "Affiliates, branch owners, advertisers and tech partners — how to work with us.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PartnershipPage,
});

const TRACKS = [
  {
    icon: Coins,
    title: "Affiliate revenue share",
    body: "Send traffic and earn 25–40% of net revenue for life, or a CPA of UGX 25,000 per depositing player. Real-time dashboard, monthly mobile money payouts.",
    contact: "partners@betplus.ug",
  },
  {
    icon: Store,
    title: "Branch / shop creation",
    body: "Open a licensed BET PLUS+ shop in your area. We supply terminals, printers, signage, staff training and float support; you supply premises and a starting float from UGX 3,000,000. Commission 8–12% of shop turnover.",
    contact: "branches@betplus.ug",
  },
  {
    icon: Megaphone,
    title: "Advertising & sponsorship",
    body: "Sponsor a league, a jackpot or an Aviator night. Includes on-platform placement, shop screen rotation and social campaigns with reporting.",
    contact: "sales@betplus.ug",
  },
  {
    icon: Code2,
    title: "Technology & payments",
    body: "Odds feeds, aggregator content, mobile money and card rails, KYC and fraud tooling. We integrate over REST with sandbox keys in 48 hours.",
    contact: "dev@betplus.ug",
  },
];

function PartnershipPage() {
  return (
    <PageShell title="Partnership" subtitle="Grow with BET PLUS+ across Uganda and East Africa.">
      <div className="space-y-3">
        <section className="rounded-2xl bg-xb-panel p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Handshake className="h-5 w-5 shrink-0 text-xb-blue" />
            <h2 className="min-w-0 text-base font-black text-xb-text">How partnerships work</h2>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-xb-text-muted">
            Tell us which track fits you, send a short proposal with your location, audience or
            technical scope, and our partnerships team replies in 3–5 working days with terms, a
            contract draft and a launch timeline. All partners operate under our Ugandan gaming
            licence and must be 18+ with a registered business or national ID.
          </p>
        </section>

        <div className="grid gap-3 sm:grid-cols-2">
          {TRACKS.map((t) => (
            <section key={t.title} className="rounded-2xl bg-xb-panel p-4 shadow-sm">
              <t.icon className="h-5 w-5 text-xb-blue" />
              <h3 className="mt-2 text-sm font-bold text-xb-text">{t.title}</h3>
              <p className="mt-1 text-[12px] leading-relaxed text-xb-text-muted">{t.body}</p>
              <p className="mt-2 text-[12px] font-bold text-xb-green-dark">{t.contact}</p>
            </section>
          ))}
        </div>

        <section className="rounded-2xl bg-xb-panel p-4 text-[12px] text-xb-text-muted shadow-sm">
          Prefer to talk first? Call the partnerships desk on +256 705 662 411 (Mon–Sat, 9:00–19:00
          EAT) or use the live support chat on the contact page and ask for partnerships.
        </section>
      </div>
    </PageShell>
  );
}
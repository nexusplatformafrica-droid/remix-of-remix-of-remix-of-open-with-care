import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, Clock, Ban, HeartHandshake } from "lucide-react";
import { PageShell } from "@/components/xbet/PageShell";

export const Route = createFileRoute("/responsible-gaming")({
  head: () => ({
    meta: [
      { title: "Responsible Gaming — Limits & Support | BET PLUS+" },
      {
        name: "description",
        content:
          "BET PLUS+ responsible gaming tools: deposit limits, time-outs, self-exclusion, 18+ policy and where to get free help in Uganda.",
      },
      { property: "og:title", content: "Responsible Gaming at BET PLUS+" },
      { property: "og:description", content: "Set limits, take a break, or close your account — plus support contacts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResponsibleGamingPage,
});

const TOOLS = [
  { icon: Clock, title: "Deposit & time limits", body: "Ask support to cap your daily, weekly or monthly deposits, or set a session reminder every 30 minutes." },
  { icon: Ban, title: "Self-exclusion", body: "Block your account for 7 days, 1 month, 6 months or permanently. Exclusions cannot be reversed early." },
  { icon: ShieldCheck, title: "Strict 18+", body: "Accounts are age-verified. Any account found to belong to a minor is closed and stakes are refunded." },
  { icon: HeartHandshake, title: "Free help", body: "Talk to our trained agents on +256 700 123 456 or email care@betplus.ug for a referral to free counselling in Kampala." },
];

function ResponsibleGamingPage() {
  return (
    <PageShell title="Responsible gaming" subtitle="Betting is entertainment, never a source of income.">
      <div className="space-y-3">
        <section className="rounded-2xl bg-xb-panel p-4 shadow-sm">
          <p className="text-[13px] leading-relaxed text-xb-text-muted">
            Only stake money you can comfortably lose, never chase losses, and never borrow to bet.
            If betting is affecting your sleep, work, money or relationships, use the tools below —
            our team will apply them the same day, no questions asked.
          </p>
        </section>
        <div className="grid gap-3 sm:grid-cols-2">
          {TOOLS.map((t) => (
            <section key={t.title} className="rounded-2xl bg-xb-panel p-4 shadow-sm">
              <t.icon className="h-5 w-5 text-xb-blue" />
              <h2 className="mt-2 text-sm font-bold text-xb-text">{t.title}</h2>
              <p className="mt-1 text-[12px] leading-relaxed text-xb-text-muted">{t.body}</p>
            </section>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
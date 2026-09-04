import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/xbet/PageShell";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — Deposits, Withdrawals & Betting Help | BET PLUS+" },
      {
        name: "description",
        content:
          "Answers to common BET PLUS+ questions: how to deposit and withdraw with mobile money, verify your account, place multibets and claim bonuses.",
      },
      { property: "og:title", content: "FAQ — BET PLUS+ Help Centre" },
      { property: "og:description", content: "Deposits, withdrawals, verification, bonuses and bet settlement explained." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FaqPage,
});

const QA = [
  ["How do I deposit?", "Open the account menu, choose Deposit, pick MTN MoMo or Airtel Money, enter the amount and approve the prompt on your phone. Funds land in seconds."],
  ["How long do withdrawals take?", "Mobile money withdrawals are processed 24/7 and normally arrive within 2–10 minutes. Bank transfers take up to one working day."],
  ["Why must I verify my account?", "Ugandan gaming rules require us to confirm you are 18+ and the account owner. Upload a national ID or passport once and it applies to all future payouts."],
  ["How is a multibet calculated?", "All selection odds are multiplied together, then multiplied by your stake. Winning slips with 15+ legs also receive a win bonus of up to 200%."],
  ["What happens if a match is postponed?", "The affected leg is voided at odds 1.00 and the rest of the slip settles normally."],
  ["How do bonuses work?", "Bonus funds must be wagered three times on odds of 1.50 or higher within 7 days. Track progress in the bonus dropdown in the header."],
  ["Can I bet in a shop?", "Yes. Any BET PLUS+ shop can scan the barcode on a ticket PDF to view and pay out a winning slip."],
];

function FaqPage() {
  return (
    <PageShell title="Frequently asked questions" subtitle="Short answers to the questions our agents hear most.">
      <div className="grid gap-3 sm:grid-cols-2">
        {QA.map(([q, a]) => (
          <section key={q} className="rounded-2xl bg-xb-panel p-4 shadow-sm">
            <h2 className="text-sm font-bold text-xb-text">{q}</h2>
            <p className="mt-1 text-[12px] leading-relaxed text-xb-text-muted">{a}</p>
          </section>
        ))}
      </div>
    </PageShell>
  );
}
import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/xbet/PageShell";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — BET PLUS+ Uganda" },
      {
        name: "description",
        content:
          "The rules of betting with BET PLUS+: account eligibility, stakes and payouts, bonus terms, void bets, disputes and shop ticket redemption.",
      },
      { property: "og:title", content: "Terms & Conditions — BET PLUS+" },
      { property: "og:description", content: "Account, betting, bonus and payout rules in plain language." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TermsPage,
});

const SECTIONS = [
  ["1. Eligibility", "You must be 18 or older, resident in Uganda and the sole owner of the account. One account per person and per phone number."],
  ["2. Stakes and payouts", "Minimum stake is UGX 500. Maximum payout per slip is UGX 200,000,000. Winnings are credited automatically once every leg is settled."],
  ["3. Void bets", "Bets on postponed, abandoned or incorrectly priced events are voided at odds 1.00. Obvious pricing errors may be corrected before settlement."],
  ["4. Bonuses", "Bonus funds carry x3 wagering on odds of 1.50 or higher and expire after 7 days. Abuse of promotions leads to forfeiture."],
  ["5. Shop tickets", "A printed or PDF ticket with a valid barcode may be redeemed at any BET PLUS+ shop within 90 days of settlement, on presentation of ID."],
  ["6. Disputes", "Contact customer care first. Unresolved disputes are escalated to the Uganda gaming regulator, whose decision is final."],
];

function TermsPage() {
  return (
    <PageShell title="Terms & conditions" subtitle="Last updated August 2026.">
      <div className="space-y-3">
        {SECTIONS.map(([t, b]) => (
          <section key={t} className="rounded-2xl bg-xb-panel p-4 shadow-sm">
            <h2 className="text-sm font-bold text-xb-text">{t}</h2>
            <p className="mt-1 text-[12px] leading-relaxed text-xb-text-muted">{b}</p>
          </section>
        ))}
      </div>
    </PageShell>
  );
}
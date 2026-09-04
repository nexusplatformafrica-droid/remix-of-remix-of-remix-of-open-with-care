import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/xbet/PageShell";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — How BET PLUS+ Handles Your Data" },
      {
        name: "description",
        content:
          "What personal data BET PLUS+ collects, why we need it for verification and payouts, how long we keep it and how to request deletion.",
      },
      { property: "og:title", content: "Privacy Policy — BET PLUS+" },
      { property: "og:description", content: "Data we collect, how it is used, and your rights." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PrivacyPage,
});

const SECTIONS = [
  ["What we collect", "Your name, phone number, email, date of birth, ID document, device information and full betting and payment history."],
  ["Why we collect it", "To verify you are 18+, process mobile money payouts, prevent fraud and money laundering, and meet gaming licence reporting duties."],
  ["Who we share it with", "Payment providers, our KYC partner and the gaming regulator when legally required. We never sell your data to advertisers."],
  ["How long we keep it", "Account and transaction records are retained for seven years after closure, as required by Ugandan law."],
  ["Your rights", "Request a copy of your data, correct wrong details, or ask for deletion of anything we are not legally obliged to keep by emailing privacy@betplus.ug."],
  ["Cookies", "We use essential cookies for login and fraud checks, plus optional analytics cookies you can decline without losing functionality."],
];

function PrivacyPage() {
  return (
    <PageShell title="Privacy policy" subtitle="Last updated August 2026.">
      <div className="grid gap-3 sm:grid-cols-2">
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
import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Zap, Globe2, HeartHandshake, ArrowRight } from "lucide-react";
import { PageShell } from "@/components/xbet/PageShell";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About BET PLUS+ — Licensed Betting in Uganda" },
      {
        name: "description",
        content:
          "BET PLUS+ offers licensed sports betting, virtuals, Aviator and casino games in Uganda with fast mobile money payouts and 24/7 support.",
      },
      { property: "og:title", content: "About BET PLUS+ — Licensed Betting in Uganda" },
      {
        property: "og:description",
        content: "Who we are, how we pay out fast, and our commitment to responsible gaming.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AboutPage,
});

const values = [
  { icon: Zap, title: "Fast payouts", body: "Mobile money withdrawals processed in minutes, 24/7." },
  { icon: ShieldCheck, title: "Licensed & secure", body: "Operating under Ugandan gaming regulation with encrypted accounts." },
  { icon: Globe2, title: "Global coverage", body: "Thousands of events weekly across football, basketball, tennis and more." },
  { icon: HeartHandshake, title: "Responsible gaming", body: "Deposit limits, self-exclusion and support for players who need a break." },
];

function AboutPage() {
  return (
    <PageShell title="About us" subtitle="Uganda's home for sports betting, virtuals and casino games.">
      <div className="space-y-3">
        <section className="rounded-2xl bg-xb-panel p-4 shadow-sm md:p-5">
          <h2 className="text-lg font-black text-xb-text">Who we are</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-xb-text-muted md:text-sm">
            BET PLUS+ is a Ugandan betting brand built for punters who want sharp odds, real live
            data and payouts that actually arrive on time. We cover the Premier League, UEFA
            competitions, NBA, Grand Slam tennis and hundreds of smaller leagues, alongside
            virtuals, Aviator and slot games for when the fixtures are quiet.
          </p>
        </section>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {values.map((v) => (
            <section key={v.title} className="rounded-xl bg-xb-panel p-4 shadow-sm">
              <v.icon className="h-5 w-5 text-xb-blue" />
              <h3 className="mt-2 text-sm font-bold text-xb-text">{v.title}</h3>
              <p className="mt-1 text-xs text-xb-text-muted">{v.body}</p>
            </section>
          ))}
        </div>

        <section className="rounded-2xl bg-xb-panel p-4 shadow-sm md:p-5">
          <h2 className="text-lg font-black text-xb-text">Explore</h2>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {[
              { to: "/faq", label: "FAQ", body: "Deposits, withdrawals, verification and bet rules." },
              { to: "/partnership", label: "Partnership", body: "Affiliates, branches, advertising and tech deals." },
              { to: "/responsible-gaming", label: "Responsible gaming", body: "Limits, time-outs, self-exclusion and support." },
              { to: "/terms", label: "Terms & conditions", body: "Account, betting, bonus and payout rules." },
              { to: "/privacy", label: "Privacy policy", body: "What we collect and your data rights." },
              { to: "/contact", label: "Contact & live chat", body: "Care, sales, development and office details." },
            ].map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="group rounded-xl bg-xb-odds p-3 transition-colors hover:bg-xb-odds-hover"
              >
                <div className="flex items-center gap-1.5">
                  <span className="min-w-0 truncate text-[13px] font-bold text-xb-text">{l.label}</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-xb-blue transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="mt-0.5 text-[11.5px] text-xb-text-muted">{l.body}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-xb-panel p-4 shadow-sm md:p-5">
          <h2 className="text-lg font-black text-xb-text">Responsible gaming</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-xb-text-muted md:text-sm">
            Betting is entertainment, not income. You must be 18 or older to hold an account. If
            gambling stops being fun, contact our support team to set deposit limits or close your
            account temporarily.
          </p>
        </section>
      </div>
    </PageShell>
  );
}

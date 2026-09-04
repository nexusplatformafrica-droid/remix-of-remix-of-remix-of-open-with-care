import { useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Mail,
  MessageCircle,
  Phone,
  MapPin,
  Headphones,
  Code2,
  Store,
  Handshake,
  Send,
  Clock,
} from "lucide-react";
import { PageShell } from "@/components/xbet/PageShell";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact BET PLUS+ Support — 24/7 Help" },
      {
        name: "description",
        content:
          "Reach BET PLUS+ support 24/7 by phone, WhatsApp, email or the contact form for deposits, withdrawals, verification and betting questions.",
      },
      { property: "og:title", content: "Contact BET PLUS+ Support — 24/7 Help" },
      {
        property: "og:description",
        content: "Phone, WhatsApp, email and a contact form — our team replies within an hour.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ContactPage,
});

const channels = [
  { icon: Phone, label: "Call us", value: "0795592662" },
  { icon: MessageCircle, label: "WhatsApp", value: "0795592662" },
  { icon: Mail, label: "Email", value: "betplusafrica@gmail.com" },
  { icon: MapPin, label: "Office", value: "Plot 12, Kampala Road, Kampala" },
];

const DEPARTMENTS = [
  {
    key: "care",
    icon: Headphones,
    title: "Customer care",
    blurb:
      "Deposits, withdrawals, account verification, bet settlement and bonus questions. Our agents are online 24/7 and answer in English and Luganda.",
    lines: ["Phone: 0795592662", "WhatsApp: 0795592662", "betplusafrica@gmail.com"],
    hours: "24/7 · first reply ~12 min",
  },
  {
    key: "dev",
    icon: Code2,
    title: "For development",
    blurb:
      "API access, odds feeds, affiliate widgets, white-label integrations and bug reports. Send your use case and we return API keys and docs within two working days.",
    lines: ["betplusafrica@gmail.com", "Phone: 0795592662", "GitHub: betplus-ug"],
    hours: "Mon–Fri, 8:00–18:00 EAT",
  },
  {
    key: "sales",
    icon: Store,
    title: "For sale / advertising",
    blurb:
      "Buy shop equipment, betting terminals, printers and branded materials, or book advertising space on our platform and shop screens.",
    lines: ["betplusafrica@gmail.com", "Phone: 0795592662"],
    hours: "Mon–Sat, 9:00–19:00 EAT",
  },
  {
    key: "branch",
    icon: MapPin,
    title: "Branch creation in your area",
    blurb:
      "Open a BET PLUS+ shop in your town. We provide the licence cover, terminals, float support, staff training and marketing. You provide the premises and a starting float from UGX 3,000,000.",
    lines: ["betplusafrica@gmail.com", "Phone: 0795592662"],
    hours: "Site visit within 7 days of application",
  },
  {
    key: "partner",
    icon: Handshake,
    title: "Partnership",
    blurb:
      "Affiliates, payment providers, sponsorships, content creators and data suppliers. Revenue-share and CPA deals available with monthly payouts.",
    lines: ["betplusafrica@gmail.com", "Phone: 0795592662"],
    hours: "Proposal review in 3–5 days",
  },
  {
    key: "office",
    icon: MapPin,
    title: "Head office",
    blurb:
      "Walk in for verification, complaints, large payouts and contract signing. Bring a national ID or passport.",
    lines: ["Plot 12, Kampala Road, Kampala", "betplusafrica@gmail.com", "Phone: 0795592662"],
    hours: "Mon–Sat, 8:00–20:00 EAT",
  },
] as const;

type ChatMsg = { id: number; from: "you" | "agent"; text: string };

function LiveChat() {
  const [msgs, setMsgs] = useState<ChatMsg[]>([
    { id: 1, from: "agent", text: "Hi! You're chatting with Brenda from BET PLUS+ support. How can I help?" },
  ]);
  const [text, setText] = useState("");
  const nextId = useRef(2);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    const id = nextId.current++;
    setMsgs((m) => [...m, { id, from: "you", text: t }]);
    setText("");
    setTimeout(() => {
      setMsgs((m) => [
        ...m,
        {
          id: nextId.current++,
          from: "agent",
          text: "Thanks — an agent is reviewing your message and will reply here shortly. For urgent payouts call 0795592662.",
        },
      ]);
    }, 900);
  };

  return (
    <div className="flex min-h-0 flex-col rounded-2xl bg-xb-panel p-3 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-xb-green" />
        <h2 className="text-sm font-black text-xb-text">Live support chat</h2>
        <span className="ml-auto text-[10px] text-xb-text-muted">Agents online</span>
      </div>
      <div className="mt-2 max-h-[230px] flex-1 space-y-1.5 overflow-y-auto pr-1">
        {msgs.map((m) => (
          <div
            key={m.id}
            className={`max-w-[85%] rounded-xl px-3 py-2 text-[12px] ${
              m.from === "you"
                ? "ml-auto bg-xb-blue text-xb-on-dark"
                : "bg-xb-odds text-xb-text"
            }`}
          >
            {m.text}
          </div>
        ))}
      </div>
      <form onSubmit={send} className="mt-2 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type your message…"
          className="min-w-0 flex-1 rounded-lg border border-xb-line bg-xb-panel-alt px-3 py-2 text-[12px] text-xb-text outline-none focus:border-xb-blue"
        />
        <button className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-xb-green text-xb-on-dark hover:bg-xb-green-dark">
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

function ContactPage() {
  const [form, setForm] = useState({ name: "", contact: "", topic: "Deposits", message: "" });
  const [sent, setSent] = useState(false);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.name.trim().length < 2) {
      toast.error("Please enter your name.");
      return;
    }
    if (!/^[+\d][\d\s]{6,}$|^\S+@\S+\.\S+$/.test(form.contact.trim())) {
      toast.error("Enter a valid phone number or email.");
      return;
    }
    if (form.message.trim().length < 10) {
      toast.error("Please describe your issue (at least 10 characters).");
      return;
    }
    setSent(true);
    toast.success("Message sent — our support team will reply shortly.");
    setForm({ name: "", contact: "", topic: "Deposits", message: "" });
  };

  return (
    <PageShell title="Contact us" subtitle="Support is available 24/7, every day of the year.">
      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-3 lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {DEPARTMENTS.map((d) => (
              <section key={d.key} className="rounded-2xl bg-xb-panel p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <d.icon className="h-4 w-4 shrink-0 text-xb-blue" />
                  <h2 className="min-w-0 truncate text-sm font-black text-xb-text">{d.title}</h2>
                </div>
                <p className="mt-1.5 text-[12px] leading-relaxed text-xb-text-muted">{d.blurb}</p>
                <ul className="mt-2 space-y-0.5">
                  {d.lines.map((l) => (
                    <li key={l} className="text-[12px] font-bold text-xb-text">
                      {l}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 flex items-center gap-1 text-[10.5px] text-xb-text-muted">
                  <Clock className="h-3 w-3" /> {d.hours}
                </p>
              </section>
            ))}
          </div>
          <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
            <LiveChat />
            <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-xb-panel p-3 text-[12px] shadow-sm">
              <span className="text-xb-text-muted">More information:</span>
              {[
                { to: "/partnership", label: "Partnership" },
                { to: "/faq", label: "FAQ" },
                { to: "/responsible-gaming", label: "Responsible gaming" },
                { to: "/terms", label: "Terms" },
                { to: "/privacy", label: "Privacy" },
              ].map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  className="rounded-full bg-xb-odds px-3 py-1 font-bold text-xb-text hover:bg-xb-odds-hover"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3 rounded-2xl bg-xb-panel p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-bold text-xb-text-muted">
              Full name
              <input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                className="mt-1 w-full rounded-lg border border-xb-line bg-xb-panel-alt px-3 py-2 text-sm text-xb-text outline-none focus:border-xb-blue"
                placeholder="Jane Nakato"
              />
            </label>
            <label className="block text-xs font-bold text-xb-text-muted">
              Phone or email
              <input
                value={form.contact}
                onChange={(e) => set("contact", e.target.value)}
                className="mt-1 w-full rounded-lg border border-xb-line bg-xb-panel-alt px-3 py-2 text-sm text-xb-text outline-none focus:border-xb-blue"
                placeholder="+256 7xx xxx xxx"
              />
            </label>
          </div>
          <label className="block text-xs font-bold text-xb-text-muted">
            Topic
            <select
              value={form.topic}
              onChange={(e) => set("topic", e.target.value)}
              className="mt-1 w-full rounded-lg border border-xb-line bg-xb-panel-alt px-3 py-2 text-sm text-xb-text outline-none focus:border-xb-blue"
            >
              {["Deposits", "Withdrawals", "Account verification", "Bet settlement", "Other"].map(
                (t) => (
                  <option key={t}>{t}</option>
                ),
              )}
            </select>
          </label>
          <label className="block text-xs font-bold text-xb-text-muted">
            Message
            <textarea
              value={form.message}
              onChange={(e) => set("message", e.target.value)}
              rows={6}
              className="mt-1 w-full rounded-lg border border-xb-line bg-xb-panel-alt px-3 py-2 text-sm text-xb-text outline-none focus:border-xb-blue"
              placeholder="Tell us what happened…"
            />
          </label>
          <button className="rounded-lg bg-xb-green px-6 py-2.5 text-sm font-black text-xb-on-dark hover:bg-xb-green-dark">
            SEND MESSAGE
          </button>
          {sent && (
            <p className="text-xs text-xb-green">
              Ticket created. Average first reply time: 12 minutes.
            </p>
          )}
        </form>

        <div className="space-y-3">
          {channels.map((c) => (
            <div key={c.label} className="flex items-center gap-3 rounded-xl bg-xb-panel p-3 shadow-sm">
              <c.icon className="h-5 w-5 text-xb-blue" />
              <div>
                <p className="text-xs text-xb-text-muted">{c.label}</p>
                <p className="text-sm font-bold text-xb-text">{c.value}</p>
              </div>
            </div>
          ))}
          <div className="rounded-xl bg-xb-panel p-3 text-xs text-xb-text-muted shadow-sm">
            For account-specific issues, include your registered phone number so we can verify you
            faster. Never share your password with anyone — our agents will never ask for it.
          </div>
        </div>
      </div>
    </PageShell>
  );
}

import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronDown,
  ListChecks,
  Lock,
  LockOpen,
  LogOut,
  Receipt,
  Settings,
  Ticket,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import { money, useAuth } from "./AuthContext";
import { betToTicket } from "@/lib/bet-ticket";
import { openTicketPdf } from "@/lib/ticket-pdf";
import {
  DEFAULT_COUNTRY,
  PAY_COUNTRIES,
  countryByCode,
  countryByCurrency,
  countryByName,
  countryFromPhone,
  formatMoney,
  limitsFor,
  methodsFor,
  toMsisdn,
} from "@/lib/payments";

const SECTIONS = [
  { key: "bets", label: "My bets", icon: Ticket },
  { key: "deposit", label: "Deposit", icon: ArrowDownToLine },
  { key: "withdraw", label: "Withdraw", icon: ArrowUpFromLine },
  { key: "transactions", label: "Transactions", icon: Receipt },
  { key: "account", label: "Account", icon: UserIcon },
  { key: "settings", label: "Settings", icon: Settings },
] as const;

export type SectionKey = (typeof SECTIONS)[number]["key"];

const METHODS = ["MTN MoMo", "Airtel Money", "Visa / Mastercard", "Bank transfer"];

const inputCls =
  "w-full rounded-xl border border-xb-line bg-xb-panel-alt px-3 py-2 text-[13px] text-xb-text outline-none focus:border-xb-blue placeholder:text-xb-text-muted";

function Empty({ text }: { text: string }) {
  return (
    <div className="flex h-[130px] items-center justify-center rounded-xl border border-dashed border-xb-line px-4 text-center text-[12px] text-xb-text-muted">
      {text}
    </div>
  );
}

function MoneyForm({ kind }: { kind: "deposit" | "withdraw" }) {
  const { deposit, withdraw, balance, withdrawable, bonus, currency, user } = useAuth();
  const home =
    countryByName(user?.country) ??
    countryByCurrency(currency) ??
    countryFromPhone(user?.phone ?? "") ??
    DEFAULT_COUNTRY;
  // The player picks the market they are paying from, so mobile money works in
  // every supported country — not just their profile country.
  const [countryCode, setCountryCode] = useState(home.code);
  const country = countryByCode(countryCode) ?? home;
  const payCurrencies = [
    country.currency,
    ...(country.altCurrency ? [country.altCurrency.currency] : []),
  ];
  const [payCurrency, setPayCurrency] = useState(country.currency);
  const activeCurrency = payCurrencies.includes(payCurrency) ? payCurrency : country.currency;
  const methods = methodsFor(country, kind);
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [method, setMethod] = useState(methods[0]!.id);
  const [busy, setBusy] = useState(false);

  const active = methods.find((m) => m.id === method) ?? methods[0]!;
  const limits = limitsFor(country, active, activeCurrency, kind);

  const pickCountry = (code: string) => {
    const next = countryByCode(code) ?? home;
    setCountryCode(next.code);
    setPayCurrency(next.currency);
    setMethod(methodsFor(next, kind)[0]!.id);
    setAmount("");
  };

  const submit = async () => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (n < limits.min || n > limits.max) {
      toast.error(
        `Amount must be between ${formatMoney(limits.min, activeCurrency)} and ${formatMoney(limits.max, activeCurrency)}`,
      );
      return;
    }
    const msisdn = active.type === "mobile" ? toMsisdn(phone, country) : "";
    if (active.type === "mobile" && msisdn.replace(/\D/g, "").length < 11) {
      toast.error("Enter a valid mobile money number");
      return;
    }
    setBusy(true);
    try {
      const run = kind === "deposit" ? deposit : withdraw;
      await run({ amount: n, method: active.id, msisdn, currency: activeCurrency });
      toast.success(
        kind === "deposit"
          ? "Approve the prompt on your phone"
          : `Withdrawal of ${formatMoney(n, activeCurrency)} sent for processing`,
        { description: `${active.label} · ${country.flag} ${country.name}` },
      );
      setAmount("");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="space-y-1 rounded-xl bg-xb-odds px-3 py-2 text-[12px] text-xb-text">
        <div className="flex items-center justify-between">
          <span>{kind === "withdraw" ? "Withdrawable cash" : "Available balance"}</span>
          <span className="font-bold">
            {formatMoney(kind === "withdraw" ? withdrawable : balance, currency)}
          </span>
        </div>
        {bonus > 0 && (
          <div className="flex items-center justify-between text-[11px] text-xb-text-muted">
            <span>Bonus (bets only)</span>
            <span className="font-bold">{formatMoney(bonus, currency)}</span>
          </div>
        )}
        <div className="flex items-center justify-between text-[11px] text-xb-text-muted">
          <span>
            {country.flag} {country.name}
          </span>
          <span>
            Min {formatMoney(limits.min, activeCurrency)} ·{" "}
            {kind === "withdraw" ? "No maximum" : `Max ${formatMoney(limits.max, activeCurrency)}`}
          </span>
        </div>
      </div>
      <div
        className={`grid gap-2 ${payCurrencies.length > 1 ? "grid-cols-[minmax(0,1fr)_auto]" : "grid-cols-1"}`}
      >
        <select
          value={country.code}
          onChange={(e) => pickCountry(e.target.value)}
          aria-label="Payment country"
          className={inputCls}
        >
          {PAY_COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag} {c.name}
            </option>
          ))}
        </select>
        {payCurrencies.length > 1 && (
          <select
            value={activeCurrency}
            onChange={(e) => setPayCurrency(e.target.value)}
            aria-label="Payment currency"
            className={`${inputCls} w-auto`}
          >
            {payCurrencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {methods.map((m) => (
          <button
            key={m.id}
            onClick={() => setMethod(m.id)}
            className={`rounded-xl px-2 py-2 text-[11.5px] font-medium transition-colors ${
              method === m.id
                ? "bg-xb-blue text-xb-on-dark"
                : "bg-xb-odds text-xb-text hover:bg-xb-odds-hover"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      {active.type === "mobile" && (
        <div className="flex items-center gap-2 rounded-xl border border-xb-line bg-xb-panel-alt px-3 py-2">
          <span className="shrink-0 text-[13px] text-xb-text">
            {country.flag} {country.dial}
          </span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, ""))}
            inputMode="tel"
            placeholder="Mobile money number"
            className="w-full bg-transparent text-[13px] text-xb-text outline-none placeholder:text-xb-text-muted"
          />
        </div>
      )}
      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
        inputMode="decimal"
        placeholder={`Amount in ${activeCurrency}`}
        className={inputCls}
      />
      <div className="flex gap-1">
        {[
          limits.min,
          Math.min(limits.max, limits.min * 10),
          Math.min(limits.max, limits.min * 100),
        ].map((v, i) => (
          <button
            key={`${v}-${i}`}
            onClick={() => setAmount(String(v))}
            className="flex-1 rounded-lg bg-xb-odds py-1.5 text-[11px] text-xb-text hover:bg-xb-odds-hover"
          >
            {formatMoney(v, activeCurrency)}
          </button>
        ))}
      </div>
      <button
        onClick={submit}
        disabled={busy}
        className="w-full rounded-xl bg-xb-green py-2.5 text-[13px] font-bold text-xb-on-dark transition-colors hover:bg-xb-green-dark disabled:opacity-60"
      >
        {busy ? "PROCESSING…" : kind === "deposit" ? "DEPOSIT" : "WITHDRAW"}
      </button>
    </div>
  );
}

export function SectionBody({ section }: { section: SectionKey }) {
  const { bets, rawBets, transactions, user, balance, currency, logout, deleteBet } = useAuth();
  const [prefs, setPrefs] = useState({ odds: true, emails: false, dark: false });

  if (section === "bets") {
    const openTicket = (id: string) => {
      const raw = rawBets.find((b) => b.id === id);
      if (!raw) return;
      void betToTicket(raw, {
        name: user?.label ?? "Player",
        origin: typeof window === "undefined" ? "" : window.location.origin,
      }).then(openTicketPdf);
    };

    return bets.length === 0 ? (
      <Empty text="You have no placed bets yet. Add events to your bet slip to get started." />
    ) : (
      <div className="max-h-[220px] space-y-1.5 overflow-y-auto pr-1">
        {bets.map((b) => (
          <div
            key={b.id}
            className={`rounded-xl px-3 py-2 text-[12px] text-xb-text ${
              b.status === "lost" ? "bg-xb-red/10 ring-1 ring-xb-red/40" : "bg-xb-odds"
            }`}
          >
            <button
              type="button"
              onClick={() => openTicket(b.id)}
              title="Open ticket preview"
              className="w-full text-left"
            >
              <div className="flex justify-between">
                <span className="flex items-center gap-1">
                  <ListChecks className="h-3.5 w-3.5 text-xb-blue" /> {b.events} event(s)
                </span>
                <span className="font-bold text-xb-blue">{b.odds.toFixed(2)}</span>
              </div>
              <div className="mt-0.5 flex justify-between text-[11px] text-xb-text-muted">
                <span>Stake {money(b.stake)}</span>
                <span>Possible win {money(b.stake * b.odds)}</span>
              </div>
            </button>
            <div className="mt-1 flex items-center justify-between">
              <span
                className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide ${
                  b.status === "won"
                    ? "text-xb-green"
                    : b.status === "lost"
                      ? "text-xb-red"
                      : "text-xb-text-muted"
                }`}
              >
                <span
                  className={`h-2.5 w-2.5 rounded-sm ${
                    b.status === "won"
                      ? "bg-xb-green"
                      : b.status === "lost"
                        ? "bg-xb-red"
                        : "bg-xb-text-muted"
                  }`}
                />
                {b.status === "open" ? "pending" : b.status}
              </span>
              <span className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openTicket(b.id)}
                  className="text-[10px] font-bold text-xb-blue"
                >
                  View ticket
                </button>
                {b.status !== "open" && (
                  <button
                    type="button"
                    title="Remove this ticket"
                    onClick={() => {
                      void deleteBet(b.id)
                        .then(() => toast.success("Ticket removed"))
                        .catch((err: Error) => toast.error(err.message));
                    }}
                    className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-xb-red hover:bg-xb-red/10"
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                )}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (section === "deposit") return <MoneyForm kind="deposit" />;
  if (section === "withdraw") return <MoneyForm kind="withdraw" />;

  if (section === "transactions") {
    return transactions.length === 0 ? (
      <Empty text="No transactions yet. Deposits, withdrawals and bets appear here." />
    ) : (
      <div className="max-h-[220px] divide-y divide-xb-line overflow-y-auto rounded-xl bg-xb-odds px-3">
        {transactions.map((t) => (
          <div key={t.id} className="flex items-center justify-between py-2 text-[12px]">
            <div className="min-w-0">
              <div className="text-xb-text">{t.kind}</div>
              <div className="truncate text-[11px] text-xb-text-muted">
                {new Date(t.at).toLocaleString("en-GB", { hour12: true })} · {t.method}
              </div>
            </div>
            <span
              className={`shrink-0 font-bold ${t.amount < 0 ? "text-xb-red" : "text-xb-green-dark"}`}
            >
              {t.amount < 0 ? "-" : "+"}
              {money(Math.abs(t.amount))}
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (section === "account") {
    return (
      <div className="space-y-2 text-[12px]">
        {(
          [
            ["Account", user?.label ?? ""],
            ["ID", user?.id.toUpperCase() ?? ""],
            ["Phone", user?.phone || "—"],
            ["Email", user?.email || "—"],
            ["Country", user?.country ?? ""],
            ["Currency", user?.currency ?? ""],
            ["Balance", formatMoney(balance, currency)],
          ] as const
        ).map(([k, v]) => (
          <div key={k} className="flex justify-between rounded-lg bg-xb-odds px-3 py-2">
            <span className="text-xb-text-muted">{k}</span>
            <span className="font-medium text-xb-text">{v}</span>
          </div>
        ))}
        <button
          onClick={() => {
            logout();
            toast("Logged out");
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-xb-odds py-2.5 text-[12px] font-bold text-xb-red hover:bg-xb-odds-hover"
        >
          <LogOut className="h-3.5 w-3.5" /> Log out
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2 text-[12px]">
      {(
        [
          ["odds", "Accept odds changes automatically"],
          ["emails", "Email me promotions and bonuses"],
          ["dark", "Compact event list"],
        ] as const
      ).map(([key, label]) => (
        <button
          key={key}
          onClick={() => setPrefs((p) => ({ ...p, [key]: !p[key] }))}
          className="flex w-full items-center justify-between rounded-xl bg-xb-odds px-3 py-2.5 text-left text-xb-text hover:bg-xb-odds-hover"
        >
          <span>{label}</span>
          <span
            className={`relative h-4 w-8 rounded-full transition-colors ${
              prefs[key] ? "bg-xb-green" : "bg-xb-line"
            }`}
          >
            <span
              className={`absolute top-0.5 h-3 w-3 rounded-full bg-xb-panel transition-all ${
                prefs[key] ? "left-4" : "left-0.5"
              }`}
            />
          </span>
        </button>
      ))}
      <div className="rounded-xl bg-xb-odds px-3 py-2.5 text-[11px] text-xb-text-muted">
        Odds format: Decimal · Language: English · Timezone: Uganda (UTC+3)
      </div>
    </div>
  );
}

/** Hover-opened account panel — everything happens inside the float, no extra pages. */
export function AccountMenu() {
  const { user, openLogin, openRegister, balance, currency } = useAuth();
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<SectionKey>("bets");
  const [locked, setLocked] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(true);
  };
  const hide = () => {
    if (locked) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), 220);
  };

  // When locked the panel stays put; only an outside click or the trigger closes it.
  useEffect(() => {
    if (!locked || !open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [locked, open]);

  return (
    <div className="relative" ref={rootRef} onMouseEnter={show} onMouseLeave={hide}>
      <button
        onClick={() => {
          if (timer.current) clearTimeout(timer.current);
          setOpen((o) => !o);
        }}
        className="flex h-8 items-center gap-1 rounded bg-white/10 px-2 text-xb-on-dark transition-colors hover:bg-white/20"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Settings className="h-[18px] w-[18px]" />
        {locked && <Lock className="h-3 w-3 text-xb-green" />}
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <div
        className={`absolute right-0 top-[calc(100%+8px)] z-40 w-[430px] origin-top-right transition-all duration-150 ${
          open
            ? "pointer-events-auto scale-100 opacity-100"
            : "pointer-events-none scale-95 opacity-0"
        }`}
      >
        <div className="overflow-hidden rounded-2xl bg-xb-panel shadow-2xl ring-1 ring-xb-line">
          <div className="flex items-center justify-between border-b border-xb-line bg-xb-panel-alt px-4 py-2">
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-xb-text-muted">
              {locked ? (
                <Lock className="h-3 w-3 text-xb-green" />
              ) : (
                <LockOpen className="h-3 w-3" />
              )}
              {locked ? "Menu locked open" : "Lock menu open"}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={locked}
              aria-label="Lock menu open"
              onClick={() => {
                setLocked((l) => !l);
                setOpen(true);
              }}
              className={`relative h-4 w-8 shrink-0 rounded-full transition-colors ${
                locked ? "bg-xb-green" : "bg-xb-line"
              }`}
            >
              <span
                className={`absolute top-0.5 h-3 w-3 rounded-full bg-xb-panel transition-all ${
                  locked ? "left-4" : "left-0.5"
                }`}
              />
            </button>
          </div>

          {!user ? (
            <div className="p-5 text-center">
              <p className="text-[13px] font-bold text-xb-text">You are not logged in</p>
              <p className="mt-1 text-[12px] text-xb-text-muted">
                Log in or register to manage bets, deposits and withdrawals.
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={openLogin}
                  className="flex-1 rounded-xl bg-xb-odds py-2.5 text-[12px] font-bold text-xb-text hover:bg-xb-odds-hover"
                >
                  LOG IN
                </button>
                <button
                  onClick={openRegister}
                  className="flex-1 rounded-xl bg-xb-green py-2.5 text-[12px] font-bold text-xb-on-dark hover:bg-xb-green-dark"
                >
                  REGISTER
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 border-b border-xb-line px-4 py-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-xb-blue text-xb-on-dark">
                  <UserIcon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-bold text-xb-text">{user.label}</div>
                  <div className="text-[11px] text-xb-text-muted">
                    ID {user.id.toUpperCase()} · {user.currency}
                  </div>
                </div>
                <div className="ml-auto text-right">
                  <div className="text-[10px] uppercase text-xb-text-muted">Balance</div>
                  <div className="text-[13px] font-bold text-xb-green-dark">
                    {formatMoney(balance, currency)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-[136px_1fr]">
                <nav className="border-r border-xb-line p-2">
                  {SECTIONS.map((s) => (
                    <button
                      key={s.key}
                      onMouseEnter={() => setSection(s.key)}
                      onClick={() => setSection(s.key)}
                      className={`mb-0.5 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[12px] transition-colors ${
                        section === s.key
                          ? "bg-xb-blue text-xb-on-dark"
                          : "text-xb-text-muted hover:bg-xb-odds hover:text-xb-text"
                      }`}
                    >
                      <s.icon className="h-3.5 w-3.5" />
                      {s.label}
                    </button>
                  ))}
                </nav>
                <div className="p-3">
                  <SectionBody section={section} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

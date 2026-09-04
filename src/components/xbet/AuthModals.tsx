import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Gift,
  Lock,
  Phone,
  ShieldCheck,
  Smartphone,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "./AuthContext";
import {
  DEFAULT_COUNTRY,
  PAY_COUNTRIES,
  countryByCode,
  detectCountry,
  toMsisdn,
  type PayCountry,
} from "@/lib/payments";

export const COUNTRIES = PAY_COUNTRIES.map((c) => c.name);
export const CURRENCIES = PAY_COUNTRIES.map((c) => `${c.currencyName} (${c.currency})`);

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-xb-text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-xl border border-xb-line bg-xb-panel-alt px-3 py-2.5 text-[13px] text-xb-text outline-none transition-colors focus:border-xb-blue placeholder:text-xb-text-muted";

export function Flag({ code, className = "" }: { code: string; className?: string }) {
  return (
    <img
      src={`https://flagcdn.com/w40/${code.toLowerCase()}.png`}
      alt=""
      aria-hidden
      loading="lazy"
      className={`h-3.5 w-5 shrink-0 rounded-[2px] object-cover ${className}`}
    />
  );
}

/** Country + dial-code picker with real flag images (emoji flags don't render on Android/Windows). */
function CountryPicker({
  value,
  onChange,
  showName = false,
}: {
  value: PayCountry;
  onChange: (c: PayCountry) => void;
  showName?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Country"
        onClick={() => setOpen((o) => !o)}
        className={`flex h-[42px] items-center gap-1.5 rounded-xl border border-xb-line bg-xb-panel-alt px-2.5 text-[13px] text-xb-text ${
          showName ? "w-full justify-between" : ""
        }`}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <Flag code={value.code} />
          <span className="truncate">{showName ? value.name : value.dial}</span>
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-xb-text-muted" />
      </button>
      {open && (
        <ul className="absolute left-0 z-20 mt-1 max-h-56 w-56 overflow-y-auto rounded-xl border border-xb-line bg-xb-panel py-1 shadow-2xl">
          {PAY_COUNTRIES.map((c) => (
            <li key={c.code}>
              <button
                type="button"
                onClick={() => {
                  onChange(c);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-xb-text hover:bg-xb-odds"
              >
                <Flag code={c.code} />
                <span className="flex-1 truncate">{c.name}</span>
                <span className="text-[12px] text-xb-text-muted">{c.dial}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Shell({
  title,
  subtitle,
  onClose,
  aside,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  aside: React.ReactNode;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/60 p-3 backdrop-blur-sm sm:p-4"
      onClick={onClose}
    >
      <div className="flex min-h-full items-start justify-center py-2 sm:items-center">
        <div
          onClick={(e) => e.stopPropagation()}
          className="grid w-full max-w-3xl overflow-hidden rounded-2xl bg-xb-panel shadow-2xl ring-1 ring-xb-line sm:rounded-3xl md:grid-cols-[0.85fr_1fr]"
        >
          <aside
            className="hidden flex-col justify-between p-6 md:flex"
            style={{ background: "linear-gradient(150deg, #1d4f8c, #0d2b52)" }}
          >
            {aside}
          </aside>

          <section className="relative max-h-[88vh] overflow-y-auto p-5 sm:p-6">
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-xb-odds text-xb-text-muted transition-colors hover:text-xb-text"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <h2 className="pr-10 text-[18px] font-black tracking-tight text-xb-text">{title}</h2>
            <p className="mt-1 pr-10 text-[12px] leading-snug text-xb-text-muted">{subtitle}</p>
            <div className="mt-4 space-y-3">{children}</div>
          </section>
        </div>
      </div>
    </div>
  );
}

function LoginModal() {
  const { login, closeModal, openRegister, busy } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [country, setCountry] = useState<PayCountry>(DEFAULT_COUNTRY);

  // Same IP detection as registration so the dial code matches where you are.
  useEffect(() => {
    let alive = true;
    void detectCountry().then((geo) => {
      if (!alive || !geo) return;
      const match = countryByCode(geo.code);
      if (match) setCountry(match);
    });
    return () => {
      alive = false;
    };
  }, []);

  const submit = async () => {
    if (identifier.trim().length < 4) {
      toast.error("Enter your phone number");
      return;
    }
    if (password.length < 4) {
      toast.error("Enter your password");
      return;
    }
    try {
      const raw = identifier.trim();
      const asPhone = /^[+0-9\s-]+$/.test(raw) ? toMsisdn(raw, country) : raw;
      await login(asPhone, password);
      toast.success("Logged in", { description: `Welcome back, ${identifier.trim()}` });
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <Shell
      title="Log in"
      subtitle="Use the phone number, email or account ID you registered with."
      onClose={closeModal}
      aside={
        <>
          <div>
            <div className="flex items-center gap-2 text-xb-on-dark">
              <ShieldCheck className="h-5 w-5" />
              <span className="text-[15px] font-black">SECURE LOGIN</span>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-xb-on-dark-muted">
              Your bet slip, balance and bonuses stay in sync everywhere you play.
            </p>
          </div>
          <ul className="mt-6 space-y-2 text-[12px] text-xb-on-dark-muted">
            <li>· Instant deposits &amp; withdrawals</li>
            <li>· Live cash-out on selected markets</li>
            <li>· 24/7 support in your language</li>
          </ul>
        </>
      }
    >
      <Field label="Phone number, email or account ID">
        <div className="flex items-stretch gap-2">
          <CountryPicker value={country} onChange={setCountry} />
          <div className="relative min-w-0 flex-1">
            <input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              inputMode="tel"
              autoComplete="username"
              placeholder="700 000 000"
              className={`${inputCls} h-[42px] py-0 pr-9`}
            />
            <Phone className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-xb-text-muted" />
          </div>
        </div>
      </Field>
      <Field label="Password">
        <div className="relative">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="••••••••"
            className={inputCls}
          />
          <Lock className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-xb-text-muted" />
        </div>
      </Field>
      <button
        onClick={() =>
          toast("Password recovery", { description: "We will send you a reset code." })
        }
        className="text-[12px] text-xb-blue underline"
      >
        Forgot your password?
      </button>
      <button
        onClick={submit}
        disabled={busy}
        className="w-full rounded-xl bg-xb-green py-3 text-[13px] font-bold text-xb-on-dark transition-colors hover:bg-xb-green-dark disabled:opacity-60"
      >
        {busy ? "LOGGING IN…" : "LOG IN"}
      </button>
      <p className="text-center text-[12px] text-xb-text-muted">
        New here?{" "}
        <button onClick={openRegister} className="font-bold text-xb-blue underline">
          Create an account
        </button>
      </p>
    </Shell>
  );
}

function RegisterModal() {
  const { register, closeModal, openLogin, busy } = useAuth();
  const [mode, setMode] = useState<"one-click" | "phone">("one-click");
  const [country, setCountry] = useState<PayCountry>(DEFAULT_COUNTRY);
  const [currency, setCurrency] = useState(DEFAULT_COUNTRY.currency);
  const [geoBlocked, setGeoBlocked] = useState(false);
  const [geoName, setGeoName] = useState("");
  const [phone, setPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  const [promo, setPromo] = useState("");
  const [agree, setAgree] = useState(true);

  // Pre-fills the inviter's referral code when arriving from an invite link.
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) setPromo(ref.toUpperCase());
  }, []);

  // Picks the country (and its real currency) from the visitor's IP.
  useEffect(() => {
    let alive = true;
    void detectCountry().then((geo) => {
      if (!alive || !geo) return;
      setGeoName(geo.name || geo.code);
      const match = countryByCode(geo.code);
      if (match) {
        setCountry(match);
        setCurrency(match.currency);
        setGeoBlocked(false);
      } else {
        setGeoBlocked(true);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const submit = async () => {
    if (geoBlocked) {
      toast.error(`BET PLUS is not available in ${geoName || "your country"} yet`);
      return;
    }
    if (phone.replace(/\D/g, "").length < 8) {
      toast.error("Enter a valid phone number");
      return;
    }
    if (regPassword.length < 4) {
      toast.error("Password must be at least 4 characters");
      return;
    }
    if (!agree) {
      toast.error("Please accept the Terms and Conditions");
      return;
    }
    try {
      await register({
        mode,
        country: country.name,
        currency,
        phone: toMsisdn(phone, country),
        email: email.trim(),
        promo,
        password: regPassword,
        name: name.trim(),
      });
      toast.success("Account created!", {
        description: `Deposit to unlock your free bonus · ${country.flag} ${country.name} · ${currency}`,
      });
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <Shell
      title="Registration"
      subtitle="One-click gets you playing instantly — by phone adds full account recovery."
      onClose={closeModal}
      aside={
        <>
          <div>
            <div className="flex items-center gap-2 text-xb-on-dark">
              <Gift className="h-5 w-5" />
              <span className="text-[15px] font-black leading-tight">
                100% BONUS
                <br />
                ON YOUR 1ST DEPOSIT
              </span>
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-xb-on-dark-muted">
              Join thousands of players betting on live football, basketball and tennis with the
              best odds in Uganda.
            </p>
          </div>
          <div className="mt-6 space-y-2 text-[12px] text-xb-on-dark-muted">
            <div className="flex items-center gap-2">
              <Zap className="h-3.5 w-3.5" /> Registration in under 10 seconds
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5" /> Free AI bet slip generator
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5" /> Licensed &amp; secure payments
            </div>
          </div>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setMode("one-click")}
          className={`flex items-center justify-center gap-1 rounded-xl py-2.5 text-[12px] font-bold transition-colors ${
            mode === "one-click" ? "bg-xb-blue text-xb-on-dark" : "bg-xb-odds text-xb-text"
          }`}
        >
          <Zap className="h-3.5 w-3.5" /> One-click
        </button>
        <button
          onClick={() => setMode("phone")}
          className={`flex items-center justify-center gap-1 rounded-xl py-2.5 text-[12px] font-bold transition-colors ${
            mode === "phone" ? "bg-xb-blue text-xb-on-dark" : "bg-xb-odds text-xb-text"
          }`}
        >
          <Smartphone className="h-3.5 w-3.5" /> By phone
        </button>
      </div>

      {geoBlocked && (
        <div className="rounded-xl bg-xb-red/10 px-3 py-2 text-[12px] text-xb-red ring-1 ring-xb-red/30">
          BET PLUS is not available in {geoName} yet. Payments are only supported in{" "}
          {PAY_COUNTRIES.map((c) => c.name).join(", ")}.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Country">
          <CountryPicker
            value={country}
            showName
            onChange={(next) => {
              setCountry(next);
              setCurrency(next.currency);
            }}
          />
        </Field>
        <Field label="Currency">
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className={inputCls}
          >
            <option value={country.currency}>
              {country.currencyName} ({country.currency})
            </option>
            {country.altCurrency && (
              <option value={country.altCurrency.currency}>
                US dollar ({country.altCurrency.currency})
              </option>
            )}
          </select>
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Phone number">
          <div className="flex h-[42px] items-center gap-2 rounded-xl border border-xb-line bg-xb-panel-alt px-3 focus-within:border-xb-blue">
            <span className="flex shrink-0 items-center gap-1.5 text-[13px] text-xb-text">
              <Flag code={country.code} />
              {country.dial}
            </span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, ""))}
              inputMode="tel"
              placeholder="700 000 000"
              className="w-full min-w-0 bg-transparent text-[13px] text-xb-text outline-none placeholder:text-xb-text-muted"
            />
          </div>
        </Field>

        <Field label="Password">
          <input
            value={regPassword}
            onChange={(e) => setRegPassword(e.target.value)}
            type="password"
            autoComplete="new-password"
            placeholder="At least 4 characters"
            className={inputCls}
          />
        </Field>
      </div>

      {mode === "phone" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Full name (optional)">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Nakato"
              className={inputCls}
            />
          </Field>

          <Field label="Email (optional)">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={inputCls}
            />
          </Field>
        </div>
      )}

      <Field label="Promo / referral code (if you have one)">
        <input
          value={promo}
          onChange={(e) => setPromo(e.target.value)}
          placeholder="BETPLUS100"
          className={inputCls}
        />
      </Field>

      <label className="flex items-start gap-2 text-[11px] leading-relaxed text-xb-text-muted">
        <input
          type="checkbox"
          checked={agree}
          onChange={(e) => setAgree(e.target.checked)}
          className="mt-0.5 h-3.5 w-3.5 accent-xb-blue"
        />
        <span>
          I have read and agree to the{" "}
          <button onClick={() => toast("Terms and Conditions")} className="text-xb-blue underline">
            Terms and Conditions
          </button>{" "}
          and{" "}
          <button onClick={() => toast("Privacy Policy")} className="text-xb-blue underline">
            Privacy Policy
          </button>{" "}
          and I am of legal age.
        </span>
      </label>

      <button
        onClick={submit}
        disabled={busy}
        className="w-full rounded-xl bg-xb-green py-3 text-[13px] font-bold text-xb-on-dark transition-colors hover:bg-xb-green-dark disabled:opacity-60"
      >
        {busy ? "CREATING ACCOUNT…" : "REGISTER"}
      </button>
      <p className="text-center text-[12px] text-xb-text-muted">
        Already have an account?{" "}
        <button onClick={openLogin} className="font-bold text-xb-blue underline">
          Log in
        </button>
      </p>
    </Shell>
  );
}

export function AuthModals() {
  const { modal } = useAuth();
  if (modal === "login") return <LoginModal />;
  if (modal === "register") return <RegisterModal />;
  return null;
}

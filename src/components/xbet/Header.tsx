import { useEffect, useRef, useState } from "react";
import { ChevronDown, Globe } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { AccountMenu } from "./AccountMenu";
import { BonusMenu } from "./BonusMenu";
import { money, useAuth } from "./AuthContext";
import { useServerTime } from "@/lib/server-time";
import {
  DEFAULT_LOCALE,
  SUPPORTED_COUNTRIES,
  detectCountryCode,
  localClock,
  localFull,
  localeFor,
  setPreferredCountry,
  type CountryLocale,
} from "@/lib/site-country";
import { countryByCode } from "@/lib/payments";

const navItems = [
  { label: "SPORT", to: "/" },
  { label: "VIRTUAL", to: "/virtual" },
  { label: "AVIATOR", to: "/aviator" },
  { label: "SLOT", to: "/slot" },
  { label: "RESULTS", to: "/results" },
  { label: "LUCKY WINNER", to: "/lucky-winner" },
  { label: "CONTACT", to: "/contact" },
  { label: "ABOUT US", to: "/about" },
] as const;

export function Header() {
  // Internet time (server clock) — never the device clock, which can be wrong.
  const now = useServerTime();
  const [clockOpen, setClockOpen] = useState(false);
  const clockRef = useRef<HTMLDivElement | null>(null);
  // Detected market drives the flag, clock timezone and wallet currency shown.
  const [loc, setLoc] = useState<CountryLocale>(DEFAULT_LOCALE);

  useEffect(() => {
    setLoc(localeFor(countryByCode(detectCountryCode()) ?? DEFAULT_LOCALE.country));
  }, []);

  const { user, balance, isAdmin, openLogin, openRegister } = useAuth();

  useEffect(() => {
    if (!clockOpen) return;
    const onDown = (e: MouseEvent) => {
      if (clockRef.current && !clockRef.current.contains(e.target as Node)) setClockOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [clockOpen]);



  return (
    <header className="font-xb">
      <div className="flex h-[50px] items-center justify-between rounded-b-none bg-xb-header px-2 sm:px-4 md:rounded-b-xl">
        <Link to="/" className="flex items-center gap-0 text-2xl font-black tracking-tight">
          <span className="text-xb-on-dark">BET</span>
          <span className="text-xb-blue-light">PLUS+</span>
        </Link>

        <div className="flex items-center gap-2">
          <BonusMenu />

          {user ? (
            <div className="flex h-8 items-center gap-2 rounded bg-white/10 px-3 text-xs text-xb-on-dark">
              <span className="max-w-[130px] truncate font-bold">{user.label}</span>
              <span className="text-xb-green">{money(balance)}</span>
            </div>
          ) : (
            <>
              <button
                onClick={openRegister}
                className="h-8 rounded bg-xb-green px-4 text-xs font-bold text-xb-on-dark transition-colors hover:bg-xb-green-dark"
              >
                REGISTRATION
              </button>
              <button
                onClick={openLogin}
                className="h-8 rounded bg-white/10 px-4 text-xs font-bold text-xb-on-dark transition-colors hover:bg-white/20"
              >
                LOG IN
              </button>
            </>
          )}

          {isAdmin && (
            <Link
              to="/admin"
              className="flex h-8 items-center rounded bg-xb-blue-light px-3 text-xs font-bold text-xb-on-dark transition-opacity hover:opacity-90"
            >
              ADMIN
            </Link>
          )}


          <AccountMenu />

          <div className="relative" ref={clockRef}>
            <button
              onClick={() => setClockOpen((o) => !o)}
              aria-haspopup="true"
              aria-expanded={clockOpen}
              aria-label="Time and country"
              className="flex h-8 items-center gap-2 rounded bg-white/10 px-2 text-xs text-xb-on-dark transition-colors hover:bg-white/20"
            >
              <img
                src={loc.flagUrl}
                alt={`${loc.country.name} flag`}
                className="h-4 w-6 rounded-sm object-cover"
                loading="lazy"
              />
              <span>{now ? localClock(now, loc) : "--:--"}</span>
              <ChevronDown className="h-3 w-3" />
            </button>

            {clockOpen && (
              <div className="absolute right-0 z-50 mt-2 w-[260px] overflow-hidden rounded-2xl border border-xb-line bg-xb-panel shadow-xl">
                <div className="flex items-center gap-2 bg-xb-header px-3 py-2">
                  <Globe className="h-3.5 w-3.5 text-xb-on-dark" />
                  <span className="text-[12px] font-black text-xb-on-dark">
                    {loc.country.name.toUpperCase()} — {loc.tzLabel}
                  </span>
                </div>
                <div className="px-3 py-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-xb-text-muted">
                    {loc.tz.replace("_", " ")}
                  </p>
                  <p className="mt-0.5 text-[15px] font-black text-xb-text">
                    {now ? `${localClock(now, loc)} ${loc.tzLabel}` : "Syncing…"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-xb-text-muted">
                    {now ? localFull(now, loc) : "Fetching internet time"}
                  </p>
                  <p className="mt-2 text-[10.5px] leading-snug text-xb-text-muted">
                    Wallet currency: <b className="text-xb-text">{loc.country.currency}</b> (
                    {loc.country.currencyName}). Times are synced with our servers, not your device
                    clock.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-px bg-xb-line">
                  {SUPPORTED_COUNTRIES.map((c) => (
                    <button
                      key={c.code}
                      onClick={() => {
                        setPreferredCountry(c.code);
                        setLoc(localeFor(c));
                        setClockOpen(false);
                        toast(`${c.name} selected`, {
                          description: `Prices and payments now show in ${c.currency}.`,
                        });
                      }}
                      className={`px-2 py-1.5 text-left text-[11px] font-bold ${
                        c.code === loc.country.code
                          ? "bg-xb-blue text-xb-on-dark"
                          : "bg-xb-panel-alt text-xb-text hover:bg-xb-odds"
                      }`}
                    >
                      {c.flag} {c.name} · {c.currency}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>

      </div>

      <nav className="xb-noscroll mt-0.5 flex h-[38px] items-center gap-0.5 overflow-x-auto rounded-none bg-xb-nav px-0 md:mt-1 md:h-[42px] md:gap-1 md:rounded-xl md:px-2">
        {navItems.map((item) => (
          <Link
            key={item.label}
            to={item.to}
            activeOptions={{ exact: item.to === "/" }}
            activeProps={{ className: "bg-white/15" }}
            className="flex h-full shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-lg px-2 text-[10px] font-bold text-xb-on-dark transition-colors hover:bg-white/10 sm:text-[11px] md:min-w-0 md:flex-1 md:px-3 md:text-[13px]"
          >
            {item.label === "AVIATOR" && (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-xb-green" />
            )}
            {item.label}
          </Link>
        ))}
      </nav>


    </header>
  );
}

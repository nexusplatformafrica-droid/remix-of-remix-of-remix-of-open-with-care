/**
 * Which supported market the visitor is in.
 *
 * Only countries the payment provider actually serves are supported, so the
 * flag, clock, locale and currency always match a country we can pay out in.
 */
import { useEffect, useState } from "react";
import { PAY_COUNTRIES, DEFAULT_COUNTRY, countryByCode, type PayCountry } from "./payments";

export type CountryLocale = {
  country: PayCountry;
  /** IANA timezone used for the header clock and kick-off times. */
  tz: string;
  /** BCP-47 locale used for date / number formatting. */
  locale: string;
  /** Short timezone label, e.g. "EAT". */
  tzLabel: string;
  /** CDN flag image for the country. */
  flagUrl: string;
};

const META: Record<string, { tz: string; locale: string; tzLabel: string }> = {
  UG: { tz: "Africa/Kampala", locale: "en-UG", tzLabel: "EAT" },
  KE: { tz: "Africa/Nairobi", locale: "en-KE", tzLabel: "EAT" },
  TZ: { tz: "Africa/Dar_es_Salaam", locale: "en-TZ", tzLabel: "EAT" },
  RW: { tz: "Africa/Kigali", locale: "en-RW", tzLabel: "CAT" },
  CD: { tz: "Africa/Kinshasa", locale: "fr-CD", tzLabel: "WAT" },
};

const TZ_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(META).map(([code, m]) => [m.tz, code]),
);

export const SUPPORTED_COUNTRIES = PAY_COUNTRIES;

export function localeFor(country: PayCountry): CountryLocale {
  const meta = META[country.code] ?? META["UG"]!;
  return {
    country,
    tz: meta.tz,
    locale: meta.locale,
    tzLabel: meta.tzLabel,
    flagUrl: `https://flagcdn.com/w40/${country.code.toLowerCase()}.png`,
  };
}

export const DEFAULT_LOCALE = localeFor(DEFAULT_COUNTRY);

const STORAGE_KEY = "bp-country";

/** Best-effort detection from the browser timezone, then the browser language. */
export function detectCountryCode(): string {
  if (typeof window === "undefined") return DEFAULT_COUNTRY.code;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && countryByCode(saved)) return saved.toUpperCase();
  } catch {
    /* storage blocked */
  }
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const byTz = TZ_TO_CODE[tz];
    if (byTz) return byTz;
  } catch {
    /* no Intl data */
  }
  const region = (navigator.language.split("-")[1] ?? "").toUpperCase();
  return countryByCode(region) ? region : DEFAULT_COUNTRY.code;
}

export function setPreferredCountry(code: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, code.toUpperCase());
  } catch {
    /* storage blocked */
  }
}

/** Detected market. Renders the default on the server, then hydrates. */
export function useCountryLocale(): CountryLocale {
  const [loc, setLoc] = useState<CountryLocale>(DEFAULT_LOCALE);
  useEffect(() => {
    const country = countryByCode(detectCountryCode()) ?? DEFAULT_COUNTRY;
    setLoc(localeFor(country));
  }, []);
  return loc;
}

/** Local wall clock for the market, e.g. "7:45pm". */
export function localClock(now: Date, loc: CountryLocale) {
  return now
    .toLocaleTimeString(loc.locale, {
      timeZone: loc.tz,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .replace(/\s?([AP])M$/i, (_m, p1: string) => `${p1.toLowerCase()}m`);
}

/** Full local stamp for the market. */
export function localFull(now: Date, loc: CountryLocale) {
  return now.toLocaleString(loc.locale, {
    timeZone: loc.tz,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/** Money in the market's own currency. */
export function localMoney(amount: number, loc: CountryLocale) {
  const n = Number.isFinite(amount) ? amount : 0;
  return `${loc.country.currency} ${n.toLocaleString(loc.locale, { maximumFractionDigits: 2 })}`;
}

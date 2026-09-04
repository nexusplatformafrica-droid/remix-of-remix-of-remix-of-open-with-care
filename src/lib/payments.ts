/**
 * Relworx payments client (via the LIVRA Railway backend).
 * Every country / currency / limit here mirrors what the provider supports.
 */

export const PAYMENTS_BASE = "https://function-bun-production-4d88.up.railway.app";

export type PayMethod = {
  id: string;
  label: string;
  type: "mobile" | "visa";
};

export type PayCountry = {
  code: string;
  name: string;
  flag: string;
  dial: string;
  currency: string;
  currencyName: string;
  methods: PayMethod[];
  minMobile: number;
  maxMobile: number;
  minVisa?: number;
  maxVisa?: number;
  /** Extra currency the same country may transact in (DRC USD wallets). */
  altCurrency?: { currency: string; min: number; max: number };
};

export const PAY_COUNTRIES: PayCountry[] = [
  {
    code: "UG",
    name: "Uganda",
    flag: "🇺🇬",
    dial: "+256",
    currency: "UGX",
    currencyName: "Ugandan shilling",
    methods: [
      { id: "MTN Mobile Money", label: "MTN Mobile Money", type: "mobile" },
      { id: "Airtel Money", label: "Airtel Money", type: "mobile" },
      { id: "VISA", label: "Visa / Mastercard", type: "visa" },
    ],
    minMobile: 500,
    maxMobile: 5_000_000,
    minVisa: 2_000,
    maxVisa: 5_000_000,
  },
  {
    code: "KE",
    name: "Kenya",
    flag: "🇰🇪",
    dial: "+254",
    currency: "KES",
    currencyName: "Kenyan shilling",
    methods: [
      { id: "Safaricom M-Pesa", label: "Safaricom M-Pesa", type: "mobile" },
      { id: "Airtel Money", label: "Airtel Money", type: "mobile" },
    ],
    // Relworx rejects anything under KES 50 on Kenyan collections.
    minMobile: 50,
    maxMobile: 70_000,
  },
  {
    code: "TZ",
    name: "Tanzania",
    flag: "🇹🇿",
    dial: "+255",
    currency: "TZS",
    currencyName: "Tanzanian shilling",
    methods: [
      { id: "Airtel Money", label: "Airtel Money", type: "mobile" },
      { id: "Tigo Pesa", label: "Tigo Pesa", type: "mobile" },
      { id: "Vodacom M-Pesa", label: "Vodacom M-Pesa", type: "mobile" },
      { id: "Halotel", label: "Halopesa", type: "mobile" },
    ],
    // Tanzanian mobile money collections are rejected below TZS 1,000.
    minMobile: 1_000,
    maxMobile: 5_000_000,
  },
  {
    code: "RW",
    name: "Rwanda",
    flag: "🇷🇼",
    dial: "+250",
    currency: "RWF",
    currencyName: "Rwandan franc",
    methods: [
      { id: "MTN Mobile Money", label: "MTN Mobile Money", type: "mobile" },
      { id: "Airtel Money", label: "Airtel Money", type: "mobile" },
    ],
    // RWF collections below 100 are declined by the provider.
    minMobile: 100,
    maxMobile: 5_000_000,
  },
  {
    code: "CD",
    name: "Democratic Republic of Congo",
    flag: "🇨🇩",
    dial: "+243",
    currency: "CDF",
    currencyName: "Congolese franc",
    methods: [
      { id: "Airtel Money", label: "Airtel Money", type: "mobile" },
      { id: "Orange Money", label: "Orange Money", type: "mobile" },
      { id: "Vodacom M-Pesa", label: "Vodacom / M-Pesa", type: "mobile" },
      { id: "Africell Afrimoney", label: "Africell Afrimoney", type: "mobile" },
    ],
    // CDF collections below 1,000 are declined by the provider.
    minMobile: 1_000,
    maxMobile: 5_000_000,
    altCurrency: { currency: "USD", min: 2, max: 2_500 },
  },
];

export const DEFAULT_COUNTRY = PAY_COUNTRIES[0]!;

export function countryByCode(code: string | undefined | null): PayCountry | null {
  if (!code) return null;
  return PAY_COUNTRIES.find((c) => c.code === code.toUpperCase()) ?? null;
}

export function countryByName(name: string | undefined | null): PayCountry | null {
  if (!name) return null;
  const n = name.trim().toLowerCase();
  return PAY_COUNTRIES.find((c) => c.name.toLowerCase() === n) ?? null;
}

export function countryByCurrency(cur: string | undefined | null): PayCountry | null {
  if (!cur) return null;
  const c = cur.trim().toUpperCase();
  return PAY_COUNTRIES.find((x) => x.currency === c) ?? null;
}

/** Detects the country from the dial prefix of an international number. */
export function countryFromPhone(phone: string): PayCountry | null {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return null;
  return PAY_COUNTRIES.find((c) => digits.startsWith(c.dial.replace("+", ""))) ?? null;
}

/** Builds the +2567… MSISDN the provider expects from any local/international input. */
export function toMsisdn(phone: string, country: PayCountry): string {
  let digits = String(phone || "").replace(/\D/g, "");
  const cc = country.dial.replace("+", "");
  if (digits.startsWith(cc)) return `+${digits}`;
  digits = digits.replace(/^0+/, "");
  return `+${cc}${digits}`;
}

export function methodsFor(country: PayCountry, kind: "deposit" | "withdraw"): PayMethod[] {
  // Payouts are mobile-money only — cards cannot receive a withdrawal.
  return kind === "withdraw" ? country.methods.filter((m) => m.type === "mobile") : country.methods;
}

/** Payouts have no ceiling — a player can withdraw their whole balance. */
export const NO_MAX = Number.MAX_SAFE_INTEGER;

export function limitsFor(
  country: PayCountry,
  method: PayMethod,
  currency?: string,
  kind: "deposit" | "withdraw" = "deposit",
) {
  const cap = (min: number, max: number) => ({ min, max: kind === "withdraw" ? NO_MAX : max });
  if (method.type === "visa") {
    return cap(country.minVisa ?? country.minMobile, country.maxVisa ?? country.maxMobile);
  }
  if (currency && country.altCurrency && currency === country.altCurrency.currency) {
    return cap(country.altCurrency.min, country.altCurrency.max);
  }
  return cap(country.minMobile, country.maxMobile);
}

/**
 * Smallest deposit the provider accepts in a currency — this exact amount is
 * also the non-withdrawable welcome bonus paid on a player's first deposit.
 * Values verified live against the payment provider.
 */
export function minDepositFor(currency: string | undefined | null): number {
  const cur = String(currency ?? "").toUpperCase();
  const country = PAY_COUNTRIES.find((c) => c.currency === cur);
  if (country) return country.minMobile;
  const alt = PAY_COUNTRIES.find((c) => c.altCurrency?.currency === cur);
  if (alt?.altCurrency) return alt.altCurrency.min;
  return DEFAULT_COUNTRY.minMobile;
}

export function formatMoney(amount: number, currency = "UGX"): string {
  const n = Number.isFinite(amount) ? amount : 0;
  return `${currency} ${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

/* ------------------------------------------------------------------ */
/* IP geolocation (free, key-less, with fallback)                      */
/* ------------------------------------------------------------------ */

export type GeoResult = { code: string; name: string; supported: boolean };

const GEO_KEY = "bp_geo_country";

export async function detectCountry(): Promise<GeoResult | null> {
  if (typeof window === "undefined") return null;
  const cached = window.localStorage.getItem(GEO_KEY);
  if (cached) {
    try {
      return JSON.parse(cached) as GeoResult;
    } catch {
      /* ignore */
    }
  }
  const read = async (url: string, pick: (j: Record<string, unknown>) => [string, string]) => {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("geo failed");
    const json = (await res.json()) as Record<string, unknown>;
    const [code, name] = pick(json);
    if (!code) throw new Error("geo empty");
    return { code: code.toUpperCase(), name };
  };

  let found: { code: string; name: string } | null = null;
  try {
    found = await read("https://ipwho.is/", (j) => [
      String(j["country_code"] ?? ""),
      String(j["country"] ?? ""),
    ]);
  } catch {
    try {
      found = await read("https://ipapi.co/json/", (j) => [
        String(j["country_code"] ?? ""),
        String(j["country_name"] ?? ""),
      ]);
    } catch {
      found = null;
    }
  }
  if (!found) return null;
  const result: GeoResult = {
    code: found.code,
    name: countryByCode(found.code)?.name ?? found.name,
    supported: Boolean(countryByCode(found.code)),
  };
  window.localStorage.setItem(GEO_KEY, JSON.stringify(result));
  return result;
}

/* ------------------------------------------------------------------ */
/* Backend calls                                                       */
/* ------------------------------------------------------------------ */

export type ApiResult<T = Record<string, unknown>> = {
  ok: boolean;
  status: number;
  data: T & { success?: boolean; message?: string; error?: string };
};

async function call<T = Record<string, unknown>>(
  path: string,
  init?: RequestInit,
): Promise<ApiResult<T>> {
  const res = await fetch(`${PAYMENTS_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    data = {};
  }
  // The backend wraps the provider's real reason inside `details` — surface it
  // so players see "Visa is disabled…" instead of "Relworx request failed".
  const details = data["details"];
  if (details && typeof details === "object") {
    const inner = details as Record<string, unknown>;
    const reason = inner["message"] ?? inner["error"];
    if (reason) data = { ...data, message: String(reason) };
  }
  return { ok: res.ok, status: res.status, data: data as ApiResult<T>["data"] };
}

export type PayRequestResponse = {
  success?: boolean;
  internal_reference?: string;
  customer_reference?: string;
  message?: string;
  error?: string;
};

export function requestDeposit(body: {
  msisdn: string;
  amount: number;
  currency: string;
  reference: string;
  description?: string;
}) {
  return call<PayRequestResponse>("/api/deposit", { method: "POST", body: JSON.stringify(body) });
}

export function requestWithdraw(body: {
  msisdn: string;
  amount: number;
  currency: string;
  reference: string;
  description?: string;
}) {
  return call<PayRequestResponse>("/api/withdraw", { method: "POST", body: JSON.stringify(body) });
}

export function requestCardSession(body: {
  amount: number;
  currency: string;
  reference: string;
  description?: string;
}) {
  return call<PayRequestResponse & { redirect_url?: string; url?: string }>("/api/card/payment", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function validatePhone(msisdn: string) {
  return call<{ success?: boolean; customer_name?: string }>("/api/validate-phone", {
    method: "POST",
    body: JSON.stringify({ msisdn }),
  });
}

export type RequestStatus = "pending" | "success" | "failed";

export type StatusResponse = {
  success?: boolean;
  status?: string;
  message?: string;
  customer_reference?: string;
  internal_reference?: string;
};

export function checkRequestStatus(internalReference: string) {
  return call<StatusResponse>(
    `/api/request-status?internal_reference=${encodeURIComponent(internalReference)}`,
  );
}

/** Maps every provider status string onto our three outcomes. */
export function readStatus(payload: StatusResponse | undefined): RequestStatus {
  const raw = String(payload?.status ?? "").toLowerCase();
  if (!raw) return "pending";
  if (["success", "successful", "completed", "complete", "paid"].includes(raw)) return "success";
  if (["failed", "failure", "error", "cancelled", "canceled", "rejected", "expired"].includes(raw))
    return "failed";
  return "pending";
}

export function walletBalance(currency: string) {
  return call<{ success?: boolean; balance?: number; currency?: string }>(
    `/api/wallet/balance?currency=${encodeURIComponent(currency)}`,
  );
}

export type ProviderTransaction = {
  id?: string;
  reference?: string;
  customer_reference?: string;
  internal_reference?: string;
  msisdn?: string;
  amount?: number;
  currency?: string;
  status?: string;
  type?: string;
  created_at?: string;
};

export function providerTransactions(page = 1) {
  return call<{
    success?: boolean;
    transactions?: ProviderTransaction[];
    data?: ProviderTransaction[];
  }>(`/api/transactions?page=${page}`);
}

/**
 * Finds the provider's own record for one of our references.
 * Used as a fallback when the internal reference is missing or the
 * request-status lookup cannot find the record.
 */
export async function findProviderTransaction(
  reference: string,
  pages = 3,
): Promise<ProviderTransaction | null> {
  for (let page = 1; page <= pages; page += 1) {
    const res = await providerTransactions(page);
    if (!res.ok) return null;
    const rows = res.data.transactions ?? res.data.data ?? [];
    const hit = rows.find(
      (t) => t.customer_reference === reference || t.reference === reference,
    );
    if (hit) return hit;
    if (rows.length === 0) return null;
  }
  return null;
}

/** Unique 8–36 char reference accepted by Relworx. */
export function makeReference(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${rand}`.slice(0, 36);
}

/**
 * Aviator money rules.
 *
 * The crash game is built into this platform (see src/components/aviator), so
 * there is no external operator, no embed and no wallet callback: stakes and
 * payouts move straight through the player's BET PLUS+ balance. This file only
 * decides the stake limits per market currency.
 */
import { PAY_COUNTRIES, DEFAULT_COUNTRY, countryByCurrency } from "./payments";

export type AviatorMoneyRules = {
  currency: string;
  /** Minimum stake = the minimum deposit for that currency. */
  min: number;
  max: number;
  step: number;
  chips: number[];
};

/** Stake rules per supported currency, driven by the payment provider limits. */
export function moneyRulesFor(currency: string | undefined | null): AviatorMoneyRules {
  const cur = (currency ?? "").trim().toUpperCase();

  const alt = PAY_COUNTRIES.find((c) => c.altCurrency?.currency === cur)?.altCurrency;
  if (alt) {
    return { currency: alt.currency, min: alt.min, max: alt.max, step: alt.min, chips: chipsFrom(alt.min, alt.max) };
  }

  const country = countryByCurrency(cur) ?? DEFAULT_COUNTRY;
  const min = country.minMobile;
  return {
    currency: country.currency,
    min,
    max: country.maxMobile,
    step: min,
    chips: chipsFrom(min, country.maxMobile),
  };
}

function chipsFrom(min: number, max: number) {
  return [min, min * 2, min * 5, min * 10].filter((v) => v <= max);
}

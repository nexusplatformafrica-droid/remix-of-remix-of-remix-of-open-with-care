/** Phone/password identity helpers shared by the site and the admin console. */

export const ADMIN_PHONE = "0760734679";
export const ADMIN_EMAIL = "nexusplatformafrica@gmail.com";

/** Firebase requires 6+ characters; we allow 4 by peppering the stored secret. */
const PEPPER = "#BetPlusAfrica";

export function pepper(password: string): string {
  return `${password}${PEPPER}`;
}

/** Turns any local/international form into a bare MSISDN, e.g. 256760734679. */
export function normalizePhone(input: string): string {
  const digits = (input || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("256")) return digits;
  if (digits.startsWith("0")) return `256${digits.slice(1)}`;
  if (digits.length === 9) return `256${digits}`;
  return digits;
}

export function prettyPhone(input: string): string {
  const n = normalizePhone(input);
  if (!n) return input;
  return `+${n}`;
}

/** Internal Firebase credential address derived from the phone number. */
export function authEmailFor(identifier: string): string {
  const trimmed = (identifier || "").trim();
  if (trimmed.includes("@")) return trimmed.toLowerCase();
  const phone = normalizePhone(trimmed);
  return `u${phone}@betplus-africa.app`;
}

export function isAdminIdentity(phone: string, email?: string): boolean {
  return (
    normalizePhone(phone) === normalizePhone(ADMIN_PHONE) ||
    (email ?? "").trim().toLowerCase() === ADMIN_EMAIL
  );
}

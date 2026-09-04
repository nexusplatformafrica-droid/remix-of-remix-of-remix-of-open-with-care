/**
 * Payment backend base URL.
 * Default is baked in, but the admin can change it in Admin → Settings and the
 * new URL is picked up everywhere (it lives on the site settings doc).
 */
import { firebase } from "./firebase";
import { siteDoc } from "./firestore-db";

export const DEFAULT_PAYMENTS_BASE = "https://function-bun-production-e268.up.railway.app";

const KEY = "xb-payments-base";
let current = DEFAULT_PAYMENTS_BASE;
let started = false;

function clean(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

/** Current backend base URL (no trailing slash). */
export function paymentsBase(): string {
  if (typeof window !== "undefined" && !started) {
    started = true;
    const cached = window.localStorage.getItem(KEY);
    if (cached) current = clean(cached);
    void (async () => {
      try {
        const { db } = await firebase();
        const { onSnapshot } = await import("firebase/firestore");
        onSnapshot(siteDoc(db, "settings"), (snap) => {
          const url = snap.exists() ? (snap.data() as { paymentsBase?: string }).paymentsBase : "";
          if (url && clean(url)) {
            current = clean(url);
            window.localStorage.setItem(KEY, current);
          }
        });
      } catch {
        /* keep the built-in default */
      }
    })();
  }
  return current;
}

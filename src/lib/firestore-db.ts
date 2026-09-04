import {
  addDoc,
  collection,
  doc,
  getDoc,
  setDoc,
  type Firestore,
} from "firebase/firestore";
import { firebase } from "./firebase";
import type { Activity, SiteContent, SiteSettings, Transaction } from "./admin-types";
import { seedState } from "./admin-seed";

export const COL = {
  users: "users",
  bets: "bets",
  transactions: "transactions",
  activities: "activities",
  agents: "agents",
  partners: "partners",
  affiliates: "affiliates",
} as const;

export const siteDoc = (db: Firestore, id: "content" | "settings" | "wallet") =>
  doc(db, "site", id);

export const col = (db: Firestore, name: string) => collection(db, name);
export const rec = (db: Firestore, name: string, id: string) => doc(db, name, id);

/** Writes one row into the global activity feed. Never throws into the UI. */
export async function logActivity(
  activity: Omit<Activity, "id" | "at" | "ip" | "device"> & { device?: string },
): Promise<void> {
  try {
    const { db } = await firebase();
    await addDoc(collection(db, COL.activities), {
      at: Date.now(),
      ip: "-",
      device:
        activity.device ??
        (typeof navigator === "undefined" ? "server" : navigator.userAgent.slice(0, 90)),
      ...activity,
    });
  } catch {
    /* activity logging must never break a user flow */
  }
}

/** Writes one row into the global money ledger. */
export async function pushTransaction(tx: Omit<Transaction, "id" | "at">): Promise<void> {
  const { db } = await firebase();
  await addDoc(collection(db, COL.transactions), { at: Date.now(), ...tx });
}

/** Creates the site content / settings / wallet documents on first run. */
export async function ensureSiteDocs(): Promise<{
  content: SiteContent;
  settings: SiteSettings;
  siteFloat: number;
}> {
  const { db } = await firebase();
  const base = seedState();
  const defaults = {
    content: base.content,
    settings: base.settings,
    siteFloat: base.siteFloat,
  };
  const [contentSnap, settingsSnap, walletSnap] = await Promise.all([
    getDoc(siteDoc(db, "content")),
    getDoc(siteDoc(db, "settings")),
    getDoc(siteDoc(db, "wallet")),
  ]);
  if (!contentSnap.exists()) await setDoc(siteDoc(db, "content"), defaults.content);
  if (!settingsSnap.exists()) await setDoc(siteDoc(db, "settings"), defaults.settings);
  if (!walletSnap.exists()) await setDoc(siteDoc(db, "wallet"), { siteFloat: defaults.siteFloat });
  return {
    content: (contentSnap.exists() ? (contentSnap.data() as SiteContent) : defaults.content),
    settings: (settingsSnap.exists() ? (settingsSnap.data() as SiteSettings) : defaults.settings),
    siteFloat: walletSnap.exists()
      ? ((walletSnap.data() as { siteFloat: number }).siteFloat ?? defaults.siteFloat)
      : defaults.siteFloat,
  };
}

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser,
} from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { authErrorMessage, firebase } from "@/lib/firebase";
import { COL, logActivity, pushTransaction, siteDoc } from "@/lib/firestore-db";
import { authEmailFor, isAdminIdentity, normalizePhone, pepper, prettyPhone } from "@/lib/identity";
import { defaultUserSettings, uid } from "@/lib/admin-seed";
import {
  createPaymentSession,
  patchPaymentSession,
  settlePaymentSession,
} from "@/lib/payment-sessions";
import { makeReference, requestCardSession, requestDeposit, requestWithdraw } from "@/lib/payments";
import type { AdminUser, Bet, BetMatch, Transaction } from "@/lib/admin-types";

/** Everything a deposit or withdrawal needs from the UI. */
export type PayInput = {
  amount: number;
  method: string;
  msisdn: string;
  currency: string;
};

export const REFERRAL_BONUS = 100;

/** Stable, shareable referral code derived from the account phone number. */
export function referralCodeFor(phone: string) {
  return `BP${normalizePhone(phone).slice(-6)}`;
}

export type AccountUser = {
  id: string;
  label: string;
  name: string;
  phone: string;
  email: string;
  country: string;
  currency: string;
  role: "admin" | "user";
};

export type PlacedBet = {
  id: string;
  placedAt: number;
  events: number;
  stake: number;
  odds: number;
  status: "open" | "won" | "lost";
};

export type { Transaction };

export type RegisterInput = {
  mode: "one-click" | "phone";
  country: string;
  currency: string;
  phone: string;
  email: string;
  promo: string;
  password?: string;
  name?: string;
};

export type ModalKind = "login" | "register" | null;

type MatchInput = {
  event: string;
  market: string;
  odd: number;
  league?: string | undefined;
  matchId?: string | undefined;
  sport?: string | undefined;
  startsAt?: number | undefined;
};

type AuthCtx = {
  user: AccountUser | null;
  profile: AdminUser | null;
  /** Total spendable balance (withdrawable cash + bonus). */
  balance: number;
  /** Cash that may be withdrawn. */
  withdrawable: number;
  /** Non-withdrawable sign-up bonus, stake-only. */
  bonus: number;
  bets: PlacedBet[];
  rawBets: Bet[];
  transactions: Transaction[];
  modal: ModalKind;
  loading: boolean;
  busy: boolean;
  isAdmin: boolean;
  /** Shareable referral code for the signed-in user. */
  referralCode: string;
  /** Full invite link carrying the referral code. */
  referralLink: string;
  /** Friends who signed up with this user's code. */
  referralCount: number;
  openLogin: () => void;
  openRegister: () => void;
  closeModal: () => void;
  login: (identifier: string, password: string) => Promise<boolean>;
  register: (input: RegisterInput) => Promise<boolean>;
  logout: () => Promise<void>;
  /** Currency of the signed-in player (falls back to UGX). */
  currency: string;
  deposit: (input: PayInput) => Promise<string>;
  withdraw: (input: PayInput) => Promise<string>;
  deleteBet: (id: string) => Promise<void>;
  addBet: (bet: {
    events: number;
    stake: number;
    odds: number;
    matches?: MatchInput[];
  }) => Promise<boolean>;
  stakeGame: (amount: number, game: string) => boolean;
  creditWin: (amount: number, game: string) => void;
  track: (action: string, target?: string) => void;
};

const Ctx = createContext<AuthCtx | null>(null);

function toPlaced(b: Bet): PlacedBet {
  const odds = b.matches.reduce((a, m) => a * (m.odds || 1), 1);
  return {
    id: b.id,
    placedAt: b.placedAt,
    events: b.matches.length,
    stake: b.stake,
    odds: odds || 1,
    status: b.status === "won" ? "won" : b.status === "lost" ? "lost" : "open",
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [fbUser, setFbUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<AdminUser | null>(null);
  const [rawBets, setRawBets] = useState<Bet[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [modal, setModal] = useState<ModalKind>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const balanceRef = useRef({ cash: 0, bonus: 0 });

  // Auth session
  useEffect(() => {
    let unsub = () => {};
    void firebase()
      .then(({ auth }) => {
        unsub = onAuthStateChanged(auth, (u) => {
          setFbUser(u);
          setLoading(false);
        });
      })
      .catch(() => setLoading(false));
    return () => unsub();
  }, []);

  // Live profile + bets + ledger for the signed-in player
  useEffect(() => {
    if (!fbUser) {
      setProfile(null);
      setRawBets([]);
      setTransactions([]);
      return;
    }
    const unsubs: Array<() => void> = [];
    let cancelled = false;
    void firebase().then(({ db }) => {
      if (cancelled) return;
      unsubs.push(
        onSnapshot(doc(db, COL.users, fbUser.uid), (snap) => {
          setProfile(snap.exists() ? ({ id: snap.id, ...snap.data() } as AdminUser) : null);
        }),
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, COL.bets), where("userId", "==", fbUser.uid)),
          (snap) => {
            const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Bet);
            list.sort((a, b) => b.placedAt - a.placedAt);
            setRawBets(list);
          },
          () => setRawBets([]),
        ),
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, COL.transactions), where("actorId", "==", fbUser.uid)),
          (snap) => {
            const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Transaction);
            list.sort((a, b) => b.at - a.at);
            setTransactions(list.slice(0, 120));
          },
          () => setTransactions([]),
        ),
      );
    });
    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
    };
  }, [fbUser]);

  const cash = profile?.balance ?? 0;
  const bonus = profile?.bonusBalance ?? 0;
  balanceRef.current = { cash, bonus };

  const user = useMemo<AccountUser | null>(() => {
    if (!fbUser || !profile) return null;
    return {
      id: profile.id,
      label: profile.name || prettyPhone(profile.phone) || profile.email,
      name: profile.name,
      phone: profile.phone,
      email: profile.email,
      country: profile.country,
      currency: profile.currency,
      role: profile.role === "admin" ? "admin" : "user",
    };
  }, [fbUser, profile]);

  const track = useCallback(
    (action: string, target = "") => {
      if (!profile) return;
      void logActivity({
        actorType: profile.role === "admin" ? "admin" : "user",
        actorId: profile.id,
        actorName: profile.name || prettyPhone(profile.phone),
        action,
        target,
      });
    },
    [profile],
  );

  // Records every click on the site into the activity feed.
  const lastClick = useRef(0);
  useEffect(() => {
    if (!profile) return;
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest(
        "button,a,[role='button'],select,input[type='checkbox']",
      );
      if (!el) return;
      const now = Date.now();
      if (now - lastClick.current < 700) return;
      lastClick.current = now;
      const label =
        el.getAttribute("aria-label") ||
        (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 60) ||
        el.tagName.toLowerCase();
      void logActivity({
        actorType: profile.role === "admin" ? "admin" : "user",
        actorId: profile.id,
        actorName: profile.name || prettyPhone(profile.phone),
        action: `Clicked "${label}"`,
        target: typeof window === "undefined" ? "" : window.location.pathname,
      });
    };
    window.addEventListener("click", onClick, true);
    return () => window.removeEventListener("click", onClick, true);
  }, [profile]);

  const touchLastSeen = useCallback(async (id: string) => {
    const { db } = await firebase();
    await updateDoc(doc(db, COL.users, id), { lastSeen: Date.now() }).catch(() => undefined);
  }, []);

  const value = useMemo<AuthCtx>(() => {
    const requireUser = () => {
      if (!profile) throw new Error("Please log in first");
      return profile;
    };

    return {
      user,
      profile,
      balance: cash + bonus,
      currency: user?.currency || profile?.currency || "UGX",
      withdrawable: cash,
      bonus,
      bets: rawBets.map(toPlaced),
      rawBets,
      transactions,
      modal,
      loading,
      busy,
      isAdmin: profile?.role === "admin",
      referralCode: profile ? referralCodeFor(profile.phone) : "",
      referralLink:
        profile && typeof window !== "undefined"
          ? `${window.location.origin}/?ref=${referralCodeFor(profile.phone)}`
          : "",
      referralCount: profile?.referralCount ?? 0,
      openLogin: () => setModal("login"),
      openRegister: () => setModal("register"),
      closeModal: () => setModal(null),
      track,

      login: async (identifier, password) => {
        setBusy(true);
        try {
          const { auth } = await firebase();
          const cred = await signInWithEmailAndPassword(
            auth,
            authEmailFor(identifier),
            pepper(password),
          );
          setModal(null);
          await touchLastSeen(cred.user.uid);
          void logActivity({
            actorType: "user",
            actorId: cred.user.uid,
            actorName: prettyPhone(identifier),
            action: "Logged in",
            target: identifier,
          });
          return true;
        } catch (err) {
          throw new Error(authErrorMessage(err));
        } finally {
          setBusy(false);
        }
      },

      register: async (input) => {
        setBusy(true);
        try {
          const phone = normalizePhone(input.phone);
          if (!phone || phone.length < 10) throw new Error("Enter a valid phone number");
          const password = input.password ?? "";
          if (password.length < 4) throw new Error("Password must be at least 4 characters");
          const { auth, db } = await firebase();
          const cred = await createUserWithEmailAndPassword(
            auth,
            authEmailFor(phone),
            pepper(password),
          );
          const admin = isAdminIdentity(phone, input.email);
          const now = Date.now();
          const record: Omit<AdminUser, "id"> = {
            name: input.name?.trim() || `Player ${phone.slice(-4)}`,
            phone,
            idNumber: `UG${phone.slice(-7)}`,
            email: input.email.trim(),
            country: input.country,
            currency: input.currency.replace(/.*\(([^)]+)\).*/, "$1"),
            balance: 0,
            bonusBalance: 0,
            referralCode: referralCodeFor(phone),
            referredBy: input.promo.trim().toUpperCase() || "",
            referralCount: 0,
            role: admin ? "admin" : "user",
            totalIn: 0,
            totalOut: 0,
            lostBalance: 0,
            lastSeen: now,
            joinedAt: now,
            status: "active",
            verified: false,
            city: input.country === "Uganda" ? "Kampala" : "-",
            settings: defaultUserSettings(),
            messages: [
              {
                id: uid("MSG-"),
                at: now,
                channel: "Notification",
                title: "Welcome to BET PLUS+",
                body: "Make your first deposit and we add a free bonus equal to the minimum deposit for your currency. It can be used as stake — any winnings become withdrawable cash.",
              },
            ],
          };

          await setDoc(doc(db, COL.users, cred.user.uid), record);

          // Real referral payout: the inviter is credited UGX 100 in bonus funds.
          const refCode = input.promo.trim().toUpperCase();
          if (refCode && refCode !== record.referralCode) {
            try {
              const snap = await getDocs(
                query(collection(db, COL.users), where("referralCode", "==", refCode)),
              );
              const inviter = snap.docs[0];
              if (inviter) {
                await updateDoc(inviter.ref, {
                  bonusBalance: increment(REFERRAL_BONUS),
                  referralCount: increment(1),
                });
                await pushTransaction({
                  kind: "Bonus",
                  amount: REFERRAL_BONUS,
                  method: "Referral",
                  actorType: "user",
                  actorId: inviter.id,
                  actorName: (inviter.data() as AdminUser).name ?? "",
                  status: "completed",
                  reference: `Referral bonus for inviting ${record.name}`,
                });
              }
            } catch {
              /* referral credit is best-effort */
            }
          }
          // No sign-up credit: the welcome bonus is paid on the first deposit.

          void logActivity({
            actorType: "user",
            actorId: cred.user.uid,
            actorName: record.name,
            action: "Registered an account",
            target: prettyPhone(phone),
          });
          setModal(null);
          return true;
        } catch (err) {
          throw new Error(authErrorMessage(err));
        } finally {
          setBusy(false);
        }
      },

      logout: async () => {
        const id = profile?.id;
        if (id)
          void logActivity({
            actorType: "user",
            actorId: id,
            actorName: profile?.name ?? "",
            action: "Logged out",
            target: "",
          });
        const { auth } = await firebase();
        await signOut(auth);
      },

      deposit: async ({ amount, method, msisdn, currency }) => {
        const me = requireUser();
        if (!(amount > 0)) throw new Error("Enter a valid amount");
        const reference = makeReference("BPD");
        const isCard = /visa|master|card/i.test(method);
        const sessionId = await createPaymentSession({
          userId: me.id,
          userName: me.name,
          kind: "deposit",
          amount,
          currency,
          method,
          msisdn,
          reference,
          internalReference: "",
        });
        const res = isCard
          ? await requestCardSession({
              amount,
              currency,
              reference,
              description: "BET PLUS deposit",
            })
          : await requestDeposit({
              msisdn,
              amount,
              currency,
              reference,
              description: "BET PLUS deposit",
            });
        if (!res.ok) {
          const msg = String(res.data.message ?? res.data.error ?? "Payment request rejected");
          await patchPaymentSession(sessionId, { status: "failed", settled: true, message: msg });
          throw new Error(msg);
        }
        await patchPaymentSession(sessionId, {
          internalReference: String(res.data.internal_reference ?? ""),
        });
        if (isCard) {
          // Relworx names the hosted-checkout link differently across responses.
          const p = res.data as Record<string, unknown>;
          const url = [
            p["redirect_url"],
            p["url"],
            p["hosted_page_url"],
            p["payment_url"],
            p["checkout_url"],
            (p["data"] as Record<string, unknown> | undefined)?.["redirect_url"],
            (p["data"] as Record<string, unknown> | undefined)?.["url"],
          ].find((v) => typeof v === "string" && v.startsWith("http")) as string | undefined;
          if (!url) {
            const msg = String(
              res.data.message ?? "Card checkout link was not returned by the payment provider",
            );
            await patchPaymentSession(sessionId, {
              status: "failed",
              settled: true,
              message: msg,
            });
            throw new Error(msg);
          }
          if (typeof window !== "undefined") window.location.assign(url);
        }

        track("Started a deposit", `${currency} ${amount} via ${method}`);
        return reference;
      },

      withdraw: async ({ amount, method, msisdn, currency }) => {
        const me = requireUser();
        if (!(amount > 0)) throw new Error("Enter a valid amount");
        if (amount > balanceRef.current.cash)
          throw new Error("Amount exceeds your withdrawable cash balance");
        const { db } = await firebase();
        const reference = makeReference("BPW");
        // Hold the money straight away so it cannot be spent while paying out.
        await updateDoc(doc(db, COL.users, me.id), {
          balance: increment(-amount),
          lastSeen: Date.now(),
        });
        const sessionId = await createPaymentSession({
          userId: me.id,
          userName: me.name,
          kind: "withdraw",
          amount,
          currency,
          method,
          msisdn,
          reference,
          internalReference: "",
        });
        const res = await requestWithdraw({
          msisdn,
          amount,
          currency,
          reference,
          description: "BET PLUS withdrawal",
        });
        if (!res.ok) {
          const msg = String(res.data.message ?? res.data.error ?? "Payout request rejected");
          await settlePaymentSession(
            {
              id: sessionId,
              userId: me.id,
              userName: me.name,
              kind: "withdraw",
              amount,
              currency,
              method,
              msisdn,
              reference,
              internalReference: "",
              status: "pending",
              settled: false,
              at: Date.now(),
              updatedAt: Date.now(),
            },
            "failed",
            msg,
          );
          throw new Error(msg);
        }
        await patchPaymentSession(sessionId, {
          internalReference: String(res.data.internal_reference ?? ""),
        });
        track("Requested a withdrawal", `${currency} ${amount} to ${method}`);
        return reference;
      },

      deleteBet: async (id) => {
        const me = requireUser();
        const target = rawBets.find((b) => b.id === id);
        if (!target) return;
        if (target.status === "pending") throw new Error("You can only remove settled tickets");
        const { db } = await firebase();
        await deleteDoc(doc(db, COL.bets, id));
        track("Deleted a ticket", target.code);
        void me;
      },

      addBet: async (bet) => {
        const me = requireUser();
        const { cash: c, bonus: b } = balanceRef.current;
        if (bet.stake <= 0) throw new Error("Enter a stake amount");
        if (bet.stake > c + b) throw new Error("Not enough balance");
        const bonusUse = Math.min(b, bet.stake);
        const cashUse = bet.stake - bonusUse;
        const { db } = await firebase();
        const matches: BetMatch[] = (bet.matches ?? []).map((m) => ({
          id: uid("LEG-"),
          matchId: m.matchId ?? "",
          sport: m.sport ?? "football",
          match: m.event,
          league: m.league ?? "",
          market: m.market,
          pick: m.market,
          odds: m.odd,
          startsAt: m.startsAt ?? Date.now() + 3_600_000,
          status: "pending",
        }));
        const code = uid("BP-").toUpperCase();
        const ref = await addDoc(collection(db, COL.bets), {
          code,
          userId: me.id,
          stake: bet.stake,
          status: "pending",
          placedAt: Date.now(),
          matches: matches.length
            ? matches
            : [
                {
                  id: uid("LEG-"),
                  match: `${bet.events} selection(s)`,
                  league: "",
                  market: "Multiple",
                  pick: "Multiple",
                  odds: bet.odds,
                  startsAt: Date.now() + 3_600_000,
                  status: "pending" as const,
                },
              ],
        });
        await updateDoc(doc(db, COL.users, me.id), {
          balance: increment(-cashUse),
          bonusBalance: increment(-bonusUse),
          lastSeen: Date.now(),
        });
        await pushTransaction({
          kind: "Bet",
          amount: -bet.stake,
          method: bonusUse > 0 ? `Bonus ${bonusUse} + cash ${cashUse}` : "Wallet",
          actorType: "user",
          actorId: me.id,
          actorName: me.name,
          status: "completed",
          reference: code,
        });
        track("Placed a bet", `${code} · ${bet.events} event(s)`);
        void ref;
        return true;
      },

      stakeGame: (amount, game) => {
        const me = profile;
        const { cash: c, bonus: b } = balanceRef.current;
        if (!me || amount <= 0 || amount > c + b) return false;
        const bonusUse = Math.min(b, amount);
        const cashUse = amount - bonusUse;
        void (async () => {
          const { db } = await firebase();
          await updateDoc(doc(db, COL.users, me.id), {
            balance: increment(-cashUse),
            bonusBalance: increment(-bonusUse),
            lastSeen: Date.now(),
          });
          await pushTransaction({
            kind: "Bet",
            amount: -amount,
            method: game,
            actorType: "user",
            actorId: me.id,
            actorName: me.name,
            status: "completed",
            reference: game,
          });
          track("Staked on a game", `${game} · ${amount}`);
        })();
        return true;
      },

      creditWin: (amount, game) => {
        const me = profile;
        if (!me || amount <= 0) return;
        void (async () => {
          const { db } = await firebase();
          await updateDoc(doc(db, COL.users, me.id), { balance: increment(amount) });
          await updateDoc(siteDoc(db, "wallet"), { siteFloat: increment(-amount) }).catch(
            () => undefined,
          );
          await pushTransaction({
            kind: "Payout",
            amount,
            method: game,
            actorType: "user",
            actorId: me.id,
            actorName: me.name,
            status: "completed",
            reference: `${game} win`,
          });
          track("Won a game round", `${game} · ${amount}`);
        })();
      },
    };
  }, [
    user,
    profile,
    cash,
    bonus,
    rawBets,
    transactions,
    modal,
    loading,
    busy,
    track,
    touchLastSeen,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function money(n: number): string {
  return (n || 0).toLocaleString("en-UG", { maximumFractionDigits: 2 });
}

/** Reads a user profile once — used by the admin console for lookups. */
export async function fetchUserProfile(id: string): Promise<AdminUser | null> {
  const { db } = await firebase();
  const snap = await getDoc(doc(db, COL.users, id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as AdminUser) : null;
}

export { orderBy };

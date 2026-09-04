import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  collection,
  deleteDoc,
  doc,
  increment,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import type {
  Activity,
  AdminState,
  AdminUser,
  Affiliate,
  Agent,
  Bet,
  BetMatch,
  Partner,
  SiteContent,
  SiteSettings,
  Slide,
  Transaction,
  UserMessage,
  Winner,
} from "@/lib/admin-types";
import { betPayout, seedState, uid } from "@/lib/admin-seed";
import { firebase } from "@/lib/firebase";
import { COL, ensureSiteDocs, siteDoc } from "@/lib/firestore-db";

type Patch<T> = Partial<T>;

type AdminCtx = {
  state: AdminState;
  ready: boolean;
  reset: () => void;
  log: (a: Omit<Activity, "id" | "at" | "ip" | "device">) => void;
  // users
  updateUser: (id: string, patch: Patch<AdminUser>) => void;
  deleteUser: (id: string) => void;
  adjustUserBalance: (id: string, amount: number, method: string, note: string) => void;
  sendUserMessage: (id: string, msg: Omit<UserMessage, "id" | "at">) => void;
  // agents
  addAgent: (a: Omit<Agent, "id" | "createdAt" | "lastSeen">) => Agent;
  updateAgent: (id: string, patch: Patch<Agent>) => void;
  deleteAgent: (id: string) => void;
  // partners
  addPartner: (p: Omit<Partner, "id" | "createdAt">) => Partner;
  updatePartner: (id: string, patch: Patch<Partner>) => void;
  deletePartner: (id: string) => void;
  // bets
  setBetStatus: (id: string, status: Bet["status"]) => void;
  deleteBet: (id: string) => void;
  setMatchStatus: (betId: string, matchId: string, status: BetMatch["status"]) => void;
  removeMatch: (betId: string, matchId: string) => void;
  addMatch: (betId: string, m: Omit<BetMatch, "id">) => void;
  // activities
  deleteActivity: (id: string) => void;
  updateActivity: (id: string, patch: Patch<Activity>) => void;
  clearActivities: () => void;
  // transactions
  addTransaction: (t: Omit<Transaction, "id" | "at">) => Transaction;
  updateTransaction: (id: string, patch: Patch<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  // affiliates
  addAffiliate: (a: Omit<Affiliate, "id" | "createdAt">) => Affiliate;
  updateAffiliate: (id: string, patch: Patch<Affiliate>) => void;
  deleteAffiliate: (id: string) => void;
  payAffiliate: (id: string, amount: number, method: string) => void;
  // content
  saveSlide: (bucket: "heroSlides" | "slotSlides", slide: Slide) => void;
  deleteSlide: (bucket: "heroSlides" | "slotSlides", id: string) => void;
  saveWinner: (w: Winner) => void;
  deleteWinner: (id: string) => void;
  // settings / wallet
  updateSettings: (patch: Patch<SiteSettings>) => void;
  adjustFloat: (amount: number, method: string, note: string) => void;
};

const Ctx = createContext<AdminCtx | null>(null);

const emptyState = (): AdminState => {
  const base = seedState();
  return {
    ...base,
    users: [],
    agents: [],
    partners: [],
    bets: [],
    activities: [],
    transactions: [],
    affiliates: [],
  };
};

/** Live admin store backed by Firestore collections. */
export function AdminDataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AdminState>(emptyState);
  const [ready, setReady] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const unsubs: Array<() => void> = [];
    let cancelled = false;

    void (async () => {
      const { db } = await firebase();
      if (cancelled) return;
      await ensureSiteDocs().catch(() => undefined);
      if (cancelled) return;

      const watch = <T,>(name: string, key: keyof AdminState, sort?: (a: T, b: T) => number) =>
        unsubs.push(
          onSnapshot(
            query(collection(db, name)),
            (snap) => {
              const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
              if (sort) list.sort(sort);
              setState((s) => ({ ...s, [key]: list }));
            },
            () => undefined,
          ),
        );

      watch<AdminUser>(COL.users, "users", (a, b) => b.joinedAt - a.joinedAt);
      watch<Agent>(COL.agents, "agents", (a, b) => b.createdAt - a.createdAt);
      watch<Partner>(COL.partners, "partners", (a, b) => b.createdAt - a.createdAt);
      watch<Bet>(COL.bets, "bets", (a, b) => b.placedAt - a.placedAt);
      watch<Activity>(COL.activities, "activities", (a, b) => b.at - a.at);
      watch<Transaction>(COL.transactions, "transactions", (a, b) => b.at - a.at);
      watch<Affiliate>(COL.affiliates, "affiliates", (a, b) => b.createdAt - a.createdAt);

      unsubs.push(
        onSnapshot(siteDoc(db, "content"), (snap) => {
          if (snap.exists()) setState((s) => ({ ...s, content: snap.data() as SiteContent }));
        }),
      );
      unsubs.push(
        onSnapshot(siteDoc(db, "settings"), (snap) => {
          if (snap.exists()) setState((s) => ({ ...s, settings: snap.data() as SiteSettings }));
        }),
      );
      unsubs.push(
        onSnapshot(siteDoc(db, "wallet"), (snap) => {
          if (snap.exists())
            setState((s) => ({
              ...s,
              siteFloat: (snap.data() as { siteFloat?: number }).siteFloat ?? s.siteFloat,
            }));
        }),
      );
      setReady(true);
    })().catch(() => setReady(true));

    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
    };
  }, []);

  const value = useMemo<AdminCtx>(() => {
    const run = (fn: (db: Awaited<ReturnType<typeof firebase>>["db"]) => Promise<unknown>) => {
      void firebase()
        .then(({ db }) => fn(db))
        .catch(() => undefined);
    };

    const pushAct = async (
      db: Awaited<ReturnType<typeof firebase>>["db"],
      action: string,
      target: string,
    ) => {
      const id = uid("ACT-");
      await setDoc(doc(db, COL.activities, id), {
        at: Date.now(),
        ip: "-",
        device: "Admin console",
        actorType: "admin",
        actorId: "ADMIN",
        actorName: "Administrator",
        action,
        target,
      });
    };

    const pushTx = async (
      db: Awaited<ReturnType<typeof firebase>>["db"],
      t: Omit<Transaction, "id" | "at">,
    ) => {
      const id = uid("TRX-");
      await setDoc(doc(db, COL.transactions, id), { at: Date.now(), ...t });
      return { id, at: Date.now(), ...t } as Transaction;
    };

    const findUser = (id: string) => stateRef.current.users.find((u) => u.id === id);
    const findBet = (id: string) => stateRef.current.bets.find((b) => b.id === id);

    return {
      state,
      ready,
      log: (a) =>
        run(async (db) => {
          const id = uid("ACT-");
          await setDoc(doc(db, COL.activities, id), {
            at: Date.now(),
            ip: "-",
            device: "Admin console",
            ...a,
          });
        }),
      reset: () =>
        run(async (db) => {
          const base = seedState();
          await setDoc(siteDoc(db, "content"), base.content);
          await setDoc(siteDoc(db, "settings"), base.settings);
          await pushAct(db, "Reset site content and settings", "/admin/settings");
        }),

      updateUser: (id, patch) =>
        run(async (db) => {
          await updateDoc(doc(db, COL.users, id), patch);
          await pushAct(db, "Updated user", id);
        }),
      deleteUser: (id) =>
        run(async (db) => {
          const batch = writeBatch(db);
          batch.delete(doc(db, COL.users, id));
          stateRef.current.bets
            .filter((b) => b.userId === id)
            .forEach((b) => batch.delete(doc(db, COL.bets, b.id)));
          await batch.commit();
          await pushAct(db, "Deleted user", id);
        }),
      adjustUserBalance: (id, amount, method, note) =>
        run(async (db) => {
          const user = findUser(id);
          if (!user || !amount) return;
          const applied = amount < 0 ? -Math.min(Math.abs(amount), user.balance) : amount;
          await updateDoc(doc(db, COL.users, id), {
            balance: increment(applied),
            ...(applied > 0 ? { totalIn: increment(applied) } : { totalOut: increment(-applied) }),
          });
          await updateDoc(siteDoc(db, "wallet"), { siteFloat: increment(-applied) });
          await pushTx(db, {
            kind: "Adjustment",
            amount: applied,
            method,
            actorType: "user",
            actorId: id,
            actorName: user.name,
            status: "completed",
            reference: note || (applied > 0 ? "Admin credit" : "Admin debit"),
          });
          await pushAct(
            db,
            applied > 0 ? "Credited user wallet" : "Debited user wallet",
            `${user.name} (${id})`,
          );
        }),
      sendUserMessage: (id, msg) =>
        run(async (db) => {
          const user = findUser(id);
          if (!user) return;
          const message: UserMessage = { id: uid("MSG-"), at: Date.now(), ...msg };
          await updateDoc(doc(db, COL.users, id), {
            messages: [message, ...(user.messages ?? [])].slice(0, 100),
          });
          await pushAct(db, `Sent ${msg.channel.toLowerCase()}`, `${user.name} (${id})`);
        }),

      addAgent: (a) => {
        const agent: Agent = {
          ...a,
          id: uid("AGT-"),
          createdAt: Date.now(),
          lastSeen: Date.now(),
        };
        run(async (db) => {
          const { id, ...rest } = agent;
          await setDoc(doc(db, COL.agents, id), rest);
          await pushAct(db, "Added agent", agent.name);
        });
        return agent;
      },
      updateAgent: (id, patch) =>
        run(async (db) => {
          await updateDoc(doc(db, COL.agents, id), patch);
          await pushAct(db, "Updated agent", id);
        }),
      deleteAgent: (id) =>
        run(async (db) => {
          await deleteDoc(doc(db, COL.agents, id));
          await pushAct(db, "Deleted agent", id);
        }),

      addPartner: (p) => {
        const partner: Partner = { ...p, id: uid("PTR-"), createdAt: Date.now() };
        run(async (db) => {
          const { id, ...rest } = partner;
          await setDoc(doc(db, COL.partners, id), rest);
          await pushAct(db, "Added partner", partner.company);
        });
        return partner;
      },
      updatePartner: (id, patch) =>
        run(async (db) => {
          await updateDoc(doc(db, COL.partners, id), patch);
          await pushAct(db, "Updated partner", id);
        }),
      deletePartner: (id) =>
        run(async (db) => {
          await deleteDoc(doc(db, COL.partners, id));
          await pushAct(db, "Deleted partner", id);
        }),

      setBetStatus: (id, status) =>
        run(async (db) => {
          const bet = findBet(id);
          if (!bet) return;
          const matches = bet.matches.map((m) =>
            status === "won"
              ? { ...m, status: "won" as const }
              : status === "lost" && m.status === "pending"
                ? { ...m, status: "lost" as const }
                : m,
          );
          await updateDoc(doc(db, COL.bets, id), { status, matches });
          const user = findUser(bet.userId);
          if (user && status === "won") {
            const payout = betPayout(bet);
            await updateDoc(doc(db, COL.users, user.id), { balance: increment(payout) });
            await updateDoc(siteDoc(db, "wallet"), { siteFloat: increment(-payout) });
            await pushTx(db, {
              kind: "Payout",
              amount: payout,
              method: "Bet settlement",
              actorType: "user",
              actorId: user.id,
              actorName: user.name,
              status: "completed",
              reference: bet.code,
            });
          }
          if (user && status === "cancelled") {
            await updateDoc(doc(db, COL.users, user.id), { balance: increment(bet.stake) });
            await pushTx(db, {
              kind: "Adjustment",
              amount: bet.stake,
              method: "Bet cancelled — stake refund",
              actorType: "user",
              actorId: user.id,
              actorName: user.name,
              status: "completed",
              reference: bet.code,
            });
          }
          if (user && status === "lost") {
            await updateDoc(doc(db, COL.users, user.id), {
              lostBalance: increment(bet.stake),
            });
          }
          await pushAct(db, `Marked ticket ${status}`, bet.code);
        }),
      deleteBet: (id) =>
        run(async (db) => {
          const bet = findBet(id);
          await deleteDoc(doc(db, COL.bets, id));
          await pushAct(db, "Deleted ticket", bet?.code ?? id);
        }),
      setMatchStatus: (betId, matchId, status) =>
        run(async (db) => {
          const bet = findBet(betId);
          if (!bet) return;
          await updateDoc(doc(db, COL.bets, betId), {
            matches: bet.matches.map((m) => (m.id === matchId ? { ...m, status } : m)),
          });
        }),
      removeMatch: (betId, matchId) =>
        run(async (db) => {
          const bet = findBet(betId);
          if (!bet) return;
          await updateDoc(doc(db, COL.bets, betId), {
            matches: bet.matches.filter((m) => m.id !== matchId),
          });
        }),
      addMatch: (betId, m) =>
        run(async (db) => {
          const bet = findBet(betId);
          if (!bet) return;
          await updateDoc(doc(db, COL.bets, betId), {
            matches: [...bet.matches, { id: uid("LEG-"), ...m }],
          });
        }),

      deleteActivity: (id) => run(async (db) => deleteDoc(doc(db, COL.activities, id))),
      updateActivity: (id, patch) => run(async (db) => updateDoc(doc(db, COL.activities, id), patch)),
      clearActivities: () =>
        run(async (db) => {
          const ids = stateRef.current.activities.map((a) => a.id);
          for (let i = 0; i < ids.length; i += 400) {
            const batch = writeBatch(db);
            ids.slice(i, i + 400).forEach((id) => batch.delete(doc(db, COL.activities, id)));
            await batch.commit();
          }
        }),

      addTransaction: (t) => {
        const tx: Transaction = { id: uid("TRX-"), at: Date.now(), ...t };
        run(async (db) => {
          const { id, ...rest } = tx;
          await setDoc(doc(db, COL.transactions, id), rest);
        });
        return tx;
      },
      updateTransaction: (id, patch) =>
        run(async (db) => {
          await updateDoc(doc(db, COL.transactions, id), patch);
          await pushAct(db, "Edited transaction", id);
        }),
      deleteTransaction: (id) =>
        run(async (db) => {
          await deleteDoc(doc(db, COL.transactions, id));
          await pushAct(db, "Deleted transaction", id);
        }),

      addAffiliate: (a) => {
        const aff: Affiliate = { ...a, id: uid("AFF-"), createdAt: Date.now() };
        run(async (db) => {
          const { id, ...rest } = aff;
          await setDoc(doc(db, COL.affiliates, id), rest);
          await pushAct(db, "Added affiliate", aff.name);
        });
        return aff;
      },
      updateAffiliate: (id, patch) =>
        run(async (db) => {
          await updateDoc(doc(db, COL.affiliates, id), patch);
          await pushAct(db, "Updated affiliate", id);
        }),
      deleteAffiliate: (id) =>
        run(async (db) => {
          await deleteDoc(doc(db, COL.affiliates, id));
          await pushAct(db, "Deleted affiliate", id);
        }),
      payAffiliate: (id, amount, method) =>
        run(async (db) => {
          const aff = stateRef.current.affiliates.find((a) => a.id === id);
          if (!aff || amount <= 0) return;
          await updateDoc(doc(db, COL.affiliates, id), { paidOut: increment(amount) });
          await updateDoc(siteDoc(db, "wallet"), { siteFloat: increment(-amount) });
          await pushTx(db, {
            kind: "Commission",
            amount,
            method,
            actorType: "affiliate",
            actorId: id,
            actorName: aff.name,
            status: "completed",
            reference: `Mobile money ${aff.phone}`,
          });
          await pushAct(db, "Paid affiliate commission", `${aff.name} (${aff.phone})`);
        }),

      saveSlide: (bucket, slide) =>
        run(async (db) => {
          const list = stateRef.current.content[bucket];
          const exists = list.some((x) => x.id === slide.id);
          await updateDoc(siteDoc(db, "content"), {
            [bucket]: exists ? list.map((x) => (x.id === slide.id ? slide : x)) : [...list, slide],
          });
          await pushAct(db, exists ? "Updated slide" : "Added slide", slide.title);
        }),
      deleteSlide: (bucket, id) =>
        run(async (db) => {
          await updateDoc(siteDoc(db, "content"), {
            [bucket]: stateRef.current.content[bucket].filter((x) => x.id !== id),
          });
          await pushAct(db, "Deleted slide", id);
        }),
      saveWinner: (w) =>
        run(async (db) => {
          const list = stateRef.current.content.winners;
          const exists = list.some((x) => x.id === w.id);
          await updateDoc(siteDoc(db, "content"), {
            winners: exists ? list.map((x) => (x.id === w.id ? w : x)) : [w, ...list],
          });
          await pushAct(db, exists ? "Updated winner" : "Added winner", w.name);
        }),
      deleteWinner: (id) =>
        run(async (db) => {
          await updateDoc(siteDoc(db, "content"), {
            winners: stateRef.current.content.winners.filter((x) => x.id !== id),
          });
          await pushAct(db, "Deleted winner", id);
        }),

      updateSettings: (patch) =>
        run(async (db) => {
          await updateDoc(siteDoc(db, "settings"), patch);
          await pushAct(db, "Updated site settings", "/admin/settings");
        }),
      adjustFloat: (amount, method, note) =>
        run(async (db) => {
          if (!amount) return;
          await updateDoc(siteDoc(db, "wallet"), { siteFloat: increment(amount) });
          await pushTx(db, {
            kind: amount > 0 ? "Deposit" : "Withdrawal",
            amount,
            method,
            actorType: "admin",
            actorId: "ADMIN",
            actorName: "Administrator",
            status: "completed",
            reference: note || "Site float movement",
          });
          await pushAct(db, amount > 0 ? "Site float deposit" : "Site float withdrawal", method);
        }),
    };
  }, [state, ready]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdmin() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAdmin must be used inside AdminDataProvider");
  return ctx;
}

/** Read-only live site content for public pages (hero, slots, lucky winners). */
export function useSiteContent(): { content: SiteContent; ready: boolean } {
  const [content, setContent] = useState<SiteContent>(() => ({
    heroSlides: [],
    slotSlides: [],
    winners: [],
  }));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let unsub = () => {};
    let cancelled = false;
    void firebase()
      .then(({ db }) => {
        if (cancelled) return;
        unsub = onSnapshot(
          siteDoc(db, "content"),
          (snap) => {
            if (snap.exists()) setContent(snap.data() as SiteContent);
            setReady(true);
          },
          () => setReady(true),
        );
      })
      .catch(() => setReady(true));
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return { content, ready };
}

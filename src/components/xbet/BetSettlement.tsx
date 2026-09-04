import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { doc, increment, runTransaction, updateDoc } from "firebase/firestore";
import { firebase } from "@/lib/firebase";
import { COL, pushTransaction, siteDoc } from "@/lib/firestore-db";
import { virtualResultsQuery } from "@/lib/virtual-queries";
import { getMatchSnapshots } from "@/lib/settlement.functions";
import { settleTicket, pendingFixtures } from "@/lib/settle-core";
import type { Snapshot } from "@/lib/market-grading";
import type { Sport } from "@/lib/sports-types";
import type { Bet } from "@/lib/admin-types";
import { money, useAuth } from "./AuthContext";

/**
 * Watches every unfinished ticket of the signed-in player and refreshes each
 * leg's status every second — virtual soccer from the results feed, real
 * fixtures from the provider. The same rules run in the always-on settlement
 * worker, so payouts also land while the player is offline.
 */
export function BetSettlement() {
  const { profile, rawBets, isAdmin } = useAuth();
  const busy = useRef(new Set<string>());

  // A ticket keeps updating until every leg has a final verdict, even after
  // the ticket itself is already lost — the player must see how it ended.
  const watching = useMemo(
    () =>
      rawBets.filter((b) =>
        b.matches.some((m) => m.status !== "won" && m.status !== "lost" && m.status !== "void"),
      ),
    [rawBets],
  );

  const hasVirtual = watching.some((b) => b.matches.some((m) => m.sport === "virtual"));
  const results = useQuery({ ...virtualResultsQuery(), enabled: hasVirtual && !!profile });

  const realGroups = useMemo(() => {
    const map = pendingFixtures(watching);
    map.delete("virtual");
    return [...map.entries()]
      .map(([sport, ids]) => ({ sport: sport as Sport, ids: [...ids].sort() }))
      .filter((g) => g.ids.length > 0);
  }, [watching]);

  const snapshots = useQuery({
    queryKey: ["match-snapshots", realGroups.map((g) => `${g.sport}:${g.ids.join(",")}`).join("|")],
    queryFn: async () => {
      const rows = await Promise.all(
        realGroups.map((g) => getMatchSnapshots({ data: { sport: g.sport, ids: g.ids } })),
      );
      return rows.flat();
    },
    enabled: realGroups.length > 0 && !!profile,
    refetchInterval: 10_000,
    refetchIntervalInBackground: true,
    staleTime: 5_000,
  });

  useEffect(() => {
    if (!profile || isAdmin) return;

    const map = new Map<string, Snapshot>();
    for (const r of results.data ?? []) {
      map.set(r.id, {
        started: true,
        live: false,
        finished: true,
        postponed: false,
        ft: r.ft,
        ht: r.ht,
        htDone: true,
      });
    }
    for (const s of snapshots.data ?? []) {
      map.set(s.id, {
        started: s.started,
        live: s.live,
        finished: s.finished,
        postponed: s.postponed,
        ft: s.ft,
        ht: s.ht,
        htDone: s.htDone,
        home: s.home,
        away: s.away,
      });
    }

    const apply = async (bet: Bet) => {
      const res = settleTicket(bet, map);
      if (!res.changed) return;
      busy.current.add(bet.id);
      try {
        const { db } = await firebase();
        const betRef = doc(db, COL.bets, bet.id);
        const alreadyPaid = (bet as Bet & { paid?: boolean }).paid === true;
        const finishing = res.status !== "pending" && bet.status === "pending" && !alreadyPaid;

        if (finishing && res.payout > 0) {
          // Credit once — the worker uses the same `paid` guard.
          const credited = await runTransaction(db, async (tx) => {
            const snap = await tx.get(betRef);
            if (!snap.exists() || (snap.data() as { paid?: boolean }).paid) return false;
            tx.update(betRef, {
              status: res.status,
              matches: res.matches,
              legsFinal: res.legsFinal,
              paid: true,
              settledAt: Date.now(),
            });
            tx.update(doc(db, COL.users, bet.userId), { balance: increment(res.payout) });
            return true;
          });
          if (credited) {
            await updateDoc(siteDoc(db, "wallet"), { siteFloat: increment(-res.payout) }).catch(
              () => undefined,
            );
            await pushTransaction({
              kind: "Payout",
              amount: res.payout,
              method: res.status === "cancelled" ? "Void refund" : "Auto settlement",
              actorType: "user",
              actorId: bet.userId,
              actorName: profile.name,
              status: "completed",
              reference: bet.code,
            });
            toast.success(
              res.status === "cancelled"
                ? `Ticket ${bet.code} voided — UGX ${money(res.payout)} refunded`
                : `Ticket ${bet.code} won — UGX ${money(res.payout)}`,
            );
          }
        } else {
          await updateDoc(betRef, {
            status: res.status,
            matches: res.matches,
            legsFinal: res.legsFinal,
            ...(res.status === "lost" && bet.status === "pending" ? { settledAt: Date.now() } : {}),
          });
          if (res.status === "lost" && bet.status === "pending") {
            await updateDoc(doc(db, COL.users, bet.userId), {
              lostBalance: increment(bet.stake),
            }).catch(() => undefined);
            toast.error(`Ticket ${bet.code} lost — ${res.wonLegs} won, ${res.lostLegs} lost.`);
          }
        }
      } catch {
        /* retried on the next tick */
      } finally {
        busy.current.delete(bet.id);
      }
    };

    for (const bet of watching) {
      if (busy.current.has(bet.id)) continue;
      void apply(bet);
    }
  }, [watching, results.data, snapshots.data, profile, isAdmin]);

  return null;
}

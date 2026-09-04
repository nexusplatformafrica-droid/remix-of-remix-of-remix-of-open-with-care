import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Btn, Panel, Stat } from "@/components/admin/ui";
import {
  clearSavedScores,
  deleteWorkerLedgerRows,
  previewCleanup,
  type CleanupResult,
} from "@/lib/settlement-cleanup";

export const Route = createFileRoute("/admin/cleanup")({
  component: CleanupPage,
  head: () => ({
    meta: [
      { title: "Settlement storage cleanup — BET PLUS+ admin" },
      {
        name: "description",
        content:
          "Delete the polling data the settlement worker saved on tickets and completed matches without changing any ticket status.",
      },
      { property: "og:title", content: "Settlement storage cleanup — BET PLUS+ admin" },
      {
        property: "og:description",
        content: "Free up database space saved by the always-on settlement worker.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Counts = Awaited<ReturnType<typeof previewCleanup>>;

function CleanupPage() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<CleanupResult | Counts>, done: string) => {
    setBusy(key);
    try {
      const res = await fn();
      if ("removed" in res) {
        toast.success(`${done} — ${res.removed} record(s) removed from ${res.changed} document(s).`);
        setCounts(await previewCleanup());
      } else {
        setCounts(res);
        toast.success(done);
      }
    } catch (err) {
      toast.error((err as Error).message || "Cleanup failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-2 md:space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <Stat label="Tickets" value={counts ? String(counts.tickets) : "—"} big />
        <Stat label="Settled tickets" value={counts ? String(counts.settledTickets) : "—"} tone="green" />
        <Stat
          label="Saved scores (completed)"
          value={counts ? String(counts.completedLegScores) : "—"}
          tone="primary"
        />
        <Stat
          label="Worker ledger rows"
          value={counts ? String(counts.workerLedgerRows) : "—"}
          tone="red"
        />
      </div>

      <Panel title="Settlement worker storage">
        <p className="text-[11px] leading-relaxed font-semibold text-xb-muted">
          The worker saves a live score line on every open leg while it polls. Once a match is over
          that text is dead weight and it is what filled the database. Cleaning it up
          <strong className="text-xb-text"> never changes a ticket</strong> — status, legs, odds,
          stakes, payouts and player balances all stay exactly as they are.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Btn
            onClick={() => run("scan", previewCleanup, "Scan complete")}
            disabled={busy !== null}
          >
            {busy === "scan" ? "Scanning…" : "Scan storage"}
          </Btn>
          <Btn
            tone="primary"
            disabled={busy !== null}
            onClick={() =>
              run(
                "legs",
                () => clearSavedScores("completed-legs"),
                "Saved polling data for completed matches deleted",
              )
            }
          >
            {busy === "legs" ? "Deleting…" : "Delete saved data for completed matches"}
          </Btn>
          <Btn
            tone="primary"
            disabled={busy !== null}
            onClick={() =>
              run(
                "settled",
                () => clearSavedScores("settled"),
                "Saved polling data on settled tickets deleted",
              )
            }
          >
            {busy === "settled" ? "Deleting…" : "Delete saved data on settled tickets"}
          </Btn>
        </div>
      </Panel>

      <Panel title="Danger zone">
        <p className="text-[11px] leading-relaxed font-semibold text-xb-muted">
          Deletes the log rows the worker wrote for automatic payouts and void refunds
          (“Auto settlement” / “Void refund” entries in Transactions). Tickets and wallet balances
          are not affected, but the history of those payouts is gone for good.
        </p>
        <div className="mt-3">
          <Btn
            tone="red"
            disabled={busy !== null}
            onClick={() => {
              if (!confirm("Delete all worker-written payout log rows? This cannot be undone."))
                return;
              void run("ledger", () => deleteWorkerLedgerRows(), "Worker log rows deleted");
            }}
          >
            {busy === "ledger" ? "Deleting…" : "Delete worker log rows"}
          </Btn>
        </div>
      </Panel>
    </div>
  );
}

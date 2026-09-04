import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAdmin } from "@/components/admin/AdminDataContext";
import { Btn, Field, Panel, Stat, inputCls, ugx } from "@/components/admin/ui";
import { useProviderBalances } from "@/lib/provider-float";

export const Route = createFileRoute("/admin/settings")({ component: SettingsPage });

function SettingsPage() {
  const { state, updateSettings, reset } = useAdmin();
  const { ugx: realFloat } = useProviderBalances();
  const s = state.settings;

  return (
    <div className="space-y-2 md:space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <Stat label="Site balance" value={realFloat === null ? "—" : ugx(realFloat)} tone="green" big />
        <Stat label="Maintenance" value={s.maintenanceMode ? "ON" : "OFF"} tone={s.maintenanceMode ? "red" : "green"} />
        <Stat label="Currency" value={s.currency} />
        <Stat label="Max payout" value={ugx(s.maxPayout)} tone="blue" />
      </div>

      <div className="grid gap-2 md:gap-3 xl:grid-cols-2">
        <Panel title="Brand & contact">
          <div className="grid gap-2 sm:grid-cols-2">
            {(["siteName", "tagline", "supportPhone", "supportEmail", "whatsapp", "currency", "country", "timezone", "license", "address", "mobileMoneyProviders"] as const).map((k) => (
              <Field key={k} label={k}>
                <input className={inputCls} value={String(s[k])} onChange={(e) => updateSettings({ [k]: e.target.value })} />
              </Field>
            ))}
          </div>
        </Panel>

        <Panel title="Betting & payment limits">
          <div className="grid gap-2 sm:grid-cols-2">
            {(["minStake", "maxStake", "maxPayout", "maxSelections", "minDeposit", "maxDeposit", "minWithdrawal", "maxWithdrawal", "signupBonus", "referralBonus", "withdrawalFeePct"] as const).map((k) => (
              <Field key={k} label={k}>
                <input type="number" className={inputCls} value={Number(s[k])} onChange={(e) => updateSettings({ [k]: Number(e.target.value) })} />
              </Field>
            ))}
          </div>
        </Panel>

        <Panel title="Toggles">
          <div className="grid gap-1 sm:grid-cols-2">
            {(["maintenanceMode", "registrationOpen", "liveBetting", "casinoEnabled", "virtualEnabled", "aviatorEnabled", "kycRequired", "agentPortal", "affiliateProgram"] as const).map((k) => (
              <label key={k} className="flex items-center justify-between gap-2 rounded-lg bg-xb-panel-alt px-2 py-1.5 text-[11px] font-bold text-xb-text">
                <span>{k}</span>
                <input type="checkbox" checked={Boolean(s[k])} onChange={(e) => updateSettings({ [k]: e.target.checked })} />
              </label>
            ))}
          </div>
        </Panel>

        <Panel title="Sports data provider (AllSportsAPI)">
          <Field label="allsportsApiKey">
            <input
              className={inputCls}
              value={String(s.allsportsApiKey ?? "")}
              placeholder="AllSportsAPI key"
              onChange={(e) => updateSettings({ allsportsApiKey: e.target.value.trim() })}
            />
          </Field>
          <p className="mt-1 text-[11px] text-xb-text-muted">
            Used for all countries, leagues, matches and odds. Changes apply within a minute.
          </p>
        </Panel>

        <Panel title="Danger zone">
          <p className="text-[11px] text-xb-text-muted">
            Resetting restores fresh demo data for users, agents, partners, bets, transactions and content.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Btn tone="green" onClick={() => toast.success("Settings saved")}>Save settings</Btn>
            <Btn tone="red" onClick={() => { reset(); toast.success("Admin data reset"); }}>Reset all admin data</Btn>
          </div>
        </Panel>
      </div>
    </div>
  );
}

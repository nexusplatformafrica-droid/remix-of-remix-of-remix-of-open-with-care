import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight, ChevronDown, Zap, Smartphone, Settings, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { useBetSlip } from "./BetSlipContext";
import { money, useAuth } from "./AuthContext";
import { generateAiBetSlip } from "@/lib/sports.functions";
import { betToTicket } from "@/lib/bet-ticket";
import { openTicketPdf } from "@/lib/ticket-pdf";
import { SPORTS, SPORT_LABELS, type Sport } from "@/lib/sports-types";



const countries = ["Uganda", "Kenya", "Nigeria", "Ghana", "Tanzania"];
const currencies = ["Ugandan shilling (UGX)", "Kenyan shilling (KES)", "Nigerian naira (NGN)", "US dollar (USD)"];

export function RightSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [regTab, setRegTab] = useState<"one-click" | "phone">("one-click");
  const [country, setCountry] = useState(countries[0]!);
  const [currency, setCurrency] = useState(currencies[0]!);
  const [phone, setPhone] = useState("");
  const [promo, setPromo] = useState("");
  const [password, setPassword] = useState("");
  const [slipTab, setSlipTab] = useState<"slip" | "mybets">("slip");
  const [stake, setStake] = useState("1000");
  const [genSport, setGenSport] = useState<Sport>("football");
  const [genRisk, setGenRisk] = useState<"safe" | "balanced" | "high">("balanced");
  const [genLegs, setGenLegs] = useState(3);
  const [generating, setGenerating] = useState(false);
  const [genSummary, setGenSummary] = useState("");
  const { selections, remove, clear, toggle, totalOdds } = useBetSlip();
  const { user, bets: myBets, rawBets, addBet, register: createAccount, openLogin } = useAuth();
  const runGenerator = useServerFn(generateAiBetSlip);

  const generateSlip = async () => {
    setGenerating(true);
    setGenSummary("");
    try {
      const res = await runGenerator({ data: { sport: genSport, legs: genLegs, risk: genRisk } });
      if (res.error || res.legs.length === 0) {
        toast.error(res.error || "No selections generated");
        return;
      }
      clear();
      for (const leg of res.legs) {
        toggle({
          id: leg.id,
          matchId: leg.matchId,
          event: leg.event,
          market: leg.market,
          odd: leg.odd,
        });
      }
      setGenSummary(res.summary ?? "");
      setSlipTab("slip");
      const odds = res.legs.reduce((a, l) => a * l.odd, 1);
      toast.success("Bet slip generated", {
        description: `${res.legs.length} events · total odds ${odds.toFixed(2)}`,
      });
    } catch {
      toast.error("Could not generate a bet slip");
    } finally {
      setGenerating(false);
    }
  };


  const stakeNum = Number(stake) || 0;
  const payout = stakeNum * totalOdds;

  const register = async () => {
    if (phone.trim().length < 6) {
      toast.error("Enter a valid phone number");
      return;
    }
    if (password.length < 4) {
      toast.error("Password must be at least 4 characters");
      return;
    }
    try {
      await createAccount({
        mode: regTab,
        country,
        currency,
        phone: phone.trim(),
        email: "",
        promo,
        password,
      });
      toast.success("Account created!", {
        description: `UGX 500 free bet bonus added · ${country} · ${currency}`,
      });
      setPhone("");
      setPassword("");
      setPromo("");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };


  const placeBet = async () => {
    if (!user) {
      toast.error("Log in to place a bet");
      openLogin();
      return;
    }
    if (selections.length === 0) {
      toast.error("Add at least one event to the bet slip");
      return;
    }
    if (stakeNum <= 0) {
      toast.error("Enter a stake amount");
      return;
    }
    try {
      await addBet({
        events: selections.length,
        stake: stakeNum,
        odds: totalOdds,
        matches: selections.map((s) => ({
          event: s.event,
          market: s.market,
          odd: s.odd,
          matchId: s.matchId,
          sport: s.sport,
          league: s.league,
          startsAt: s.kickoff ? Date.parse(s.kickoff) || undefined : undefined,
        })),
      });
      toast.success("Bet placed!", {
        description: `${selections.length} event(s) · possible win ${payout.toFixed(2)}`,
      });
      clear();
      setSlipTab("mybets");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };


  if (collapsed) {
    return (
      <aside className="w-[40px] shrink-0 font-xb">
        <button
          onClick={() => setCollapsed(false)}
          aria-label="Expand block"
          className="flex h-8 w-full items-center justify-center rounded-lg bg-xb-panel-alt text-xb-text-muted"
        >
          <ChevronRight className="h-4 w-4 rotate-180" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="h-full w-[262px] shrink-0 overflow-y-auto pb-4 font-xb">
      <button
        onClick={() => setCollapsed(true)}
        className="flex h-8 w-full items-center justify-center gap-1 rounded-lg bg-xb-panel-alt text-[12px] text-xb-text-muted transition-colors hover:bg-xb-odds-hover"
      >
        Collapse block <ChevronRight className="h-3 w-3" />
      </button>

      {!user && (
      <div id="registration" className="mt-2 overflow-hidden rounded-xl bg-xb-panel-alt shadow-sm">
        <div className="py-3 text-center text-[15px] font-bold tracking-wide text-xb-text">
          REGISTRATION
        </div>
        <div className="grid grid-cols-2 gap-2 px-2">
          <button
            onClick={() => setRegTab("one-click")}
            className={`flex items-center justify-center gap-1 rounded-lg py-2 text-[12px] font-medium transition-colors ${
              regTab === "one-click" ? "bg-xb-blue text-xb-on-dark" : "bg-xb-panel text-xb-text"
            }`}
          >
            <Zap className="h-3.5 w-3.5" /> One-click
          </button>
          <button
            onClick={() => setRegTab("phone")}
            className={`flex items-center justify-center gap-1 rounded-lg py-2 text-[12px] font-medium transition-colors ${
              regTab === "phone" ? "bg-xb-blue text-xb-on-dark" : "bg-xb-panel text-xb-text"
            }`}
          >
            <Smartphone className="h-3.5 w-3.5" /> By phone
          </button>
        </div>

        <div className="space-y-2 p-2">
          <div className="relative">
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full appearance-none rounded-lg bg-xb-panel px-3 py-2.5 text-[13px] text-xb-text outline-none"
            >
              {countries.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-3 h-3.5 w-3.5 text-xb-text-muted" />
          </div>
          <div className="relative">
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full appearance-none rounded-lg bg-xb-panel px-3 py-2.5 text-[13px] text-xb-text outline-none"
            >
              {currencies.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-3 h-3.5 w-3.5 text-xb-text-muted" />
          </div>
          {(
            <>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                placeholder="Phone number"
                className="w-full rounded-lg bg-xb-panel px-3 py-2.5 text-[13px] text-xb-text outline-none placeholder:text-xb-text-muted"
              />
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="new-password"
                placeholder="Password (min 4 characters)"
                className="w-full rounded-lg bg-xb-panel px-3 py-2.5 text-[13px] text-xb-text outline-none placeholder:text-xb-text-muted"
              />
            </>
          )}

          <input
            value={promo}
            onChange={(e) => setPromo(e.target.value)}
            placeholder="Promo code (if you have one)"
            className="w-full rounded-lg bg-xb-panel px-3 py-2.5 text-[13px] text-xb-text outline-none placeholder:text-xb-text-muted"
          />
          <button
            onClick={register}
            className="w-full rounded-lg bg-xb-green py-2.5 text-[13px] font-bold text-xb-on-dark transition-colors hover:bg-xb-green-dark"
          >
            REGISTER
          </button>
          <p className="px-1 text-center text-[10px] leading-relaxed text-xb-text-muted">
            By clicking this button you confirm that you have read and agree to the{" "}
            <button onClick={() => toast("Terms and Conditions")} className="text-xb-blue underline">
              Terms and Conditions
            </button>{" "}
            and{" "}
            <button onClick={() => toast("Privacy Policy")} className="text-xb-blue underline">
              Privacy Policy
            </button>{" "}
            of the company and confirm that you are of legal age.
          </p>
        </div>

        <div className="bg-xb-blue py-2.5 text-center text-[12px] font-bold text-xb-on-dark">
          100% BONUS ON YOUR 1ST DEPOSIT
        </div>
        <button
          onClick={openLogin}
          className="w-full border-t border-xb-line py-2 text-center text-[12px] text-xb-blue underline"
        >
          I already have an account — log in
        </button>
      </div>
      )}

      <div className="mt-2 overflow-hidden rounded-xl bg-xb-panel shadow-sm">
        <div className="grid grid-cols-2">
          <button
            onClick={() => setSlipTab("slip")}
            className={`border-b-2 py-2.5 text-[13px] font-bold transition-colors ${
              slipTab === "slip"
                ? "border-xb-blue bg-xb-odds text-xb-text"
                : "border-transparent text-xb-text-muted"
            }`}
          >
            Bet slip {selections.length > 0 && `(${selections.length})`}
          </button>
          <button
            onClick={() => setSlipTab("mybets")}
            className={`border-b-2 py-2.5 text-[13px] font-bold transition-colors ${
              slipTab === "mybets"
                ? "border-xb-blue bg-xb-odds text-xb-text"
                : "border-transparent text-xb-text-muted"
            }`}
          >
            My bets {myBets.length > 0 && `(${myBets.length})`}
          </button>
        </div>

        {slipTab === "slip" ? (
          <>
            <div className="flex items-center justify-between px-3 py-2 text-[12px] text-xb-text">
              YOUR BETS
              <span className="flex items-center gap-2 text-xb-text-muted">
                <button aria-label="Clear bet slip" onClick={clear}>
                  <X className="h-3.5 w-3.5 hover:text-xb-blue" />
                </button>
                <button aria-label="Bet slip settings" onClick={() => toast("Bet slip settings")}>
                  <Settings className="h-3.5 w-3.5 hover:text-xb-blue" />
                </button>
              </span>
            </div>

            {selections.length === 0 ? (
              <div className="mx-2 flex h-[120px] items-center justify-center rounded-lg border border-xb-line px-4 text-center text-[13px] text-xb-text-muted">
                Add events to the bet slip or enter a code to load events
              </div>
            ) : (
              <div className="mx-2 max-h-[180px] space-y-1 overflow-y-auto">
                {selections.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-start justify-between rounded-lg bg-xb-odds px-2 py-2 text-[12px]"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-xb-text">{s.event}</div>
                      <div className="text-[11px] text-xb-text-muted">Market {s.market}</div>
                    </div>
                    <div className="ml-2 flex shrink-0 items-center gap-2">
                      <span className="font-bold text-xb-blue">{s.odd}</span>
                      <button aria-label="Remove selection" onClick={() => remove(s.id)}>
                        <X className="h-3 w-3 text-xb-text-muted hover:text-xb-text" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2 p-2">
              <div className="flex items-center justify-between text-[12px] text-xb-text">
                <span>Total odds</span>
                <span className="font-bold">{totalOdds.toFixed(3)}</span>
              </div>
              <input
                value={stake}
                onChange={(e) => setStake(e.target.value.replace(/[^\d.]/g, ""))}
                inputMode="decimal"
                placeholder="Bet amount"
                className="w-full rounded-lg bg-xb-odds px-3 py-2.5 text-[13px] text-xb-text outline-none placeholder:text-xb-text-muted"
              />
              <div className="flex items-center justify-between text-[12px] text-xb-text">
                <span>Possible win</span>
                <span className="font-bold text-xb-green-dark">{payout.toFixed(2)}</span>
              </div>
              <button
                onClick={placeBet}
                className="w-full rounded-lg bg-xb-green py-2.5 text-[13px] font-bold text-xb-on-dark transition-colors hover:bg-xb-green-dark"
              >
                PLACE BET
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-1 p-2">
            {myBets.length === 0 ? (
              <div className="flex h-[120px] items-center justify-center rounded-lg border border-xb-line px-4 text-center text-[13px] text-xb-text-muted">
                You have no placed bets yet
              </div>
            ) : (
              myBets.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  title="Open ticket preview"
                  onClick={() => {
                    const raw = rawBets.find((x) => x.id === b.id);
                    if (!raw) return;
                    void betToTicket(raw, {
                      name: user?.label ?? "Player",
                      origin: typeof window === "undefined" ? "" : window.location.origin,
                    }).then(openTicketPdf);
                  }}
                  className={`w-full rounded-lg px-2 py-2 text-left text-[12px] text-xb-text transition-colors hover:bg-xb-odds-hover ${
                    b.status === "lost" ? "bg-xb-red/10 ring-1 ring-xb-red/40" : "bg-xb-odds"
                  }`}
                >
                  <div className="flex justify-between">
                    <span>{b.events} event(s)</span>
                    <span className="font-bold text-xb-blue">{b.odds.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-xb-text-muted">
                    <span>Stake {money(b.stake)}</span>
                    <span>Win {money(b.stake * b.odds)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span
                      className={`flex items-center gap-1 text-[10px] font-bold uppercase ${
                        b.status === "won"
                          ? "text-xb-green"
                          : b.status === "lost"
                            ? "text-xb-red"
                            : "text-xb-text-muted"
                      }`}
                    >
                      <span
                        className={`h-2.5 w-2.5 rounded-sm ${
                          b.status === "won"
                            ? "bg-xb-green"
                            : b.status === "lost"
                              ? "bg-xb-red"
                              : "bg-xb-text-muted"
                        }`}
                      />
                      {b.status === "open" ? "pending" : b.status}
                    </span>
                    <span className="text-[10px] font-bold text-xb-blue">View ticket</span>
                  </div>
                </button>
              ))

            )}
          </div>
        )}

        <button
          onClick={() => toast("Bet slip code saved", { description: "Share it to load these events." })}
          className="w-full border-t border-dashed border-xb-line py-2 text-center text-[12px] text-xb-blue underline"
        >
          Save/load events
        </button>
      </div>

      <div
        className="mt-2 rounded-xl p-4 shadow-sm"
        style={{ background: "linear-gradient(135deg, #1d4f8c, #0d2b52)" }}
      >
        <div className="flex items-start justify-between">
          <h3 className="text-[15px] font-black leading-tight text-xb-on-dark">
            BET SLIP
            <br />
            GENERATOR
          </h3>
          <Sparkles className="h-6 w-6 text-xb-on-dark" />
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-xb-on-dark-muted">
          Real fixtures, real odds — AI picks the selections for you.
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <select
            value={genSport}
            onChange={(e) => setGenSport(e.target.value as Sport)}
            className="rounded-lg bg-black/25 px-2 py-2 text-[12px] text-xb-on-dark outline-none"
          >
            {SPORTS.map((s) => (
              <option key={s} value={s} className="text-xb-text">
                {SPORT_LABELS[s]}
              </option>
            ))}
          </select>
          <select
            value={genRisk}
            onChange={(e) => setGenRisk(e.target.value as typeof genRisk)}
            className="rounded-lg bg-black/25 px-2 py-2 text-[12px] text-xb-on-dark outline-none"
          >
            <option value="safe" className="text-xb-text">Safe</option>
            <option value="balanced" className="text-xb-text">Balanced</option>
            <option value="high" className="text-xb-text">High risk</option>
          </select>
        </div>
        <label className="mt-2 block text-[11px] text-xb-on-dark-muted">
          Selections: <span className="font-bold text-xb-on-dark">{genLegs}</span>
          <input
            type="range"
            min={2}
            max={8}
            value={genLegs}
            onChange={(e) => setGenLegs(Number(e.target.value))}
            className="mt-1 w-full accent-xb-green"
          />
        </label>
        <button
          onClick={generateSlip}
          disabled={generating}
          className="mt-2 w-full rounded-lg bg-xb-green py-2.5 text-[13px] font-bold text-xb-on-dark transition-colors hover:bg-xb-green-dark disabled:opacity-60"
        >
          {generating ? "GENERATING…" : "GENERATE"}
        </button>
        {genSummary && (
          <p className="mt-2 text-[11px] leading-relaxed text-xb-on-dark-muted">{genSummary}</p>
        )}

      </div>
    </aside>
  );
}

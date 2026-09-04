import { useEffect, useMemo, useRef, useState } from "react";
import { Gift, Users, ChevronRight, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { REFERRAL_BONUS, money, useAuth } from "./AuthContext";
import { minDepositFor } from "@/lib/payments";

/** Live referral card — real code, real payout of UGX 100 per friend. */
function ReferralCard() {
  const { user, referralCode, referralLink, referralCount, openRegister } = useAuth();
  const [copied, setCopied] = useState(false);

  const share = async () => {
    if (!user) {
      openRegister();
      return;
    }
    const text = `Join me on BET PLUS+ and use my referral code ${referralCode}: ${referralLink}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "BET PLUS+ invite", text, url: referralLink });
      } else {
        await navigator.clipboard.writeText(text);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Invite link ready to share", {
        description: `You earn UGX ${money(REFERRAL_BONUS)} bonus for every friend who signs up with your code.`,
      });
    } catch {
      toast.error("Could not share your invite link");
    }
  };

  return (
    <div className="flex gap-2 px-3 py-2.5">
      <Users className="mt-0.5 h-4 w-4 shrink-0 text-xb-blue" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-bold text-xb-text">
          Refer a friend — UGX {money(REFERRAL_BONUS)}
        </p>
        <p className="mt-0.5 text-[11px] leading-snug text-xb-text-muted">
          {user
            ? `You get UGX ${money(REFERRAL_BONUS)} bonus each time a friend signs up with your code. Friends joined: ${referralCount}.`
            : `Log in to get your code and earn UGX ${money(REFERRAL_BONUS)} per friend who joins.`}
        </p>
        {user && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <code className="min-w-0 truncate rounded bg-xb-odds px-1.5 py-0.5 text-[11px] font-bold text-xb-text">
              {referralCode}
            </code>
            <span className="text-[10.5px] text-xb-text-muted">
              earned UGX {money(referralCount * REFERRAL_BONUS)}
            </span>
          </div>
        )}
      </div>
      <button
        onClick={share}
        className="flex h-7 shrink-0 items-center gap-1 self-center rounded-lg bg-xb-green px-2.5 text-[11px] font-bold text-xb-on-dark transition-colors hover:bg-xb-green-dark"
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        {user ? "Invite" : "Join"}
      </button>
    </div>
  );
}

export function BonusMenu() {
  const { currency } = useAuth();
  const [open, setOpen] = useState(false);
  const [claimed, setClaimed] = useState<string[]>([]);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // The welcome bonus equals the provider's minimum deposit for the player's
  // currency and lands automatically on the first deposit.
  const BONUSES = useMemo(
    () => [
      {
        key: "first-deposit",
        icon: Gift,
        title: `First deposit bonus ${currency} ${money(minDepositFor(currency))}`,
        body: "Credited automatically the first time you deposit. Use it as stake — winnings become withdrawable cash. The bonus itself cannot be withdrawn.",
        cta: "Auto",
      },
    ],
    [currency],
  );

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const pending = BONUSES.filter((b) => !claimed.includes(b.key)).length + 1;

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Bonuses"
        className="relative flex h-8 w-9 items-center justify-center rounded bg-white/10 text-xb-on-dark transition-colors hover:bg-white/20"
      >
        <Gift className="h-[18px] w-[18px]" />
        {pending > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-xb-green text-[10px] font-bold text-xb-on-dark">
            {pending}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[300px] overflow-hidden rounded-2xl border border-xb-line bg-xb-panel shadow-xl sm:w-[340px]">
          <div className="flex items-center justify-between bg-xb-header px-3 py-2">
            <span className="text-[13px] font-black text-xb-on-dark">MY BONUSES</span>
            <span className="rounded-full bg-xb-green px-2 py-0.5 text-[10px] font-bold text-xb-on-dark">
              {pending} available
            </span>
          </div>
          <div className="max-h-[320px] divide-y divide-xb-line overflow-y-auto">
            <ReferralCard />
            {BONUSES.map((b) => {
              const done = claimed.includes(b.key);
              return (
                <div key={b.key} className="flex gap-2 px-3 py-2.5">
                  <b.icon className="mt-0.5 h-4 w-4 shrink-0 text-xb-blue" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-bold text-xb-text">{b.title}</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-xb-text-muted">{b.body}</p>
                  </div>
                  <button
                    disabled={done}
                    onClick={() => {
                      setClaimed((c) => [...c, b.key]);
                      toast.success(`${b.title} activated`, {
                        description: "Check your bonus balance in the account menu.",
                      });
                    }}
                    className="h-7 shrink-0 self-center rounded-lg bg-xb-green px-2.5 text-[11px] font-bold text-xb-on-dark transition-colors hover:bg-xb-green-dark disabled:bg-xb-odds disabled:text-xb-text-muted"
                  >
                    {done ? "Active" : b.cta}
                  </button>
                </div>
              );
            })}
          </div>
          <button
            onClick={() => {
              setOpen(false);
              toast("Bonus terms", { description: "Wagering x3 on odds 1.50+ within 7 days." });
            }}
            className="flex w-full items-center justify-between bg-xb-panel-alt px-3 py-2 text-[11px] font-bold text-xb-text hover:bg-xb-odds"
          >
            Bonus terms &amp; conditions <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

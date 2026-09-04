import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Award,
  Dices,
  Info,
  ListOrdered,
  Menu,
  Phone,
  Receipt,
  Ticket,
  User,
} from "lucide-react";
import { SportIcon } from "./SportIcon";
import { useAuth } from "./AuthContext";
import { useBetSlip } from "./BetSlipContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MobileBetSlip } from "./MobileBetSlip";
import { useVirtualSlip } from "./virtual-slip-store";
import { SectionBody, type SectionKey } from "./AccountMenu";
import aviatorLogo from "@/assets/icons/aviator-logo.png";

const menuLinks = [
  { to: "/results", label: "Results", icon: ListOrdered },
  { to: "/lucky-winner", label: "Lucky Winner", icon: Award },
  { to: "/contact", label: "Contact Us", icon: Phone },
  { to: "/about", label: "About Us", icon: Info },
] as const;

/** Account actions that open their own float modal (independent of the header dropdown). */
const accountActions: { key: SectionKey; label: string; icon: typeof Ticket }[] = [
  { key: "bets", label: "My bets", icon: Ticket },
  { key: "deposit", label: "Deposit", icon: ArrowDownToLine },
  { key: "withdraw", label: "Withdraw", icon: ArrowUpFromLine },
  { key: "transactions", label: "Transactions", icon: Receipt },
];

export function MobileNav() {
  const { user, openLogin } = useAuth();
  const virtual = useVirtualSlip();
  const sportsCount = useBetSlip().selections.length;
  const count = virtual.active ? virtual.count : sportsCount;
  const [open, setOpen] = useState(false);
  const [slipOpen, setSlipOpen] = useState(false);
  const [section, setSection] = useState<SectionKey | null>(null);

  const itemClass =
    "flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-bold text-xb-on-dark-muted";

  const openSection = (key: SectionKey) => {
    setOpen(false);
    if (!user) {
      openLogin();
      return;
    }
    setSection(key);
  };

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 flex h-14 items-stretch justify-around border-t border-black/20 bg-xb-header md:hidden">
        <Link
          to="/"
          activeOptions={{ exact: true }}
          activeProps={{ className: "text-xb-blue-light" }}
          className={itemClass}
        >
          <SportIcon className="h-5 w-5" />
          Sports
        </Link>
        <Link to="/slot" activeProps={{ className: "text-xb-blue-light" }} className={itemClass}>
          <Dices className="h-5 w-5" />
          Casino
        </Link>
        <div className="relative flex flex-1 justify-center">
          <button
            onClick={() => (virtual.active ? virtual.open?.() : setSlipOpen(true))}
            className="absolute -top-5 flex h-14 w-14 flex-col items-center justify-center rounded-full border-4 border-xb-page bg-xb-blue text-[10px] font-bold text-xb-on-dark"
          >
            <Ticket className="h-5 w-5" />
            <span className="leading-none">Bet slip</span>
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-xb-green px-1 text-[10px] font-bold text-xb-on-dark">
                {count}
              </span>
            )}
          </button>
        </div>
        <Link to="/aviator" activeProps={{ className: "text-xb-blue-light" }} className={itemClass}>
          <img src={aviatorLogo} alt="" className="h-5 w-5 object-contain" />
          Aviator
        </Link>

        <button onClick={() => setOpen(true)} className={itemClass}>
          <Menu className="h-5 w-5" />
          Menu
        </button>
      </nav>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-72 overflow-y-auto border-xb-line bg-xb-panel p-0 font-xb"
        >
          <SheetHeader className="border-b border-xb-line px-4 py-3 text-left">
            <SheetTitle className="text-sm font-black text-xb-text">Menu</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col py-2">
            <span className="px-4 py-1 text-[10px] font-bold uppercase tracking-wide text-xb-text-muted">
              My account
            </span>
            {accountActions.map((a) => (
              <button
                key={a.key}
                onClick={() => openSection(a.key)}
                className="flex items-center gap-3 px-4 py-3 text-left text-[13px] font-medium text-xb-text hover:bg-xb-panel-alt"
              >
                <a.icon className="h-4 w-4 text-xb-green" />
                {a.label}
              </button>
            ))}
            <span className="mt-2 border-t border-xb-line px-4 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wide text-xb-text-muted">
              More
            </span>
            {menuLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-[13px] font-medium text-xb-text hover:bg-xb-panel-alt"
              >
                <l.icon className="h-4 w-4 text-xb-blue" />
                {l.label}
              </Link>
            ))}
            <button
              onClick={() => {
                setOpen(false);
                if (user) setSection("account");
                else openLogin();
              }}
              className="flex items-center gap-3 px-4 py-3 text-left text-[13px] font-medium text-xb-text hover:bg-xb-panel-alt"
            >
              <User className="h-4 w-4 text-xb-blue" />
              {user ? "Account" : "Log in"}
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={section !== null} onOpenChange={(o) => !o && setSection(null)}>
        <DialogContent className="max-h-[85vh] w-[calc(100vw-24px)] max-w-md overflow-y-auto rounded-2xl border-xb-line bg-xb-panel p-4 font-xb">
          <DialogHeader>
            <DialogTitle className="text-left text-[14px] font-black text-xb-text">
              {accountActions.find((a) => a.key === section)?.label ?? "Account"}
            </DialogTitle>
          </DialogHeader>
          {section && <SectionBody section={section} />}
        </DialogContent>
      </Dialog>

      <MobileBetSlip open={slipOpen} onOpenChange={setSlipOpen} />
    </>
  );
}

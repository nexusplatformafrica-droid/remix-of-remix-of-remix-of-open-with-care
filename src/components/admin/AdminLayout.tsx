import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  Activity as ActivityIcon,
  ArrowLeft,
  Banknote,
  Handshake,
  Image,
  LayoutDashboard,
  Menu,
  Receipt,
  Settings,
  Store,
  Ticket,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { useAdmin } from "./AdminDataContext";
import { ugx } from "./ui";
import { useProviderBalances } from "@/lib/provider-float";

const links = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/agents", label: "Agents", icon: Store },
  { to: "/admin/partners", label: "Partners", icon: Handshake },
  { to: "/admin/bets", label: "Bets", icon: Ticket },
  { to: "/admin/activities", label: "Activities", icon: ActivityIcon },
  { to: "/admin/transactions", label: "Transactions", icon: Receipt },
  { to: "/admin/wallet", label: "Wallet", icon: Banknote },
  { to: "/admin/content", label: "Contents", icon: Image },
  { to: "/admin/affiliates", label: "Affiliates", icon: UserRound },
  { to: "/admin/settings", label: "Settings", icon: Settings },
] as const;

export function AdminLayout() {
  const [open, setOpen] = useState(false);
  const { state } = useAdmin();
  const { ugx: realFloat } = useProviderBalances();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current =
    [...links].reverse().find((l) => (l.to === "/admin" ? pathname === "/admin" : pathname.startsWith(l.to)))
      ?.label ?? "Admin";

  const usersBalance = state.users.reduce((a, u) => a + u.balance, 0);

  return (
    <div className="flex min-h-[100dvh] bg-xb-page font-xb">
      {open && (
        <button
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-56 flex-col bg-xb-header transition-transform lg:sticky lg:top-0 lg:h-[100dvh] lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-[50px] shrink-0 items-center justify-between px-3">
          <Link to="/admin" className="text-lg font-black tracking-tight">
            <span className="text-xb-on-dark">BET</span>
            <span className="text-xb-blue-light">PLUS+</span>
            <span className="ml-1 text-[10px] font-bold text-xb-on-dark-muted">ADMIN</span>
          </Link>
          <button onClick={() => setOpen(false)} className="text-xb-on-dark lg:hidden">
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              activeOptions={{ exact: "exact" in l ? l.exact : false }}
              onClick={() => setOpen(false)}
              activeProps={{ className: "bg-xb-blue text-xb-on-dark" }}
              inactiveProps={{ className: "text-xb-on-dark-muted hover:bg-white/10" }}
              className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] font-bold"
            >
              <l.icon className="h-4 w-4 shrink-0" />
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-white/10 p-2">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] font-bold text-xb-on-dark-muted hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" /> Back to site
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-[50px] items-center gap-2 border-b border-xb-line bg-xb-panel px-3">
          <button onClick={() => setOpen(true)} className="text-xb-text lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-sm font-black text-xb-text">{current}</h1>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden rounded-lg bg-xb-panel-alt px-2.5 py-1 text-[10px] font-bold text-xb-text-muted sm:block">
              Players wallet <span className="text-xb-text">{ugx(usersBalance)}</span>
            </div>
            <div className="rounded-lg bg-xb-green/15 px-2.5 py-1 text-[10px] font-bold text-xb-green">
              Float {realFloat === null ? "—" : ugx(realFloat)}
            </div>
          </div>
        </header>
        <main className="min-w-0 flex-1 p-2 md:p-3">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

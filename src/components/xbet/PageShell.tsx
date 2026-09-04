import type { ReactNode } from "react";
import { Header } from "./Header";
import { MobileNav } from "./MobileNav";

export function PageShell({
  title,
  subtitle,
  fullBleed,
  children,
}: {
  title?: string | null;
  subtitle?: string;
  fullBleed?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-xb-page font-xb">
      <Header />
      <main
        className={
          fullBleed
            ? "min-h-0 w-full flex-1 overflow-hidden px-0 pb-16 pt-1 md:px-0 md:pb-0 md:pt-0"
            : "w-full flex-1 overflow-y-auto px-0 pb-16 pt-1 md:px-3 md:pb-3"
        }
      >
        {title && (
          <header className="mb-2">
            <h1 className="text-lg font-black leading-tight tracking-tight text-xb-text md:text-xl">
              {title}
            </h1>
            {subtitle && <p className="text-[11px] text-xb-text-muted md:text-xs">{subtitle}</p>}
          </header>
        )}
        {children}
      </main>
      <MobileNav />
    </div>
  );
}

export function GameWalletBar({
  balance,
  stake,
  setStake,
  disabled,
  children,
}: {
  balance: string;
  stake: number;
  setStake: (n: number) => void;
  disabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-xb-panel p-2 shadow-sm">
      <div className="text-xs text-xb-text-muted">
        Balance <span className="font-bold text-xb-text">UGX {balance}</span>
      </div>
      <label className="flex items-center gap-2 text-xs text-xb-text-muted">
        Stake
        <input
          type="number"
          min={100}
          step={100}
          value={stake}
          disabled={disabled}
          onChange={(e) => setStake(Math.max(0, Number(e.target.value)))}
          className="w-24 rounded-lg border border-xb-line bg-xb-panel-alt px-2 py-1 text-xs font-bold text-xb-text outline-none focus:border-xb-blue"
        />
      </label>
      {[500, 1000, 5000].map((v) => (
        <button
          key={v}
          disabled={disabled}
          onClick={() => setStake(v)}
          className="rounded-full bg-xb-odds px-3 py-1 text-xs font-bold text-xb-text hover:bg-xb-odds-hover disabled:opacity-50"
        >
          {v.toLocaleString()}
        </button>
      ))}
      <div className="ml-auto flex items-center gap-2">{children}</div>
    </div>
  );
}

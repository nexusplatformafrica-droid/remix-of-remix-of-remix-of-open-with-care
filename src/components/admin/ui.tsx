import { Link } from "@tanstack/react-router";
import type { ComponentType, ReactNode } from "react";

export function money(n: number): string {
  const sign = n < 0 ? "-" : "";
  return sign + Math.abs(Math.round(n)).toLocaleString("en-US");
}

export function ugx(n: number): string {
  return `UGX ${money(n)}`;
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const abs = Math.abs(diff);
  const m = Math.round(abs / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ${diff < 0 ? "from now" : "ago"}`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ${diff < 0 ? "from now" : "ago"}`;
  const d = Math.round(h / 24);
  return `${d}d ${diff < 0 ? "from now" : "ago"}`;
}

export function dateTime(ts: number): string {
  return new Date(ts).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl bg-xb-panel shadow-sm ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-2 border-b border-xb-line px-3 py-2">
          {title && (
            <h2 className="text-[12px] font-black uppercase tracking-wide text-xb-text">{title}</h2>
          )}
          {action}
        </header>
      )}
      <div className="p-3">{children}</div>
    </section>
  );
}

export function Stat({
  label,
  value,
  sub,
  icon: Icon,
  tone = "neutral",
  big,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: ComponentType<{ className?: string }>;
  tone?: "neutral" | "green" | "red" | "blue";
  big?: boolean;
}) {
  const toneCls =
    tone === "green"
      ? "text-xb-green"
      : tone === "red"
        ? "text-xb-red"
        : tone === "blue"
          ? "text-xb-blue"
          : "text-xb-text";
  return (
    <div className="rounded-xl bg-xb-panel p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wide text-xb-text-muted">
          {label}
        </span>
        {Icon && <Icon className="h-3.5 w-3.5 text-xb-text-muted" />}
      </div>
      <div
        className={`mt-1 font-black leading-tight ${toneCls} ${big ? "text-2xl md:text-3xl" : "text-base md:text-lg"}`}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[10px] text-xb-text-muted">{sub}</div>}
    </div>
  );
}

const badgeMap: Record<string, string> = {
  active: "bg-xb-green/15 text-xb-green",
  won: "bg-xb-green/15 text-xb-green",
  completed: "bg-xb-green/15 text-xb-green",
  pending: "bg-amber-500/15 text-amber-600",
  Partnership: "bg-xb-blue/15 text-xb-blue",
  Sale: "bg-amber-500/15 text-amber-600",
  lost: "bg-xb-red/15 text-xb-red",
  failed: "bg-xb-red/15 text-xb-red",
  blocked: "bg-xb-red/15 text-xb-red",
  suspended: "bg-xb-red/15 text-xb-red",
  cancelled: "bg-xb-text-muted/15 text-xb-text-muted",
  void: "bg-xb-text-muted/15 text-xb-text-muted",
  ended: "bg-xb-text-muted/15 text-xb-text-muted",
};

export function Badge({ value, className = "" }: { value: string; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${badgeMap[value] ?? "bg-xb-odds text-xb-text"} ${className}`}
    >
      {value}
    </span>
  );
}

export function Btn({
  children,
  onClick,
  tone = "default",
  size = "sm",
  disabled,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "default" | "primary" | "green" | "red" | "ghost";
  size?: "sm" | "xs";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  const tones: Record<string, string> = {
    default: "bg-xb-odds text-xb-text hover:bg-xb-odds-hover",
    primary: "bg-xb-blue text-xb-on-dark hover:opacity-90",
    green: "bg-xb-green text-xb-on-dark hover:bg-xb-green-dark",
    red: "bg-xb-red text-xb-on-dark hover:opacity-90",
    ghost: "bg-transparent text-xb-text-muted hover:bg-xb-odds",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1 rounded-lg font-bold transition-colors disabled:opacity-40 ${
        size === "xs" ? "h-6 px-2 text-[10px]" : "h-8 px-3 text-[11px]"
      } ${tones[tone]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-xb-text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

export const inputCls =
  "w-full rounded-lg border border-xb-line bg-xb-panel-alt px-2 py-1.5 text-[12px] font-medium text-xb-text outline-none focus:border-xb-blue";

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-2 rounded-lg bg-xb-panel-alt px-2.5 py-2 text-left"
    >
      <span className="text-[11px] font-bold text-xb-text">{label}</span>
      <span
        className={`relative h-4 w-8 shrink-0 rounded-full transition-colors ${checked ? "bg-xb-green" : "bg-xb-line"}`}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${checked ? "left-4" : "left-0.5"}`}
        />
      </span>
    </button>
  );
}

export function Table({
  head,
  children,
}: {
  head: readonly string[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left text-[11px]">
        <thead>
          <tr className="border-b border-xb-line">
            {head.map((h) => (
              <th
                key={h}
                className="whitespace-nowrap px-2 py-2 text-[10px] font-black uppercase tracking-wide text-xb-text-muted"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: readonly T[];
  active: T;
  onChange: (t: T) => void;
}) {
  return (
    <div className="xb-noscroll flex gap-1 overflow-x-auto rounded-xl bg-xb-panel p-1 shadow-sm">
      {tabs.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-bold capitalize transition-colors ${
            active === t ? "bg-xb-blue text-xb-on-dark" : "text-xb-text-muted hover:bg-xb-odds"
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return <div className="py-8 text-center text-[11px] text-xb-text-muted">{text}</div>;
}

export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1 text-[11px] font-bold text-xb-blue hover:underline"
    >
      ← {label}
    </Link>
  );
}

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

import { Link } from "@tanstack/react-router";
import { BarChart3, Goal, Shield, Users } from "lucide-react";
import type { Sport } from "@/lib/sports-types";

/**
 * Stats shortcuts (Standings / Top scorers / Teams / Players) presented as a
 * gradient tile block, used both in the desktop sidebar and the mobile menu.
 */
export function StatsLinks({
  sport,
  onNavigate,
  className = "",
}: {
  sport: Sport;
  onNavigate?: () => void;
  className?: string;
}) {
  const tile =
    "flex items-center gap-2 rounded-lg bg-white/10 px-2.5 py-2 text-[12px] font-bold text-xb-on-dark backdrop-blur-sm transition-colors hover:bg-white/20";

  return (
    <div
      className={`rounded-xl bg-gradient-to-br from-xb-blue via-xb-blue-light to-xb-green p-2.5 shadow-sm ${className}`}
    >
      <div className="mb-2 px-0.5 text-[10px] font-black uppercase tracking-wider text-xb-on-dark/80">
        Stats &amp; tables
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <Link to="/standings" search={{ sport }} onClick={onNavigate} className={tile}>
          <BarChart3 className="h-3.5 w-3.5 shrink-0" />
          Standings
        </Link>
        <Link to="/topscorers" search={{ sport }} onClick={onNavigate} className={tile}>
          <Goal className="h-3.5 w-3.5 shrink-0" />
          Top scorers
        </Link>
        <Link to="/teams" search={{ sport }} onClick={onNavigate} className={tile}>
          <Shield className="h-3.5 w-3.5 shrink-0" />
          Teams
        </Link>
        <Link to="/players" onClick={onNavigate} className={tile}>
          <Users className="h-3.5 w-3.5 shrink-0" />
          Players
        </Link>
      </div>
    </div>
  );
}

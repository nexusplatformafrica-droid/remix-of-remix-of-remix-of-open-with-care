import { useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, ChevronLeft, Check, X, Star } from "lucide-react";
import { useSportFilters } from "./SportFilterContext";
import { leaguesQuery, type League } from "@/lib/sports-queries";
import { SPORT_LABELS } from "@/lib/sports-types";
import { countryRank, leagueRank } from "@/lib/popular";
import { TOP_COMPETITIONS, TOP_BET_PRESETS, pickMatches, type TopPick } from "@/lib/top-picks";
import blueBanner from "@/assets/blue-banner.jpg";

/** Countries as a compact strip — rendered inside the blue sports bar. */
export function CountryFilterStrip() {
  const { sport, countryIds, toggleCountry, clearFilters } = useSportFilters();
  const leagues = useQuery(leaguesQuery(sport));
  const all = leagues.data ?? [];

  const countries = useMemo(() => {
    const map = new Map<number, { key: number; name: string; logo: string | null }>();
    for (const l of all) {
      if (!l.country) continue;
      if (!map.has(l.countryKey)) {
        map.set(l.countryKey, { key: l.countryKey, name: l.country, logo: l.countryLogo });
      }
    }
    return [...map.values()].sort(
      (a, b) => countryRank(a.name) - countryRank(b.name) || a.name.localeCompare(b.name),
    );
  }, [all]);

  if (countries.length === 0) return null;

  return (
    <div className="xb-noscroll flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
      <button
        onClick={clearFilters}
        className={`shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-bold transition-colors ${
          countryIds.length === 0
            ? "bg-xb-on-dark/15 text-xb-on-dark"
            : "text-xb-on-dark-muted hover:text-xb-on-dark"
        }`}
      >
        All countries
      </button>
      {countries.map((c) => {
        const on = countryIds.includes(c.key);
        return (
          <button
            key={c.key}
            onClick={() => toggleCountry(c.key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-bold transition-colors ${
              on
                ? "bg-xb-on-dark/15 text-xb-on-dark"
                : "text-xb-on-dark-muted hover:text-xb-on-dark"
            }`}
          >
            {on ? (
              <Check className="h-3 w-3" />
            ) : c.logo ? (
              <img src={c.logo} alt="" className="h-3 w-4 rounded-sm object-cover" loading="lazy" />
            ) : null}
            <span className="whitespace-nowrap">{c.name}</span>
          </button>
        );
      })}
    </div>
  );
}

function Scroller({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const nudge = (dir: number) => ref.current?.scrollBy({ left: dir * 320, behavior: "smooth" });
  return (
    <div className="relative">
      <div ref={ref} className="flex gap-2 overflow-x-auto scroll-smooth px-0.5 py-1.5 scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
      <button
        aria-label="Scroll left"
        onClick={() => nudge(-1)}
        className="absolute left-0 top-1/2 hidden h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-xb-bar text-xb-on-dark-muted shadow ring-1 ring-xb-bar-line hover:text-xb-on-dark md:flex"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>
      <button
        aria-label="Scroll right"
        onClick={() => nudge(1)}
        className="absolute right-0 top-1/2 hidden h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-xb-bar text-xb-on-dark-muted shadow ring-1 ring-xb-bar-line hover:text-xb-on-dark md:flex"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function LeagueFilterBar() {
  const { sport, scope, leagueIds, countryIds, toggleLeague, setLeagues, toggleCountry, setSport, clearFilters } =
    useSportFilters();
  const leagues = useQuery(leaguesQuery(sport));

  const all = leagues.data ?? [];
  const selectedCount = leagueIds.length + countryIds.length;

  const picks: TopPick[] = scope === "topbets" ? TOP_BET_PRESETS : TOP_COMPETITIONS;
  const pickKeys = (p: TopPick) =>
    all.filter((l) => pickMatches(p, { name: l.name, country: l.country })).map((l) => l.key);
  const pickActive = (p: TopPick) => {
    const keys = pickKeys(p);
    return keys.length > 0 && keys.every((k) => leagueIds.includes(k));
  };

  const countries = useMemo(() => {
    const map = new Map<number, { key: number; name: string; logo: string | null }>();
    for (const l of all) {
      if (!l.country) continue;
      if (!map.has(l.countryKey)) {
        map.set(l.countryKey, { key: l.countryKey, name: l.country, logo: l.countryLogo });
      }
    }
    return [...map.values()].sort(
      (a, b) => countryRank(a.name) - countryRank(b.name) || a.name.localeCompare(b.name),
    );
  }, [all]);

  const activeCountries = countries.filter((c) => countryIds.includes(c.key));

  const shown: League[] = useMemo(() => {
    const list =
      countryIds.length > 0 ? all.filter((l) => countryIds.includes(l.countryKey)) : all;
    const selected = all.filter((l) => leagueIds.includes(l.key));
    const rest = [...list]
      .filter((l) => !leagueIds.includes(l.key))
      .sort(
        (a, b) =>
          leagueRank(sport, a.name, a.country) - leagueRank(sport, b.name, b.country) ||
          a.name.localeCompare(b.name),
      )
      .slice(0, countryIds.length > 0 ? 400 : 40);
    return [...selected, ...rest];
  }, [all, countryIds, leagueIds, sport]);

  if (all.length === 0) return null;

  return (
    <div
      className="relative border-b border-xb-line bg-xb-bar-alt bg-cover bg-center px-2 py-2"
      style={{ backgroundImage: `url(${blueBanner})` }}
    >
      <div className="absolute inset-0 bg-xb-bar-alt/80" />
      <div className="relative">
        <div className="mb-1.5 flex items-center gap-2 px-1">
          <span className="text-[11px] font-black uppercase tracking-[0.18em] text-xb-on-dark">
            {activeCountries.length > 0
              ? `${activeCountries.map((c) => c.name).join(", ")} leagues`
              : scope === "topbets"
                ? "Top Bets"
                : "Top competitions"}
          </span>
          {selectedCount > 0 && (
            <button
              onClick={clearFilters}
              className="ml-auto inline-flex items-center gap-1 rounded-full bg-xb-on-dark/15 px-2 py-0.5 text-[10px] font-bold text-xb-on-dark hover:bg-xb-on-dark/25"
            >
              <X className="h-3 w-3" /> Clear {selectedCount} filter{selectedCount > 1 ? "s" : ""}
            </button>
          )}
        </div>
        <Scroller>
          {activeCountries.length === 0 &&
            picks.map((p) => {
              const on = pickActive(p);
              const wrongSport = p.sport !== sport;
              const [head, ...tail] = p.label.split(". ");
              const title = tail.length > 0 ? tail.join(". ") : head;
              const sub = tail.length > 0 ? head : SPORT_LABELS[p.sport];
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    if (wrongSport) {
                      setSport(p.sport);
                      return;
                    }
                    const keys = pickKeys(p);
                    if (keys.length === 0) {
                      // The provider may name this competition differently:
                      // never leave the tile dead — open the whole country.
                      const country = all.find((l) => p.country?.test(l.country));
                      if (country) toggleCountry(country.countryKey);
                      return;
                    }
                    setLeagues(on ? [] : keys);

                  }}
                  className={`group relative flex h-11 w-[190px] shrink-0 items-center gap-2 overflow-hidden rounded-md px-2.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] ring-1 transition-all hover:-translate-y-px ${
                    on
                      ? "bg-xb-blue-light/90 ring-xb-bar-accent"
                      : "bg-xb-bar/80 ring-xb-bar-line hover:bg-xb-bar"
                  }`}
                >
                  <span
                    className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-30"
                    style={{ backgroundImage: `url(${blueBanner})` }}
                  />
                  {on ? (
                    <Check className="relative h-4 w-4 shrink-0 text-xb-on-dark" />
                  ) : (
                    <Star className="relative h-4 w-4 shrink-0 text-xb-bar-accent" />
                  )}
                  <span className="relative min-w-0">
                    <span className="block truncate text-[11.5px] font-black leading-tight text-xb-on-dark">
                      {title}
                    </span>
                    <span className="block truncate text-[9.5px] leading-tight text-xb-on-dark-muted">
                      {sub}
                    </span>
                  </span>
                </button>
              );
            })}
          {activeCountries.length === 0 && (
            <span className="mx-1 h-11 w-px shrink-0 self-center bg-xb-bar-line" />
          )}
          {shown.map((l) => {
            const on = leagueIds.includes(l.key);
            return (
              <button
                key={l.key}
                onClick={() => toggleLeague(l.key)}
                className={`group relative flex h-11 w-[190px] shrink-0 items-center gap-2 overflow-hidden rounded-md px-2.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] ring-1 transition-all hover:-translate-y-px ${
                  on
                    ? "bg-xb-blue-light/90 ring-xb-bar-accent"
                    : "bg-xb-bar/80 ring-xb-bar-line hover:bg-xb-bar"
                }`}
              >
                <span
                  className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-30"
                  style={{ backgroundImage: `url(${blueBanner})` }}
                />
                {on ? (
                  <Check className="relative h-4 w-4 shrink-0 text-xb-on-dark" />
                ) : l.logo ? (
                  <img
                    src={l.logo}
                    alt=""
                    className="relative h-6 w-6 shrink-0 rounded-full bg-xb-on-dark/10 object-contain p-0.5"
                    loading="lazy"
                  />
                ) : (
                  <span className="relative h-6 w-6 shrink-0 rounded-full bg-xb-on-dark/10" />
                )}
                <span className="relative min-w-0">
                  <span className="block truncate text-[11.5px] font-black leading-tight text-xb-on-dark">
                    {l.name}
                  </span>
                  <span className="block truncate text-[9.5px] leading-tight text-xb-on-dark-muted">
                    {l.country || "International"}
                  </span>
                </span>
              </button>
            );
          })}
        </Scroller>
      </div>
    </div>
  );
}

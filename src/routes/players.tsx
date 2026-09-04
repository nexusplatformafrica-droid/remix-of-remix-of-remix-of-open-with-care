import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { PageShell } from "@/components/xbet/PageShell";
import { playerSearchQuery } from "@/lib/sports-queries";
import { SPORTS, SPORT_LABELS, type Sport } from "@/lib/sports-types";

export const Route = createFileRoute("/players")({
  head: () => ({
    meta: [
      { title: "Player Search & Season Statistics — BET PLUS+" },
      {
        name: "description",
        content:
          "Search any player and see their club, position, appearances, goals, assists and disciplinary record for the current season.",
      },
      { property: "og:title", content: "Player Search & Season Statistics — BET PLUS+" },
      {
        property: "og:description",
        content: "Look up player form and stats before you place your bet.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/players" }],
  }),
  component: PlayersPage,
});

function PlayersPage() {
  const [sport, setSport] = useState<Sport>("football");
  const [term, setTerm] = useState("");
  const players = useQuery(playerSearchQuery(sport, term));

  return (
    <PageShell title="Players" subtitle="Search any player for season statistics">
      <div className="overflow-hidden rounded-xl bg-xb-panel shadow-sm">
        <div className="flex gap-1 border-b border-xb-line p-1">
          {SPORTS.map((s: Sport) => (
            <button
              key={s}
              onClick={() => setSport(s)}
              className={`flex-1 rounded-lg py-1.5 text-[12px] font-bold transition-colors ${
                sport === s ? "bg-xb-blue text-white" : "text-xb-text-muted hover:bg-xb-odds"
              }`}
            >
              {SPORT_LABELS[s]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 border-b border-xb-line px-3 py-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-xb-text-muted" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Type at least 3 letters of a player name"
            className="w-full bg-transparent text-[13px] text-xb-text outline-none placeholder:text-xb-text-muted"
          />
        </div>

        {term.trim().length < 3 && (
          <div className="px-3 py-6 text-[13px] text-xb-text-muted">
            Start typing to search the player database.
          </div>
        )}
        {term.trim().length >= 3 && players.isLoading && (
          <div className="px-3 py-6 text-[13px] text-xb-text-muted">Searching…</div>
        )}
        {term.trim().length >= 3 && !players.isLoading && (players.data?.length ?? 0) === 0 && (
          <div className="px-3 py-6 text-[13px] text-xb-text-muted">No player found.</div>
        )}

        {players.data?.map((p, i) => (
          <div
            key={`${p.key}-${i}`}
            className="flex items-center gap-3 border-b border-xb-line px-3 py-2"
          >
            {p.image ? (
              <img
                src={p.image}
                alt={p.name}
                loading="lazy"
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <span className="h-8 w-8 rounded-full bg-xb-odds" />
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium text-xb-text">{p.name}</div>
              <div className="truncate text-[11px] text-xb-text-muted">
                {p.teamKey ? (
                  <Link
                    to="/team/$sport/$teamId"
                    params={{ sport, teamId: String(p.teamKey) }}
                    className="hover:underline"
                  >
                    {p.team}
                  </Link>
                ) : (
                  p.team
                )}
                {p.position ? ` · ${p.position}` : ""}
                {p.age ? ` · ${p.age}y` : ""}
              </div>
            </div>
            <div className="shrink-0 text-right text-[11px] text-xb-text-muted">
              <div className="text-[13px] font-bold text-xb-text">{p.goals}g</div>
              {p.assists}a · {p.matches} apps
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}

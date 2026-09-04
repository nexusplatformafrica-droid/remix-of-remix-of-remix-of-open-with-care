import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Star,
  Share2,
  MessageCircle,
  ThumbsUp,
  PartyPopper,
  FileDown,
  Send,
} from "lucide-react";
import { money } from "@/components/xbet/AuthContext";
import { openTicketPdf, type LegStatus } from "@/lib/ticket-pdf";
import type { Winner } from "@/lib/admin-types";
import { toast } from "sonner";

export function formatDate(at: number) {
  return new Date(at).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Comment = { id: string; author: string; text: string; at: number };

const LIKES_KEY = "xb.ticket.likes";
const COMMENTS_KEY = "xb.ticket.comments";

function readStore<T>(key: string): Record<string, T> {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, T>;
  } catch {
    return {};
  }
}
function writeStore(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

/** Derives the money figures of a published winner's ticket. */
export function ticketOf(w: Winner | null) {
  if (!w?.ticket) return null;
  const odds = w.ticket.legs.reduce((a, l) => a * (l.odds || 1), 1);
  const potential = Math.round(w.ticket.stake * odds * 100) / 100;
  const bonus = Math.round(((potential * (w.ticket.bonusPct || 0)) / 100) * 100) / 100;
  return {
    stake: w.ticket.stake,
    odds,
    potential,
    bonus,
    payout: potential + bonus,
    legs: w.ticket.legs,
    betId: w.ticket.betId,
  };
}

const legTone = (s: LegStatus) =>
  s === "won" ? "bg-xb-green" : s === "lost" ? "bg-xb-red" : "bg-xb-text-muted";

/** Winner photo, payout summary and their quote. */
export function WinnerDetailsSection({ featured }: { featured: Winner | null }) {
  return (
    <>
      <div className="h-[190px] shrink-0 overflow-hidden rounded-xl bg-gradient-to-b from-xb-blue/10 to-xb-panel md:h-[240px]">
        {featured?.image ? (
          <img
            src={featured.image}
            alt={`${featured.name} celebrating their win`}
            className="block h-full w-full object-fill"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-[12px] text-xb-text-muted">
            No winner photo published
          </div>
        )}
      </div>

      <div className="rounded-xl bg-xb-panel-alt p-3">
        <p className="text-[10px] uppercase tracking-wide text-xb-text-muted">Winner</p>
        <p className="text-xl font-black leading-tight text-xb-text">{featured?.name ?? "—"}</p>
        <p className="mt-1 text-[10px] uppercase tracking-wide text-xb-text-muted">Win amount</p>
        <p className="text-2xl font-black text-xb-green">
          UGX {featured ? money(featured.amount) : "—"}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold text-xb-text">
          <span className="rounded-full bg-xb-odds px-2 py-0.5">
            {featured?.game ?? "Sports multibet"}
          </span>
          <span className="rounded-full bg-xb-odds px-2 py-0.5">
            {featured ? formatDate(featured.at) : "—"}
          </span>
          {featured?.location && (
            <span className="rounded-full bg-xb-odds px-2 py-0.5">{featured.location}</span>
          )}
        </div>
      </div>

      <div className="rounded-xl bg-xb-panel-alt p-3">
        <div className="mb-2 flex items-center gap-2">
          <Star className="h-4 w-4 text-xb-green" />
          <h3 className="text-[11px] font-bold uppercase text-xb-text-muted">Winner talk</h3>
        </div>
        <blockquote className="border-l-2 border-xb-green pl-3 text-[13px] italic text-xb-text">
          {featured?.quote?.trim()
            ? `“${featured.quote}”`
            : "This winner has not shared a message yet."}
        </blockquote>
      </div>
    </>
  );
}

/** Full winning ticket with PDF, share, like and comment actions. */
export function WinnerTicketSection({ featured }: { featured: Winner | null }) {
  const [likes, setLikes] = useState<Record<string, number>>({});
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [showComments, setShowComments] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setLikes(readStore<number>(LIKES_KEY));
    setComments(readStore<Comment[]>(COMMENTS_KEY));
  }, []);

  const ticket = useMemo(() => ticketOf(featured), [featured]);
  const betId = ticket?.betId || (featured ? featured.id.slice(0, 10).toUpperCase() : "");

  const ticketUrl = useMemo(() => {
    if (!featured || typeof window === "undefined") return "";
    return `${window.location.origin}/winner-ticket/${encodeURIComponent(featured.id)}`;
  }, [featured]);

  const barcodeValue = useMemo(
    () => (betId ? `BP${betId.replace(/[^a-z0-9]/gi, "").slice(0, 10).toUpperCase()}` : ""),
    [betId],
  );

  const ticketComments = featured ? (comments[featured.id] ?? []) : [];
  const likeCount = featured ? (likes[featured.id] ?? 0) : 0;
  const isLiked = featured ? !!liked[featured.id] : false;

  const onShare = useCallback(async () => {
    if (!featured || !ticketUrl) return;
    const payload = {
      title: `BET PLUS+ winning ticket ${betId}`,
      text: `${featured.name} won UGX ${money(featured.amount)} on ${featured.game ?? "BET PLUS+"}!`,
      url: ticketUrl,
    };
    try {
      if (navigator.share) {
        await navigator.share(payload);
        return;
      }
      await navigator.clipboard.writeText(`${payload.text} ${ticketUrl}`);
      toast.success("Ticket link copied to clipboard");
    } catch {
      toast.error("Could not share this ticket");
    }
  }, [betId, featured, ticketUrl]);

  const onLike = useCallback(() => {
    if (!featured) return;
    const id = featured.id;
    const nowLiked = !liked[id];
    setLiked((l) => ({ ...l, [id]: nowLiked }));
    setLikes((prev) => {
      const next = { ...prev, [id]: Math.max(0, (prev[id] ?? 0) + (nowLiked ? 1 : -1)) };
      writeStore(LIKES_KEY, next);
      return next;
    });
  }, [featured, liked]);

  const onComment = useCallback(() => {
    if (!featured || !draft.trim()) return;
    const id = featured.id;
    const entry: Comment = {
      id: Math.random().toString(36).slice(2),
      author: "You",
      text: draft.trim(),
      at: Date.now(),
    };
    setComments((prev) => {
      const next = { ...prev, [id]: [...(prev[id] ?? []), entry] };
      writeStore(COMMENTS_KEY, next);
      return next;
    });
    setDraft("");
    toast.success("Comment posted");
  }, [draft, featured]);

  return (
    <>
      <header className="shrink-0 border-b border-xb-line px-3 py-2">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <h2 className="min-w-0 truncate text-[12px] font-black uppercase tracking-wide text-xb-text">
            BET ID #{betId || "—"}
          </h2>
          <div className="no-print flex shrink-0 items-center gap-1">
            <button
              type="button"
              disabled={!featured || !ticket}
              onClick={() => {
                if (!featured || !ticket) return;
                void openTicketPdf({
                  betId,
                  winner: featured.name,
                  game: featured.game ?? "Sports multibet",
                  date: formatDate(featured.at),
                  odds: ticket.odds.toFixed(2),
                  stake: money(ticket.stake),
                  potential: money(ticket.potential),
                  bonus: money(ticket.bonus),
                  payout: money(ticket.payout),
                  status: "won",
                  legs: ticket.legs.map((l) => ({
                    time: l.time,
                    teams: l.teams,
                    league: l.league,
                    market: l.market,
                    odds: l.odds.toFixed(2),
                    score: l.score,
                    status: l.status,
                  })),
                  ticketUrl,
                  barcodeValue,
                });
              }}
              className="flex items-center gap-1 rounded-full bg-xb-blue px-2.5 py-1 text-[10px] font-bold text-xb-on-dark transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <FileDown className="h-3 w-3" />
              PDF
            </button>
            <button
              type="button"
              disabled={!featured}
              onClick={() => void onShare()}
              aria-label="Share ticket"
              className="flex h-7 items-center gap-1 rounded-full bg-xb-odds px-2 text-[10px] font-bold text-xb-text transition-colors hover:bg-xb-odds-hover hover:text-xb-blue disabled:opacity-50"
            >
              <Share2 className="h-3.5 w-3.5" />
              Share
            </button>
            <button
              type="button"
              disabled={!featured}
              onClick={() => setShowComments((v) => !v)}
              aria-label="Comment on ticket"
              aria-expanded={showComments}
              className={`flex h-7 items-center gap-1 rounded-full px-2 text-[10px] font-bold transition-colors disabled:opacity-50 ${
                showComments
                  ? "bg-xb-blue text-xb-on-dark"
                  : "bg-xb-odds text-xb-text hover:bg-xb-odds-hover hover:text-xb-blue"
              }`}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              {ticketComments.length}
            </button>
            <button
              type="button"
              disabled={!featured}
              onClick={onLike}
              aria-label="Like ticket"
              aria-pressed={isLiked}
              className={`flex h-7 items-center gap-1 rounded-full px-2 text-[10px] font-bold transition-colors disabled:opacity-50 ${
                isLiked
                  ? "bg-xb-green text-xb-on-dark"
                  : "bg-xb-odds text-xb-text hover:bg-xb-odds-hover hover:text-xb-blue"
              }`}
            >
              <ThumbsUp className="h-3.5 w-3.5" />
              {likeCount}
            </button>
          </div>
        </div>
      </header>

      <div data-ticket-scroll className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex items-center gap-3 border-b border-xb-line bg-gradient-to-r from-xb-blue/10 to-xb-green/10 px-3 py-3">
          <PartyPopper className="h-8 w-8 shrink-0 text-xb-green" />
          <div className="min-w-0">
            <p className="text-[11px] text-xb-text-muted">Congratulations on</p>
            <p className="truncate text-[15px] font-black text-xb-text">
              WINNING BIG UGX{" "}
              {ticket ? money(ticket.payout) : featured ? money(featured.amount) : "—"}
            </p>
          </div>
        </div>

        {!ticket ? (
          <p className="p-4 text-center text-[12px] text-xb-text-muted">
            {featured ? "No ticket was attached to this win." : "Select a winner to see their ticket."}
          </p>
        ) : (
          <>
            <dl className="m-2 divide-y divide-xb-line rounded-lg border border-xb-blue/40 bg-xb-panel-alt px-3">
              {[
                ["Odds:", ticket.odds.toFixed(2)],
                ["Stake:", `UGX ${money(ticket.stake)}`],
                ["Potential Winnings:", `UGX ${money(ticket.potential)}`],
                ["Win Bonus:", `UGX ${money(ticket.bonus)}`],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-2 py-1.5 text-[12px]">
                  <dt className="text-xb-text-muted">{k}</dt>
                  <dd className="font-bold text-xb-text">{v}</dd>
                </div>
              ))}
              <div className="flex items-center justify-between gap-2 py-2 text-[12px]">
                <dt className="font-bold text-xb-text">Payout:</dt>
                <dd className="font-black text-xb-green">WON UGX {money(ticket.payout)}</dd>
              </div>
            </dl>

            {showComments && (
              <div className="border-y border-xb-line bg-xb-panel-alt p-3">
                <ul className="mb-2 space-y-1.5">
                  {ticketComments.length === 0 && (
                    <li className="text-[11px] text-xb-text-muted">
                      No comments yet — be the first to congratulate {featured?.name ?? "them"}.
                    </li>
                  )}
                  {ticketComments.map((c) => (
                    <li key={c.id} className="rounded-lg bg-xb-panel px-2 py-1.5">
                      <p className="text-[10px] font-bold text-xb-blue">{c.author}</p>
                      <p className="text-[11px] text-xb-text">{c.text}</p>
                    </li>
                  ))}
                </ul>
                <form
                  className="grid grid-cols-[minmax(0,1fr)_auto] gap-1.5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    onComment();
                  }}
                >
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Write a comment…"
                    aria-label="Write a comment"
                    className="min-w-0 rounded-full border border-xb-line bg-xb-panel px-3 py-1.5 text-[11px] text-xb-text outline-none focus:border-xb-blue"
                  />
                  <button
                    type="submit"
                    disabled={!draft.trim()}
                    className="flex items-center gap-1 rounded-full bg-xb-blue px-3 text-[10px] font-bold text-xb-on-dark disabled:opacity-50"
                  >
                    <Send className="h-3 w-3" />
                    Post
                  </button>
                </form>
              </div>
            )}

            <ul className="divide-y divide-xb-line">
              {ticket.legs.map((leg, i) => (
                <li
                  key={`${leg.teams}-${i}`}
                  className={`px-3 py-2 ${leg.status === "lost" ? "bg-xb-red/10" : ""}`}
                >
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                    <p
                      className={`truncate text-[11px] font-bold ${
                        leg.status === "lost" ? "text-xb-red" : "text-xb-text"
                      }`}
                    >
                      {leg.time}
                    </p>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span
                        className={`text-[11px] font-black ${
                          leg.status === "won"
                            ? "text-xb-green"
                            : leg.status === "lost"
                              ? "text-xb-red"
                              : "text-xb-text-muted"
                        }`}
                      >
                        {leg.odds.toFixed(2)}
                      </span>
                      <span className={`h-2.5 w-2.5 rounded-sm ${legTone(leg.status)}`} />
                    </div>
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                    <p
                      className={`truncate text-[12px] ${
                        leg.status === "lost" ? "text-xb-red" : "text-xb-text"
                      }`}
                    >
                      {leg.teams}
                    </p>
                    <span className="shrink-0 text-[11px] font-black text-xb-text">{leg.score}</span>
                  </div>
                  <p className="truncate text-[10px] text-xb-text-muted">{leg.league}</p>
                  <p className="truncate text-[10px] font-bold text-xb-text">{leg.market}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </>
  );
}

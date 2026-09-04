import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { X, Lock, Search, Star, Sparkles, Crown, Gift, LayoutGrid, Home } from "lucide-react";
import { Header } from "@/components/xbet/Header";
import { MobileNav } from "@/components/xbet/MobileNav";
import { money, useAuth } from "@/components/xbet/AuthContext";
import aresPoster from "@/assets/sword-of-ares.jpg";
import aviatorPoster from "@/assets/aviator-poster.jpg";
import royalPoster from "@/assets/royal-fortune.jpg";

import { SlideCarousel } from "@/components/xbet/SlideCarousel";
import { visibleSlides } from "@/lib/slides";
import { useSiteContent } from "@/components/admin/AdminDataContext";

export const Route = createFileRoute("/slot")({
  head: () => ({
    meta: [
      { title: "Slots — Sword of Ares & Aviator | BET PLUS+" },
      {
        name: "description",
        content:
          "Play Sword of Ares, the 6-reel Greek mythology slot, and the live Aviator crash game at BET PLUS+ — instant play straight from your wallet.",
      },
      { property: "og:title", content: "Slots — Sword of Ares & Aviator | BET PLUS+" },
      {
        property: "og:description",
        content: "Sword of Ares slot and live Aviator crash, played with your BET PLUS+ balance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SlotPage,
});

const ARES_ORIGIN = "https://golden-pantheon-spin.lovable.app";

const TABS = [
  { key: "popular", label: "Popular", icon: Star },
  { key: "recommended", label: "Recommended", icon: Sparkles },
  { key: "new", label: "New", icon: Sparkles },
  { key: "exclusive", label: "Exclusive", icon: Crown },
  { key: "bonus", label: "Bonus Wagering", icon: Gift },
  { key: "all", label: "All", icon: LayoutGrid },
] as const;

/** Every Sword of Ares slot opens on this stake by default. */
const ARES_DEFAULT_BET = 500;

type GameKey = "ares" | "aviator" | "royal";

const POSTERS: Record<GameKey, string> = {
  ares: aresPoster,
  aviator: aviatorPoster,
  royal: royalPoster,
};

const GAMES: {
  key: GameKey;
  name: string;
  provider: string;
  tags: string[];
  badge?: { label: string; tone: "green" | "blue" };
}[] = [
  {
    key: "ares",
    name: "Sword of Ares",
    provider: "BET PLUS+ Originals",
    tags: ["popular", "recommended", "new", "exclusive", "all"],
    badge: { label: "NEW", tone: "green" },
  },
  {
    key: "aviator",
    name: "Aviator",
    provider: "Spribe Style",
    tags: ["popular", "recommended", "bonus", "all"],
    badge: { label: "LIVE", tone: "blue" },
  },
  {
    key: "royal",
    name: "Royal Fortune",
    provider: "Royal Fortune RGS",
    tags: ["popular", "recommended", "new", "bonus", "all"],
    badge: { label: "NEW", tone: "green" },
  },
];


function SlotPage() {
  const { user, balance, stakeGame, creditWin, openLogin } = useAuth();
  const { content, ready: contentReady } = useSiteContent();
  const navigate = useNavigate();
  const [aresOpen, setAresOpen] = useState(false);
  const [aresSrc, setAresSrc] = useState<string | null>(null);
  const [tab, setTab] = useState<string>("popular");
  const [query, setQuery] = useState("");
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const balanceRef = useRef(balance);
  balanceRef.current = balance;

  // Host-wallet bridge: BET PLUS+ stays the source of truth for the balance.
  useEffect(() => {
    if (!aresOpen) return;
    function onMessage(e: MessageEvent) {
      if (e.origin !== ARES_ORIGIN) return;
      const d = (e.data ?? {}) as { type?: string; bet?: number; amount?: number };
      if (d.type === "sword-of-ares:ready") {
        frameRef.current?.contentWindow?.postMessage(
          { type: "sword-of-ares:set-balance", balance: balanceRef.current },
          ARES_ORIGIN,
        );
        // Every slot opens on the default stake.
        frameRef.current?.contentWindow?.postMessage(
          { type: "sword-of-ares:set-bet", bet: ARES_DEFAULT_BET },
          ARES_ORIGIN,
        );
      } else if (d.type === "sword-of-ares:spin") {
        const bet = Number(d.bet ?? 0);
        if (bet > 0 && !stakeGame(bet, "Sword of Ares")) {
          toast.error("Not enough balance for that stake.");
        }
      } else if (d.type === "sword-of-ares:win") {
        const amount = Number(d.amount ?? 0);
        if (amount > 0) {
          creditWin(amount, "Sword of Ares");
          toast.success(`Sword of Ares win: UGX ${money(amount)}`);
        }
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [aresOpen, stakeGame, creditWin]);

  // Keep the game's displayed balance in sync with the platform wallet.
  useEffect(() => {
    if (!aresOpen) return;
    frameRef.current?.contentWindow?.postMessage(
      { type: "sword-of-ares:set-balance", balance },
      ARES_ORIGIN,
    );
  }, [balance, aresOpen]);

  const openAres = () => {
    if (!user) return openLogin();
    // Freeze the launch URL once — putting the live balance in the src would
    // reload the iframe on every spin.
    setAresSrc(
      `${ARES_ORIGIN}/embed?wallet=host&bet=500&stake=500&defaultBet=500&balance=${Math.max(0, Math.round(balanceRef.current))}&player=${encodeURIComponent(user.id)}&currency=UGX`,
    );
    setAresOpen(true);
  };

  const slotSlides = useMemo(() => visibleSlides(content.slotSlides), [content.slotSlides]);

  const games = useMemo(() => {
    const q = query.trim().toLowerCase();
    return GAMES.filter((g) => (tab === "all" ? true : g.tags.includes(tab))).filter((g) =>
      q ? g.name.toLowerCase().includes(q) : true,
    );
  }, [tab, query]);

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-xb-page font-xb">
      <Header />
      <main className="flex-1 overflow-y-auto pb-16 pt-1 md:pb-4">
        {/* Breadcrumb / title bar */}
        <div className="flex items-center gap-2 bg-xb-header px-3 py-2 text-xb-on-dark md:px-5">
          <Home className="h-3.5 w-3.5 opacity-80" />
          <span className="text-[11px] opacity-80">/ Slots / {tab === "all" ? "All" : "Popular"}</span>
          <h1 className="flex-1 text-center text-[13px] font-black uppercase tracking-wide">Slots</h1>
          <div className="relative hidden sm:block">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-xb-on-dark-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="h-7 w-[200px] rounded bg-white/10 pl-7 pr-2 text-[12px] text-xb-on-dark placeholder:text-xb-on-dark-muted focus:outline-none"
            />
          </div>
        </div>

        <div className="w-full px-3 md:px-5">
          {/* Promo carousel — admin published slides only */}
          <div className="mt-3">
            <SlideCarousel
              slides={slotSlides}
              ready={contentReady}
              heightClass="h-[160px] md:h-[200px]"
              emptyText="No slot promotions published yet."
            />
          </div>


          {/* Tabs */}
          <div className="xb-noscroll mt-3 flex items-center gap-1 overflow-x-auto border-b border-xb-line">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-[12px] font-bold transition-colors ${
                    active
                      ? "border-xb-blue-light text-xb-text"
                      : "border-transparent text-xb-text-muted hover:text-xb-text"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Game grid */}
          <div className="mt-3 grid grid-cols-3 gap-1.5 sm:gap-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
            {games.map((g) => (
              <button
                key={g.key}
                type="button"
                onClick={() =>
                  g.key === "ares"
                    ? openAres()
                    : navigate({ to: g.key === "royal" ? "/royal-fortune" : "/aviator" })
                }
                className="group overflow-hidden rounded-md bg-xb-panel text-left shadow-sm ring-1 ring-xb-line transition-transform hover:-translate-y-0.5 hover:ring-xb-blue-light"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img
                    src={POSTERS[g.key]}
                    alt={`${g.name} game poster`}

                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  {g.badge && (
                    <span
                      className={`absolute left-1.5 top-1.5 rounded px-1.5 py-0.5 text-[9px] font-black text-xb-on-dark ${
                        g.badge.tone === "green" ? "bg-xb-green" : "bg-xb-blue"
                      }`}
                    >
                      {g.badge.label}
                    </span>
                  )}
                  {!user && (
                    <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/60">
                      <Lock className="h-3 w-3 text-white" />
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 px-1.5 py-1 md:gap-1.5 md:px-2 md:py-1.5">
                  <span className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-sm bg-xb-odds text-[8px] font-black text-xb-blue">
                    B
                  </span>
                  <span className="truncate text-[10px] font-bold leading-tight text-xb-text md:text-[11.5px]">{g.name}</span>
                </div>
              </button>
            ))}
          </div>

          {games.length === 0 && (
            <p className="mt-6 text-center text-[12px] text-xb-text-muted">No games in this category yet.</p>
          )}

          <p className="mt-4 pb-4 text-[11px] text-xb-text-muted">
            More games coming soon. Balance: UGX {money(balance)}
          </p>
        </div>
      </main>

      {aresOpen && user && aresSrc && (
        <div className="fixed inset-0 z-50 bg-black">
          <iframe
            ref={frameRef}
            src={aresSrc}
            allow="autoplay; fullscreen"
            title="Sword of Ares"
            className="h-full w-full border-0"
          />
          <button
            type="button"
            onClick={() => {
              setAresOpen(false);
              setAresSrc(null);
            }}
            aria-label="Close Sword of Ares"
            className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/70 text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
      <MobileNav />
    </div>
  );
}

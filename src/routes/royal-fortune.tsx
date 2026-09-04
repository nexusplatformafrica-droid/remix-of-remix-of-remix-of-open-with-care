import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Lock } from "lucide-react";
import { useAuth } from "@/components/xbet/AuthContext";
import { createRoyalLaunch } from "@/lib/royal.functions";
import { ROYAL } from "@/lib/royal-config";

export const Route = createFileRoute("/royal-fortune")({
  head: () => ({
    meta: [
      { title: "Royal Fortune Slot — 20 Lines | BET PLUS+" },
      {
        name: "description",
        content:
          "Play Royal Fortune at BET PLUS+: a 5x3, 20-line royal slot with crowns, gems and bonus rounds, played straight from your BET PLUS+ balance.",
      },
      { property: "og:title", content: "Royal Fortune Slot — 20 Lines | BET PLUS+" },
      {
        property: "og:description",
        content: "Royal Fortune 5x3 slot with 20 fixed lines and bonus wins, live at BET PLUS+.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RoyalPage,
});

const GAME_ORIGIN = ROYAL.baseUrl;

function RoyalPage() {
  const { user, openLogin, openRegister, loading } = useAuth();
  const launch = useServerFn(createRoyalLaunch);
  const [launchUrl, setLaunchUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const frameRef = useRef<HTMLIFrameElement | null>(null);

  const userRef = useRef(user);
  userRef.current = user;
  const launchRef = useRef(launch);
  launchRef.current = launch;
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) {
      setLaunchUrl(null);
      return;
    }
    let active = true;
    setPending(true);
    setError(null);
    launchRef
      .current({ data: { playerId: userId, mode: "real" } })
      .then((res) => {
        if (!active) return;
        setLaunchUrl(res.launchUrl);
        setError(res.error);
      })
      .catch(() => active && setError("Could not start the game right now."))
      .finally(() => active && setPending(false));
    return () => {
      active = false;
    };
  }, [userId, attempt]);

  // Game -> host events. The wallet API stays the source of truth; we only
  // ask the game to refresh after each round.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== GAME_ORIGIN) return;
      const d = (e.data ?? {}) as { source?: string; type?: string; error?: string; message?: string };
      if (d.source !== "royal-fortune") return;
      // A launch token is single use: if the game ever reports an expired or
      // invalid session, silently open a fresh one instead of dead-ending.
      const text = `${d.type ?? ""} ${d.error ?? ""} ${d.message ?? ""}`.toLowerCase();
      if (/session.*(invalid|expired|no longer valid)|invalid.*session/.test(text)) {
        setAttempt((n) => n + 1);
        return;
      }
      if (d.type === "spin:end" || d.type === "bonus:end") {
        frameRef.current?.contentWindow?.postMessage(
          { source: "royal-fortune-host", type: "refreshBalance" },
          GAME_ORIGIN,
        );
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <div className="fixed inset-0 z-40 bg-black">
      <Link
        to="/slot"
        className="absolute left-4 top-4 z-50 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xb-on-dark transition-colors hover:bg-white/20"
        aria-label="Go back"
      >
        <ArrowLeft className="h-5 w-5" />
      </Link>

      {launchUrl ? (
        <iframe
          key={launchUrl}
          ref={frameRef}
          src={launchUrl}
          allow="fullscreen; autoplay"
          title="Royal Fortune"
          className="h-full w-full border-0"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center px-6 text-center text-sm text-white/70">
          {!userId ? (
            loading ? (
              "Checking your session…"
            ) : (
              ""
            )
          ) : pending ? (
            "Starting your game session…"
          ) : (
            <div className="space-y-3">
              <p>{error ?? "Game unavailable."}</p>
              <button
                type="button"
                onClick={() => setAttempt((n) => n + 1)}
                className="rounded-xl bg-xb-green px-5 py-2 text-[13px] font-bold text-xb-on-dark"
              >
                RELAUNCH GAME
              </button>
            </div>
          )}
        </div>
      )}

      {!userId && !loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-xb-line bg-xb-panel p-6 text-center shadow-2xl">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-xb-odds">
              <Lock className="h-5 w-5 text-xb-blue" />
            </div>
            <h2 className="text-base font-black text-xb-text">Royal Fortune is locked</h2>
            <p className="mt-1 text-[12px] text-xb-text-muted">
              Log in or create an account to play Royal Fortune with your BET PLUS+ balance.
            </p>
            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={openLogin}
                className="w-full rounded-xl bg-xb-green py-3 text-[13px] font-bold text-xb-on-dark transition-colors hover:bg-xb-green-dark"
              >
                LOG IN
              </button>
              <button
                type="button"
                onClick={openRegister}
                className="w-full rounded-xl bg-xb-blue py-3 text-[13px] font-bold text-xb-on-dark"
              >
                REGISTER
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

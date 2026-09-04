import { useEffect, useRef, useState } from "react";

export type OddsFlash = "up" | "down" | null;

/**
 * Tracks an odd value across silent background refetches and reports whether it
 * drifted up or down, so the UI can flash the change instead of swapping numbers
 * without a cue. The flag resets itself after the animation length.
 */
export function useOddsFlash(value: number | null | undefined, ms = 1200): OddsFlash {
  const previous = useRef(value ?? null);
  const [flash, setFlash] = useState<OddsFlash>(null);

  useEffect(() => {
    const before = previous.current;
    const now = value ?? null;
    previous.current = now;

    if (before === null || now === null || before === now) return;

    setFlash(now > before ? "up" : "down");
    const timer = window.setTimeout(() => setFlash(null), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);

  return flash;
}

export function oddsFlashClass(flash: OddsFlash) {
  if (flash === "up") return "odds-flash-up";
  if (flash === "down") return "odds-flash-down";
  return "";
}

import { useEffect, useRef, useState } from "react";

import type { Slide } from "@/lib/admin-types";

type Props = {
  slides: Slide[];
  ready: boolean;
  /** Tailwind height classes for the banner box. */
  heightClass?: string;
  emptyText?: string;
};

const SLIDE_MS = 6000;
const EASE_MS = 700;

/** Renders admin-published slides only — image only, no overlay or text. */
export function SlideCarousel({
  slides,
  ready,
  heightClass = "h-[240px]",
  emptyText = "No promotions published yet.",
}: Props) {
  // The track holds every slide plus a clone of the first one, so the motion
  // always continues forward and never rewinds back to the start.
  const [i, setI] = useState(0);
  const [animate, setAnimate] = useState(true);
  const resetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setI(0);
    setAnimate(true);
  }, [slides.length]);

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = setInterval(() => setI((p) => p + 1), SLIDE_MS);
    return () => clearInterval(timer);
  }, [slides.length]);

  // When the clone is on screen, jump back to the real first slide without a
  // visible transition — the loop looks endless.
  useEffect(() => {
    if (slides.length < 2 || i !== slides.length) return;
    resetRef.current = setTimeout(() => {
      setAnimate(false);
      setI(0);
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimate(true)));
    }, EASE_MS + 20);
    return () => {
      if (resetRef.current) clearTimeout(resetRef.current);
    };
  }, [i, slides.length]);

  if (!ready) {
    return (
      <div
        className={`relative ${heightClass} animate-pulse overflow-hidden rounded-none sm:rounded-2xl bg-xb-panel-alt font-xb shadow-sm`}
      >
        <div className="flex h-full flex-col justify-center gap-3 px-14">
          <div className="h-8 w-2/5 rounded bg-xb-odds" />
          <div className="h-3 w-3/5 rounded bg-xb-odds" />
          <div className="h-9 w-32 rounded-full bg-xb-odds" />
        </div>
      </div>
    );
  }

  if (slides.length === 0) {
    return (
      <div
        className={`grid ${heightClass} place-items-center rounded-none sm:rounded-2xl bg-xb-panel-alt font-xb text-[12px] text-xb-text-muted shadow-sm`}
      >
        {emptyText}
      </div>
    );
  }

  const track = slides.length > 1 ? [...slides, slides[0]!] : slides;
  const dot = i % slides.length;

  return (
    <div
      className={`relative ${heightClass} overflow-hidden rounded-none sm:rounded-2xl bg-black font-xb shadow-sm`}
    >
      <div
        className={`flex h-full w-full ${animate ? "transition-transform duration-700 ease-[cubic-bezier(0.4,0,0.2,1)]" : ""}`}
        style={{ transform: `translateX(-${i * 100}%)` }}
      >
        {track.map((s, idx) => {
          const image = s.image ? (
            <img
              src={s.image}
              alt={s.title || "Promotion"}
              /* Fills the banner box edge to edge at every width — never zoomed,
                 never letterboxed. */
              className="block h-full w-full object-fill"
              draggable={false}
            />
          ) : null;
          return (
            <div key={`${s.id}-${idx}`} className="h-full w-full shrink-0 grow-0 basis-full">
              {s.link ? (
                <a
                  href={s.link}
                  className="block h-full w-full"
                  aria-label={s.title || "Promotion"}
                >
                  {image}
                </a>
              ) : (
                image
              )}
            </div>
          );
        })}
      </div>

      {slides.length > 1 && (
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
          {slides.map((s, idx) => (
            <button
              key={s.id}
              aria-label={`Go to ${s.title}`}
              onClick={() => setI(idx)}
              className={
                idx === dot
                  ? "h-1.5 w-5 rounded-full bg-xb-on-dark transition-all duration-300"
                  : "h-1.5 w-1.5 rounded-full bg-xb-on-dark/50 transition-all duration-300 hover:bg-xb-on-dark/80"
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

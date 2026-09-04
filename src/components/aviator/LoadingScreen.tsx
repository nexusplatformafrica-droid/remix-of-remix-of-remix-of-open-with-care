import { useEffect, useState } from "react";

import splash from "@/assets/aviator/splash.jpg.asset.json";
import { PlaneSprite } from "@/components/aviator/PlaneSprite";

/** Preload as early as the module is evaluated so the splash never flashes empty. */
if (typeof window !== "undefined") {
  const img = new Image();
  img.src = splash.url;
}

export function LoadingScreen({ label = "Loading live table…" }: { label?: string }) {
  const [progress, setProgress] = useState(8);

  useEffect(() => {
    const id = window.setInterval(() => {
      setProgress((value) => (value >= 96 ? 96 : value + Math.max(1, (100 - value) * 0.12)));
    }, 120);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex h-screen w-screen flex-col items-center justify-end overflow-hidden bg-background">
      <img
        src={splash.url}
        alt=""
        aria-hidden="true"
        fetchPriority="high"
        decoding="sync"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />

      <div className="relative z-10 mb-[12vh] flex w-full max-w-xl flex-col items-center gap-5 px-8">
        <p className="font-display text-xs uppercase tracking-[0.35em] text-muted-foreground">
          {label}
        </p>

        <div className="w-full">
          <div className="relative mb-3 h-8 w-full">
            <div
              className="absolute bottom-0 transition-[left] duration-200 ease-out"
              style={{ left: `${progress}%`, transform: "translateX(-50%)" }}
            >
              <PlaneSprite className="w-16" />
            </div>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-elevated/80">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
              style={{
                width: `${progress}%`,
                boxShadow: "0 0 14px color-mix(in oklab, var(--primary) 70%, transparent)",
              }}
            />
          </div>
          <div className="mt-2 flex justify-between font-display text-[10px] uppercase tracking-widest text-muted-foreground">
            <span>Preparing round</span>
            <span className="tabular-nums">{Math.round(progress)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

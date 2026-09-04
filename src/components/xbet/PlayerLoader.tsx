/**
 * BET PLUS+ branded player loader.
 * Soft, milky macOS-style glass backdrop with the site wordmark dropping in
 * letter by letter — shown while a stream is buffering.
 */
const LETTERS: Array<{ ch: string; blue: boolean }> = [
  { ch: "B", blue: false },
  { ch: "E", blue: false },
  { ch: "T", blue: false },
  { ch: "P", blue: true },
  { ch: "L", blue: true },
  { ch: "U", blue: true },
  { ch: "S", blue: true },
  { ch: "+", blue: true },
];

export function PlayerLoader({ label = "Loading stream" }: { label?: string }) {
  const cycle = LETTERS.length * 0.12 + 1.5;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-black">
      {/* milky drifting light */}
      <div
        className="absolute -inset-1/4 opacity-70 blur-2xl"
        style={{
          background:
            "radial-gradient(38% 42% at 30% 35%, color-mix(in oklab, var(--xb-blue-light) 55%, transparent), transparent 70%), radial-gradient(34% 40% at 70% 65%, color-mix(in oklab, white 26%, transparent), transparent 72%)",
          animation: "bp-milky-drift 6s ease-in-out infinite",
        }}
      />

      <div className="relative flex h-full w-full flex-col items-center justify-center gap-5 px-4">
        {/* wordmark — letters drop in one by one */}
        <span className="flex items-baseline font-xb text-4xl font-black tracking-tight drop-shadow-[0_6px_24px_rgba(0,0,0,0.6)] sm:text-6xl">
          {LETTERS.map((l, i) => (
            <span
              key={`${l.ch}-${i}`}
              className={`inline-block ${l.blue ? "text-xb-blue-light" : "text-xb-on-dark"}`}
              style={{
                animation: `bp-letter-drop ${cycle}s cubic-bezier(0.22,1.2,0.36,1) ${i * 0.12}s infinite`,
              }}
            >
              {l.ch}
            </span>
          ))}
        </span>

        {/* progress shimmer */}
        <span className="relative h-[3px] w-48 overflow-hidden rounded-full bg-white/10">
          <span
            className="absolute inset-y-0 w-1/3 rounded-full bg-xb-blue-light"
            style={{ animation: "bp-slide 1.6s ease-in-out infinite" }}
          />
        </span>

        <span className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-white/55">
          {label}
          <span className="flex gap-0.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1 w-1 rounded-full bg-white/70"
                style={{ animation: `bp-dot 1.1s ease-in-out ${i * 0.15}s infinite` }}
              />
            ))}
          </span>
        </span>
      </div>
    </div>
  );
}

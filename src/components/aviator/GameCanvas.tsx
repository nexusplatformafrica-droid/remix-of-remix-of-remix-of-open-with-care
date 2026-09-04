import { useEffect, useRef } from "react";

import { PlaneSprite } from "./PlaneSprite";
import { BETTING_SECONDS, GROWTH_RATE, formatMultiplier, type Phase } from "@/lib/aviator/game";

/** Multiplier tier colours (r,g,b). */
function trailColor(_multiplier: number) {
  return "228,5,57";
}

type Props = {
  phase: Phase;
  multiplier: number;
  countdown: number;
  roundNumber: number | null;
};

export function GameCanvas({ phase, multiplier, countdown, roundNumber }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const planeRef = useRef<HTMLDivElement | null>(null);
  const valueRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef({ phase, multiplier, countdown });
  stateRef.current = { phase, multiplier, countdown };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let frame = 0;
    let crashAt = 0;
    let spin = 0;
    let cloudOffset = 0;
    let lastPhase: Phase = stateRef.current.phase;

    const render = (time: number) => {
      const { phase: currentPhase, multiplier: currentMultiplier } = stateRef.current;
      if (currentPhase !== lastPhase) {
        if (currentPhase === "flying" || currentPhase === "betting") crashAt = 0;
        if (currentPhase === "crashed") crashAt = time;
        lastPhase = currentPhase;
      }

      const ratio = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width * ratio || canvas.height !== height * ratio) {
        canvas.width = width * ratio;
        canvas.height = height * ratio;
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);

      const padLeft = 34;
      const padBottom = 30;
      const padTop = 18;
      const padRight = 22;
      const originX = padLeft;
      const originY = height - padBottom;
      const plotW = width - padLeft - padRight;
      const plotH = height - padBottom - padTop;

      if (currentPhase === "flying") spin += 0.0022;
      cloudOffset = (cloudOffset + (currentPhase === "flying" ? 1.4 : 0.7)) % Math.max(width, 1);

      /* rotating light rays */
      if (currentPhase !== "betting") {
        context.save();
        context.translate(originX, originY);
        const step = (Math.PI * 2) / 48;
        const sweep = Math.min(Math.PI * 2, Math.PI / 2 + spin * 4);
        const count = Math.ceil(sweep / step);
        const reach = Math.hypot(width, height) * 2;
        for (let index = 0; index < count; index += 1) {
          const angle = -index * step - spin;
          context.beginPath();
          context.moveTo(0, 0);
          context.lineTo(Math.cos(angle) * reach, Math.sin(angle) * reach);
          context.lineWidth = index % 2 === 0 ? 26 : 10;
          context.strokeStyle =
            index % 2 === 0 ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.022)";
          context.stroke();
        }
        context.restore();
      }

      /* procedural cloud band — drawn in code, nothing to download */
      {
        const cloudH = Math.min(120, plotH * 0.35);
        const baseY = originY - cloudH * 0.25;
        context.save();
        context.globalAlpha = 0.16;
        context.fillStyle = "#ffffff";
        for (let pass = 0; pass < 2; pass += 1) {
          const shift = pass * width;
          for (let i = 0; i < 7; i += 1) {
            const cx = ((i / 7) * width + shift - cloudOffset + width) % (width * 2);
            const r = cloudH * (0.28 + ((i * 37) % 10) / 40);
            context.beginPath();
            context.arc(cx, baseY - r * 0.6, r, 0, Math.PI * 2);
            context.arc(cx + r * 0.9, baseY - r * 0.35, r * 0.75, 0, Math.PI * 2);
            context.arc(cx - r * 0.9, baseY - r * 0.3, r * 0.65, 0, Math.PI * 2);
            context.fill();
          }
        }
        context.restore();
      }


      /* axes */
      context.strokeStyle = "rgba(255,255,255,0.16)";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(originX, padTop);
      context.lineTo(originX, originY);
      context.lineTo(width - padRight, originY);
      context.stroke();

      const shownMultiplier = currentPhase === "betting" ? 1 : currentMultiplier;
      const elapsed =
        currentPhase === "betting"
          ? 0
          : Math.max(0, Math.log(Math.max(1, shownMultiplier)) / GROWTH_RATE);
      const timeSpan = Math.max(9, elapsed * 1.22);
      const valueSpan = Math.max(1.45, shownMultiplier * 1.08);
      const planeH = (planeRef.current?.clientHeight ?? 64) * 0.85;
      const usableH = Math.max(plotH * 0.55, plotH - planeH);

      /* axis ticks */
      context.fillStyle = "rgba(255,255,255,0.35)";
      context.font = "10px system-ui, sans-serif";
      for (let index = 1; index <= 4; index += 1) {
        const value = 1 + ((valueSpan - 1) * index) / 4;
        const y = originY - (usableH * index) / 4;
        context.fillText(`${value.toFixed(1)}x`, 4, y + 3);
        context.beginPath();
        context.arc(originX, y, 1.6, 0, Math.PI * 2);
        context.fill();
      }
      for (let index = 1; index <= 5; index += 1) {
        const x = originX + (plotW * index) / 5;
        context.beginPath();
        context.arc(x, originY, 1.6, 0, Math.PI * 2);
        context.fill();
      }

      const flying = currentPhase === "flying";
      const pointAt = (seconds: number) => {
        const value = Math.exp(GROWTH_RATE * seconds);
        const x = originX + (seconds / timeSpan) * plotW;
        const y = originY - ((value - 1) / (valueSpan - 1)) * usableH;
        return { x, y };
      };

      const tip = pointAt(elapsed);
      if (elapsed > 0.01) {
        const steps = 60;
        const curve = (drawEnd: boolean) => {
          context.beginPath();
          context.moveTo(originX, originY);
          for (let index = 1; index <= steps; index += 1) {
            const point = pointAt((elapsed * index) / steps);
            context.lineTo(point.x, point.y);
          }
          if (drawEnd) {
            context.lineTo(tip.x, originY);
            context.closePath();
          }
        };

        const trail = trailColor(shownMultiplier);

        curve(true);
        const fill = context.createLinearGradient(0, padTop, 0, originY);
        fill.addColorStop(0, `rgba(${trail},0.85)`);
        fill.addColorStop(1, `rgba(${trail},0.35)`);
        context.fillStyle = fill;
        context.fill();

        curve(false);
        context.strokeStyle = `rgba(${trail},${currentPhase === "crashed" ? 0.85 : 1})`;
        context.lineWidth = 3.5;
        context.shadowColor = `rgba(${trail},0.9)`;
        context.shadowBlur = 16;
        context.stroke();
        context.shadowBlur = 0;
      }

      const plane = planeRef.current;
      if (plane) {
        // The plotted point meets the lower centre of the tail while the
        // aircraft remains level, matching the original Aviator artwork.
        const anchor = "translate(-6.7%, -93.6%)";

        if (currentPhase === "crashed") {
          const gone = Math.min(1, (time - crashAt) / 900);
          plane.style.opacity = String(Math.max(0, 1 - gone * 1.15));
          plane.style.transform = `translate(${tip.x + gone * 420}px, ${tip.y - gone * 200}px) scale(${1 - gone * 0.3}) ${anchor}`;
        } else if (currentPhase === "betting") {
          plane.style.opacity = "1";
          plane.style.transform = `translate(${originX}px, ${originY}px) ${anchor}`;
        } else {
          plane.style.opacity = "1";
          plane.style.transform = `translate(${tip.x}px, ${tip.y}px) ${anchor}`;
        }
      }

      if (valueRef.current) valueRef.current.textContent = formatMultiplier(shownMultiplier);

      frame = requestAnimationFrame(render);
    };

    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, []);

  const crashed = phase === "crashed";

  return (
    <div className="relative h-full min-h-[200px] w-full overflow-hidden rounded-xl border border-border bg-black [contain:layout_paint]">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div
        ref={planeRef}
        className="pointer-events-none absolute left-0 top-0 w-[78px] origin-left will-change-transform sm:w-[104px] lg:w-[124px]"
        style={{ aspectRatio: "150 / 74" }}
      >
        <PlaneSprite spinning={!crashed} />
      </div>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        {phase === "betting" ? (
          <div className="flex flex-col items-center gap-2">
            <span className="font-display text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Next round in
            </span>
            <span className="font-display text-4xl font-bold text-primary neon-text tabular-nums sm:text-5xl">
              {countdown.toFixed(1)}s
            </span>
            <div className="h-1 w-40 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full bg-primary"
                style={{ width: `${Math.min(100, (1 - countdown / BETTING_SECONDS) * 100)}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            {crashed ? (
              <span className="font-display text-sm uppercase tracking-[0.35em] text-primary">
                Flew away
              </span>
            ) : null}
            <div
              ref={valueRef}
              className="font-display text-5xl font-bold tabular-nums text-foreground neon-text sm:text-6xl lg:text-7xl"
            >
              1.00x
            </div>
          </div>
        )}
      </div>

      <div className="absolute left-3 top-2 font-display text-[10px] uppercase tracking-widest text-muted-foreground">
        Round #{roundNumber ?? "—"}
      </div>
    </div>
  );
}
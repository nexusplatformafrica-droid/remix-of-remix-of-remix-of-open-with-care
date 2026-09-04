import { useEffect, useState } from "react";
import { UGANDA_TZ } from "./time";

/**
 * Offset (ms) between the authoritative internet clock and this device.
 * Device time is never trusted — everything renders through `serverNow()`.
 */
let offset = 0;
let synced = false;
let pending: Promise<void> | null = null;

async function syncOnce(): Promise<void> {
  const started = Date.now();
  const res = await fetch("/api/public/time", { cache: "no-store" });
  const data = (await res.json()) as { now: number };
  const latency = (Date.now() - started) / 2;
  offset = data.now + latency - Date.now();
  synced = true;
}

export function syncServerTime(): Promise<void> {
  if (!pending) pending = syncOnce().catch(() => undefined);
  return pending;
}

export function serverNow(): Date {
  return new Date(Date.now() + offset);
}

export function isTimeSynced() {
  return synced;
}

/** Kampala (EAT) wall clock, e.g. "7:45pm", driven by internet time. */
export function eatClock(now: Date = serverNow()) {
  return now
    .toLocaleTimeString("en-US", {
      timeZone: UGANDA_TZ,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .replace(/\s?([AP])M$/i, (_m, p1: string) => `${p1.toLowerCase()}m`);
}

/** Full EAT stamp, e.g. "Fri, 7 Aug 2026, 17:47:05". */
export function eatFull(now: Date = serverNow()) {
  return now.toLocaleString("en-GB", {
    timeZone: UGANDA_TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/** Ticking internet-time clock. Returns null until the first sync lands. */
export function useServerTime(intervalMs = 1000) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    let alive = true;
    void syncServerTime().then(() => {
      if (alive) setNow(serverNow());
    });
    const id = setInterval(() => {
      if (alive && isTimeSynced()) setNow(serverNow());
    }, intervalMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [intervalMs]);

  return now;
}

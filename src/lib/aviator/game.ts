/** Shared maths + formatting for the Aviator crash game. */
export const GROWTH_RATE = 0.07;
export const BETTING_SECONDS = 6;

export type Phase = "betting" | "flying" | "crashed";

export type BetRow = {
  id: string;
  roundId: string;
  userId: string;
  name: string;
  slot: number;
  amount: number;
  autoCashout: number | null;
  cashoutMultiplier: number | null;
  payout: number | null;
  result: "pending" | "won" | "lost" | "cancelled";
  at: number;
};

export function multiplierAt(elapsedSeconds: number): number {
  if (elapsedSeconds <= 0) return 1;
  return Math.exp(GROWTH_RATE * elapsedSeconds);
}

export function flightDuration(crashPoint: number): number {
  return Math.log(Math.max(crashPoint, 1)) / GROWTH_RATE;
}

export function formatMultiplier(value: number): string {
  return `${(Math.floor(value * 100) / 100).toFixed(2)}x`;
}

export function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function multiplierTone(value: number): "low" | "mid" | "high" {
  if (value < 2) return "low";
  if (value < 10) return "mid";
  return "high";
}

export function avatarColor(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 360;
  }
  return `oklch(0.55 0.16 ${hash})`;
}

export function maskName(name: string): string {
  if (name.length <= 2) return `${name[0] ?? "p"}***`;
  return `${name.slice(0, 1)}***${name.slice(-1)}`;
}
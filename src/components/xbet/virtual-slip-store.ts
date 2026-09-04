import { useSyncExternalStore } from "react";

type VirtualSlipState = {
  active: boolean;
  count: number;
  open: (() => void) | null;
};

let state: VirtualSlipState = { active: false, count: 0, open: null };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function setVirtualSlip(patch: Partial<VirtualSlipState>) {
  const next = { ...state, ...patch };
  if (next.active === state.active && next.count === state.count && next.open === state.open) return;
  state = next;
  emit();
}

export function resetVirtualSlip() {
  setVirtualSlip({ active: false, count: 0, open: null });
}

const serverSnapshot: VirtualSlipState = { active: false, count: 0, open: null };

export function useVirtualSlip() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => serverSnapshot,
  );
}

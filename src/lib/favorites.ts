import { useSyncExternalStore } from "react";
import type { Sport } from "./sports-types";

export type FavoriteMatch = {
  id: string;
  sport: Sport;
  home: string;
  away: string;
  league?: string;
  country?: string;
  date?: string;
  time?: string;
};

const KEY = "xb-favorite-matches";

let items: FavoriteMatch[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) items = JSON.parse(raw) as FavoriteMatch[];
  } catch {
    items = [];
  }
}

function persist() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  load();
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot() {
  load();
  return items;
}

const EMPTY: FavoriteMatch[] = [];
function getServerSnapshot() {
  return EMPTY;
}

export function toggleFavorite(m: FavoriteMatch) {
  load();
  items = items.some((x) => x.id === m.id) ? items.filter((x) => x.id !== m.id) : [m, ...items];
  persist();
}

export function removeFavorite(id: string) {
  load();
  items = items.filter((x) => x.id !== id);
  persist();
}

export function useFavorites() {
  const list = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    favorites: list,
    isFavorite: (id: string) => list.some((x) => x.id === id),
    toggleFavorite,
    removeFavorite,
  };
}

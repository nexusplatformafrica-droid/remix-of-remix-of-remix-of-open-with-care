export const SPORTS = ["football", "basketball", "tennis", "cricket"] as const;
export type Sport = (typeof SPORTS)[number];
export type MatchScope = "live" | "today" | "upcoming" | "results" | "boosted" | "topbets";

export const SPORT_LABELS: Record<Sport, string> = {
  football: "Football",
  basketball: "Basketball",
  tennis: "Tennis",
  cricket: "Cricket",
};

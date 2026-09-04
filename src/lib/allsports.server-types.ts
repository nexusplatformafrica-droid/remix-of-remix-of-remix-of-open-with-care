/**
 * Client-safe shapes shared between the AllSportsAPI server module and helpers
 * that must not pull the server module into a browser bundle.
 */
export type MainOdds = {
  home: number | null;
  draw: number | null;
  away: number | null;
  over: number | null;
  under: number | null;
  bttsYes: number | null;
  bttsNo: number | null;
  line: string;
};

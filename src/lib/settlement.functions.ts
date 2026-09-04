import { createServerFn } from "@tanstack/react-start";
import type { Sport } from "./sports-types";

export type FixtureSnapshot = {
  id: string;
  started: boolean;
  live: boolean;
  finished: boolean;
  postponed: boolean;
  ft: { h: number; a: number } | null;
  ht: { h: number; a: number } | null;
  htDone: boolean;
  home: string;
  away: string;
  status: string;
};

/**
 * Live/half-time/final scores for the fixtures a ticket still needs, in the
 * exact shape the grading engine consumes.
 */
export const getMatchSnapshots = createServerFn({ method: "POST" })
  .inputValidator((data: { sport?: Sport; ids: string[] }) => ({
    sport: (data.sport ?? "football") as Sport,
    ids: (data.ids ?? []).map(String).filter(Boolean).slice(0, 20),
  }))
  .handler(async ({ data }): Promise<FixtureSnapshot[]> => {
    const { fetchMatchDetails } = await import("./allsports.server");
    const { isVoidStatus } = await import("./market-grading");

    const rows = await Promise.all(
      data.ids.map(async (id) => {
        try {
          const details = await fetchMatchDetails(data.sport, id);
          const m = details.match;
          if (!m) return null;
          const h = m.homeScore === null ? null : Number(m.homeScore);
          const a = m.awayScore === null ? null : Number(m.awayScore);
          const ftScore =
            h !== null && a !== null && Number.isFinite(h) && Number.isFinite(a)
              ? { h, a }
              : null;
          const htRow = m.periods.find((p) => /half.?time|^ht$|1st half/i.test(p.label));
          const htScore = htRow
            ? { h: Number(htRow.home) || 0, a: Number(htRow.away) || 0 }
            : null;
          const status = m.status ?? "";
          const postponed = isVoidStatus(status);
          const finished = m.finished && !postponed;
          const htDone = finished || htScore !== null || /2nd half|second half|\bht\b|half.?time/i.test(status) ||
            (/^\d+/.test(status) && Number(status.match(/^\d+/)?.[0] ?? 0) >= 45);
          return {
            id,
            started: m.live || finished || ftScore !== null,
            live: m.live,
            finished,
            postponed,
            ft: ftScore,
            ht: htScore ?? (finished && !htRow ? null : htScore),
            htDone,
            home: m.home,
            away: m.away,
            status,
          } satisfies FixtureSnapshot;
        } catch {
          return null;
        }
      }),
    );
    return rows.filter((r): r is FixtureSnapshot => r !== null);
  });

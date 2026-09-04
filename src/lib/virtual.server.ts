/**
 * Fortebet virtual-soccer feed. Called only from server functions so the
 * browser never hits the upstream host directly (no CORS, no key leakage).
 */
const HOSTS = [
  "https://desktop.fortebet.ug/api/web/v1/virtual-soccer",
  "https://kiosk.fortebet.ug/api/web/v1/virtual-soccer",
];

export type VirtualOdd = { id: number; name: string; odd: number };
export type VirtualGroup = { key: string; type: string; label: string; odds: VirtualOdd[] };

export type VirtualMatch = {
  id: string;
  no: number;
  status: number;
  kickoff: string;
  home: string;
  away: string;
  league: string;
  groups: VirtualGroup[];
};

export type VirtualResult = {
  id: string;
  no: number;
  at: string;
  home: string;
  away: string;
  league: string;
  ft: { h: number; a: number };
  ht: { h: number; a: number };
};

export type VirtualOffer = {
  ts: string;
  matches: VirtualMatch[];
  results: VirtualResult[];
};

type Json = Record<string, unknown>;

const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0) || 0);
const str = (v: unknown) => String(v ?? "");

/** Human label per market group; group 10 is the provider's "any other score". */
function groupLabel(key: string, type: string): string {
  if (key === "10") return "Any other result";
  if (type === "1X2") return "Full time result";
  if (type === "1X2HT") return "Half time result";
  if (type === "U/O") return "Total goals";
  if (type === "Correct score") return "Correct score";
  if (type === "Goal") return "Both teams to score";
  if (type === "Goal HT") return "Both teams to score: 1st half";
  return type;
}

function toGroups(raw: unknown): VirtualGroup[] {
  if (!raw || typeof raw !== "object") return [];
  return Object.entries(raw as Json)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([key, value]) => {
      const g = (value ?? {}) as Json;
      const type = str(g["type"]);
      const odds = Object.entries((g["odds"] ?? {}) as Json)
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([, o]) => {
          const row = (o ?? {}) as Json;
          return {
            id: num(row["id"]),
            name: key === "10" ? "Any other result" : str(row["odds_name"]),
            odd: num(row["odds_val"]),
          };
        })
        .filter((o) => o.odd > 0);
      return { key, type, label: groupLabel(key, type), odds };
    })
    .filter((g) => g.odds.length > 0);
}

function toResult(raw: Json): VirtualResult {
  const ft = (raw["result_ft"] ?? {}) as Json;
  const ht = (raw["result_ht"] ?? {}) as Json;
  return {
    id: str(raw["id"]),
    no: num(raw["daily_id"]),
    at: str(raw["event_time"]),
    home: str(raw["home"]),
    away: str(raw["away"]),
    league: str(raw["league"]),
    ft: { h: num(ft["home"]), a: num(ft["away"]) },
    ht: { h: num(ht["home"]), a: num(ht["away"]) },
  };
}

async function get(path: string): Promise<Json | null> {
  for (const base of HOSTS) {
    try {
      const res = await fetch(`${base}${path}`, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) continue;
      return (await res.json()) as Json;
    } catch {
      /* try the next host */
    }
  }
  return null;
}

export async function fetchVirtualOffer(): Promise<VirtualOffer> {
  const body = await get("/offer");
  const data = (body?.["data"] ?? {}) as Json;
  const matches = Array.isArray(data["matches"]) ? (data["matches"] as Json[]) : [];
  const results = Array.isArray(data["results"]) ? (data["results"] as Json[]) : [];
  return {
    ts: str(body?.["ts"]) || new Date().toISOString(),
    matches: matches.map((m) => ({
      id: str(m["item_id"]),
      no: num(m["item_daily_id"]),
      status: num(m["item_status"]),
      kickoff: str(m["item_time"]),
      home: str(m["home"]),
      away: str(m["away"]),
      league: str(m["item_league"]),
      groups: toGroups(m["odds"]),
    })),
    results: results.map(toResult),
  };
}

export async function fetchVirtualResults(): Promise<VirtualResult[]> {
  const body = await get("/results");
  const rows = Array.isArray(body?.["data"]) ? (body["data"] as Json[]) : [];
  return rows.map(toResult).sort((a, b) => b.no - a.no);
}

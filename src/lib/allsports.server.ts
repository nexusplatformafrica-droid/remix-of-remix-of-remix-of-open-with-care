/**
 * AllSportsAPI multi-sport server-only data layer.
 * Supported sports on the current plan: football, basketball, tennis.
 */

import { FINISHED_RE, VOID_RE } from "./market-grading";
import { allsportsApiKey } from "./allsports-key.server";

type Json = Record<string, unknown>;


export const SPORTS = ["football", "basketball", "tennis", "cricket"] as const;
export type Sport = (typeof SPORTS)[number];

const cache = new Map<string, { at: number; data: unknown }>();

async function call<T>(
  sport: Sport,
  params: Record<string, string>,
  ttlMs: number,
): Promise<T | null> {
  const key = `${sport}:${JSON.stringify(params)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.data as T;

  // Admin-editable key (Admin → Settings), env override, then built-in default.
  const apiKey = await allsportsApiKey();

  const url = new URL(`https://apiv2.allsportsapi.com/${sport}/`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  // Ask the provider for Uganda local times so no client-side shifting is needed.
  url.searchParams.set("timezone", UGANDA_TZ);
  url.searchParams.set("APIkey", apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const body = (await res.json()) as { success?: number; error?: unknown; result?: unknown };
  const result = body.error ? null : body.result;
  const data = (typeof result === "string" ? null : (result ?? null)) as T | null;
  cache.set(key, { at: Date.now(), data });
  return data;
}

const UGANDA_TZ = "Africa/Kampala";

/**
 * Fixture / livescore endpoints sometimes answer with a date-keyed object
 * (tennis does this for multi-day windows) instead of a flat array. Flatten
 * both shapes to one row list so no sport silently renders an empty page.
 */
function rowsOf(res: unknown): Json[] {
  if (Array.isArray(res)) return res as Json[];
  if (res && typeof res === "object") {
    return Object.values(res as Record<string, unknown>).flatMap((v) =>
      Array.isArray(v) ? (v as Json[]) : [],
    );
  }
  return [];
}

/**
 * Fixture date key. Football/basketball/tennis ship `event_date`, cricket ships
 * `event_date_start`, so every date comparison must accept both.
 */
function dateKey(f: Json): string {
  return String(f["event_date"] ?? f["event_date_start"] ?? "");
}

/** Current Uganda-local time, as a Date whose UTC fields hold Kampala wall time. */
function ugNow(): Date {
  return new Date(Date.now() + 3 * 60 * 60_000);
}

/** Uganda-local calendar date, offset by whole days. */
function ymd(offsetDays: number): string {
  const d = ugNow();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n > 1 ? round2(n) : null;
};

/* ---------------- odds ---------------- */

export type Outcome = { label: string; odd: number; bookmaker: string; bookmakers: number };
export type Market = { name: string; outcomes: Outcome[] };

type Collector = Map<string, Map<string, { odd: number; bookmaker: string; count: number }>>;

function add(coll: Collector, market: string, label: string, raw: unknown, bookmaker: string) {
  const odd = num(raw);
  if (!odd) return;
  let m = coll.get(market);
  if (!m) {
    m = new Map();
    coll.set(market, m);
  }
  const cur = m.get(label);
  if (!cur) m.set(label, { odd, bookmaker, count: 1 });
  else {
    cur.count += 1;
    if (odd > cur.odd) {
      cur.odd = odd;
      cur.bookmaker = bookmaker;
    }
  }
}

function collect(coll: Collector): Market[] {
  return [...coll.entries()]
    .map(([name, outcomes]) => ({
      name,
      outcomes: [...outcomes.entries()].map(([label, v]) => ({
        label,
        odd: v.odd,
        bookmaker: v.bookmaker,
        bookmakers: v.count,
      })),
    }))
    .filter((m) => m.outcomes.length > 0);
}

/** Football odds arrive as one flat row per bookmaker. */
function parseFootballOdds(rows: Json[]): Market[] {
  const coll: Collector = new Map();
  for (const row of rows) {
    const bk = String(row["odd_bookmakers"] ?? "Bookmaker");
    add(coll, "1X2", "1", row["odd_1"], bk);
    add(coll, "1X2", "X", row["odd_x"], bk);
    add(coll, "1X2", "2", row["odd_2"], bk);
    add(coll, "Double Chance", "1X", row["odd_1x"], bk);
    add(coll, "Double Chance", "12", row["odd_12"], bk);
    add(coll, "Double Chance", "X2", row["odd_x2"], bk);
    add(coll, "Both Teams To Score", "Yes", row["bts_yes"], bk);
    add(coll, "Both Teams To Score", "No", row["bts_no"], bk);
    for (const [k, v] of Object.entries(row)) {
      const ou = /^([ou])\+([\d.]+)$/.exec(k);
      if (ou) {
        add(coll, `Total Goals ${ou[2]}`, ou[1] === "o" ? "Over" : "Under", v, bk);
        continue;
      }
      const ah = /^ah([+-]?[\d.]+)_([12])$/.exec(k);
      if (ah) add(coll, `Asian Handicap ${ah[1]}`, ah[2] === "1" ? "1" : "2", v, bk);
    }
  }
  return collect(coll);
}

/** Basketball / tennis odds arrive as market -> outcome -> bookmaker. */
function parseNestedOdds(node: Json): Market[] {
  const coll: Collector = new Map();
  for (const [market, outcomes] of Object.entries(node)) {
    if (!outcomes || typeof outcomes !== "object") continue;
    for (const [label, books] of Object.entries(outcomes as Json)) {
      if (!books || typeof books !== "object") continue;
      for (const [bk, value] of Object.entries(books as Json)) add(coll, market, label, value, bk);
    }
  }
  return collect(coll);
}

function parseOddsNode(sport: Sport, node: unknown): Market[] {
  if (!node) return [];
  if (Array.isArray(node)) return parseFootballOdds(node as Json[]);
  if (typeof node === "object") {
    return sport === "football" && "odd_1" in (node as Json)
      ? parseFootballOdds([node as Json])
      : parseNestedOdds(node as Json);
  }
  return [];
}

/** Merge market feeds without losing outcomes that exist in only one feed. */
function mergeMarkets(...feeds: Market[][]): Market[] {
  const merged = new Map<string, Market>();
  for (const market of feeds.flat()) {
    const key = market.name.toLowerCase();
    const previous = merged.get(key);
    if (!previous) {
      merged.set(key, market);
      continue;
    }
    const outcomes = new Map(previous.outcomes.map((outcome) => [outcome.label.toLowerCase(), outcome]));
    for (const outcome of market.outcomes) {
      const current = outcomes.get(outcome.label.toLowerCase());
      if (!current || outcome.odd > current.odd) outcomes.set(outcome.label.toLowerCase(), outcome);
    }
    merged.set(key, { name: previous.name, outcomes: [...outcomes.values()] });
  }
  return [...merged.values()];
}

async function fetchOdds(
  sport: Sport,
  range: Record<string, string>,
  ttlMs = 5 * 60_000,
): Promise<Map<string, Market[]>> {
  const out = new Map<string, Market[]>();
  try {
    const res = await call<Record<string, unknown>>(sport, { met: "Odds", ...range }, ttlMs);
    for (const [matchId, node] of Object.entries(res ?? {})) {
      const markets = parseOddsNode(sport, node);
      if (markets.length) out.set(String(matchId), markets);
    }
  } catch {
    /* odds are optional */
  }
  return out;
}

/**
 * Live (in-play) odds rows -> markets. The provider ships a flat list per match
 * (`met=OddsLive`), refreshed every few seconds, so these prices always win over
 * the cached pre-match list.
 */
function parseLiveOdds(rows: Json[]): Market[] {
  const coll: Collector = new Map();
  for (const r of rows) {
    if (String(r["is_odd_suspended"] ?? "") === "Yes") continue;
    const raw = String(r["odd_name"] ?? "").trim();
    const hc = String(r["odd_participant_handicap"] ?? "").trim();
    const type = String(r["odd_type"] ?? "-").trim();
    let name = raw ? `LIVE · ${raw}${hc ? ` ${hc}` : ""}` : "LIVE · Market";
    let label = type;
    if (/^1x2$/i.test(raw)) {
      name = "1X2";
      label = /^home$/i.test(type) ? "1" : /^draw$/i.test(type) ? "X" : /^away$/i.test(type) ? "2" : type;
    } else if (/^(over\/under|total|totals|goals over\/under)$/i.test(raw)) {
      name = `Total Goals${hc ? ` ${hc}` : ""}`;
    } else if (/both teams to score|btts/i.test(raw)) {
      name = "Both teams to score";
    } else if (/^double chance$/i.test(raw)) {
      name = "Double chance";
      label = /home\/draw|1x/i.test(type) ? "1X" : /draw\/away|x2/i.test(type) ? "X2" : /home\/away|12/i.test(type) ? "12" : type;
    }
    add(coll, name, label, r["odd_value"], "Live");
  }
  return collect(coll);
}

/** Bulk in-play odds for every live football event (optionally scoped). */
async function fetchLiveOdds(
  sport: Sport,
  range: Record<string, string>,
): Promise<Map<string, Market[]>> {
  const out = new Map<string, Market[]>();
  if (sport !== "football") return out;
  try {
    // Short TTL: in-play prices move constantly, so the feed is re-read often.
    const res = await call<Record<string, unknown>>(sport, { met: "OddsLive", ...range }, 6_000);
    for (const [matchId, node] of Object.entries(res ?? {})) {
      if (!Array.isArray(node)) continue;
      const markets = parseLiveOdds(node as Json[]);
      if (markets.length) out.set(String(matchId), markets);
    }
  } catch {
    /* live odds are optional */
  }
  return out;
}

/* ---------------- normalisation ---------------- */

export type { MainOdds } from "./allsports.server-types";
import type { MainOdds } from "./allsports.server-types";
import { derivedMainOdds, derivedMarkets, isUnpriced } from "./derived-odds";

/** Sports where a fixture can end level, so the X column is meaningful. */
const DRAW_SPORTS: Record<string, boolean> = {
  football: true,
  cricket: false,
  basketball: false,
  tennis: false,
};

/**
 * Main-market prices for a fixture, falling back to derived pricing whenever
 * the provider publishes no usable market. Keeps every playable fixture
 * bettable instead of showing an empty row.
 */
function resolvedOdds(
  sport: Sport,
  markets: Market[],
  fixture: { id: string; home: string; away: string; finished: boolean },
): MainOdds {
  const real = mainOdds(sport, markets);
  if (!isUnpriced(real) || fixture.finished || !fixture.id) return real;
  return derivedMainOdds({
    id: fixture.id,
    home: fixture.home,
    away: fixture.away,
    drawPossible: DRAW_SPORTS[sport] ?? true,
  });
}

export type PeriodScore = { label: string; home: string; away: string };

export type Match = {
  id: string;
  sport: Sport;
  date: string;
  time: string;
  kickoff: string;
  league: string;
  leagueKey: number;
  leagueLogo: string | null;
  country: string;
  round: string;
  season: string;
  stadium: string;
  status: string;
  live: boolean;
  finished: boolean;
  home: string;
  away: string;
  homeKey: number;
  awayKey: number;
  homeLogo: string | null;
  awayLogo: string | null;
  homeScore: string | null;
  awayScore: string | null;
  periods: PeriodScore[];
  marketCount: number;
  odds: MainOdds;
};

function splitScore(result: unknown): [string | null, string | null] {
  const s = typeof result === "string" ? result : "";
  const parts = s.split("-").map((p) => p.trim());
  if (parts.length !== 2 || !parts[0] || !parts[1]) return [null, null];
  return [parts[0], parts[1]];
}

function pickOutcome(markets: Market[], market: string, labels: string[]): number | null {
  const m = markets.find((x) => x.name.toLowerCase() === market.toLowerCase());
  if (!m) return null;
  for (const l of labels) {
    const o = m.outcomes.find((x) => x.label.toLowerCase() === l.toLowerCase());
    if (o) return o.odd;
  }
  return null;
}

/** First market whose name matches, then the first outcome matching any label. */
function pickAny(markets: Market[], namePattern: RegExp, labels: RegExp[]): number | null {
  for (const m of markets) {
    if (!namePattern.test(m.name)) continue;
    for (const lp of labels) {
      const o = m.outcomes.find((x) => lp.test(x.label));
      if (o) return o.odd;
    }
  }
  return null;
}

const HOME_LABELS = [/^1$/i, /^home$/i, /^host/i];
const DRAW_LABELS = [/^x$/i, /^draw$/i, /^tie$/i];
const AWAY_LABELS = [/^2$/i, /^away$/i, /^guest/i];

function mainOdds(sport: Sport, markets: Market[]): MainOdds {
  if (markets.length === 0) {
    return {
      home: null,
      draw: null,
      away: null,
      over: null,
      under: null,
      bttsYes: null,
      bttsNo: null,
      line: "",
    };
  }
  // Any 3-way / 2-way result market can feed the 1 X 2 columns, whatever the
  // provider named it for this sport or bookmaker.
  const resultName = /^(1x2|home\/away|3way result|match winner|winner|result|to win)/i;
  const home =
    pickOutcome(markets, "1X2", ["1", "Home"]) ??
    pickOutcome(markets, "Home/Away", ["Home", "1"]) ??
    pickAny(markets, resultName, HOME_LABELS) ??
    pickAny(markets, /.*/, HOME_LABELS);
  const draw =
    pickOutcome(markets, "1X2", ["X", "Draw"]) ??
    pickOutcome(markets, "3Way Result", ["Draw", "X"]) ??
    pickAny(markets, resultName, DRAW_LABELS) ??
    pickAny(markets, /.*/, DRAW_LABELS);
  const away =
    pickOutcome(markets, "1X2", ["2", "Away"]) ??
    pickOutcome(markets, "Home/Away", ["Away", "2"]) ??
    pickAny(markets, resultName, AWAY_LABELS) ??
    pickAny(markets, /.*/, AWAY_LABELS);

  // Totals: prefer the classic line for the sport, else the first totals market.
  const preferred =
    sport === "football"
      ? markets.find((m) => /(total goals|goals over\/under) 2\.5/i.test(m.name))
      : undefined;
  const totals =
    preferred ??
    markets.find((m) => /^total|over\/under|number of (sets|games)/i.test(m.name)) ??
    markets.find((m) => m.outcomes.some((o) => /^over/i.test(o.label)));
  const over = totals ? (totals.outcomes.find((o) => /^over/i.test(o.label))?.odd ?? totals.outcomes[0]?.odd ?? null) : null;
  const under = totals ? (totals.outcomes.find((o) => /^under/i.test(o.label))?.odd ?? totals.outcomes[1]?.odd ?? null) : null;

  const bttsName = /both teams to score|btts|goal\/no goal|gg\/ng/i;
  const bttsYes = pickAny(markets, bttsName, [/^yes$/i, /^gg$/i, /^goal$/i]);
  const bttsNo = pickAny(markets, bttsName, [/^no$/i, /^ng$/i, /^no goal$/i]);

  return { home, draw, away, over, under, bttsYes, bttsNo, line: totals?.name ?? "" };
}


function periodScores(sport: Sport, f: Json): PeriodScore[] {
  const raw = f["scores"];
  if (sport === "basketball" && raw && typeof raw === "object" && !Array.isArray(raw)) {
    return Object.entries(raw as Json).flatMap(([label, arr]) => {
      const first = Array.isArray(arr) ? (arr[0] as Json | undefined) : undefined;
      if (!first) return [];
      return [
        {
          label,
          home: String(first["score_home"] ?? ""),
          away: String(first["score_away"] ?? ""),
        },
      ];
    });
  }
  if (sport === "tennis" && Array.isArray(raw)) {
    return (raw as Json[]).map((s, i) => ({
      label: String(s["score_set"] ?? `Set ${i + 1}`),
      home: String(s["score_first"] ?? ""),
      away: String(s["score_second"] ?? ""),
    }));
  }
  const ht = f["event_halftime_result"];
  const [h, a] = splitScore(ht);
  return h && a ? [{ label: "Half time", home: h, away: a }] : [];
}

function normalise(sport: Sport, f: Json, markets: Market[]): Match {
  const isTennis = sport === "tennis";
  const home = String((isTennis ? f["event_first_player"] : f["event_home_team"]) ?? "");
  const away = String((isTennis ? f["event_second_player"] : f["event_away_team"]) ?? "");
  const homeLogo = (isTennis
    ? f["event_first_player_logo"]
    : (f["home_team_logo"] ?? f["event_home_team_logo"])) as string | null;
  const awayLogo = (isTennis
    ? f["event_second_player_logo"]
    : (f["away_team_logo"] ?? f["event_away_team_logo"])) as string | null;
  const [homeScore, awayScore] = splitScore(f["event_final_result"]);
  const status = String(f["event_status"] ?? "");
  const date = dateKey(f);
  const time = String(f["event_time"] ?? "");
  const id = String(f["event_key"] ?? "");
  const isFinished = FINISHED_RE.test(status) || VOID_RE.test(status);

  return {
    id,
    sport,
    date,
    time,
    kickoff: `${date}T${time}:00Z`,
    league: String(f["league_name"] ?? ""),
    leagueKey: Number(f["league_key"] ?? 0),
    leagueLogo: (f["league_logo"] as string | null) ?? null,
    country: String(f["country_name"] ?? ""),
    round: String(f["league_round"] ?? ""),
    season: String(f["league_season"] ?? ""),
    stadium: String(f["event_stadium"] ?? ""),
    status,
    live:
      date === ymd(0) &&
      !FINISHED_RE.test(status) &&
      !VOID_RE.test(status) &&
      (String(f["event_live"] ?? "0") === "1" ||
        /^\d+|half|^ht$|break|set \d|quarter|q\d|^ot$|pen/i.test(status)),
    finished: isFinished,

    home,
    away,
    homeKey: Number((isTennis ? f["first_player_key"] : f["home_team_key"]) ?? 0),
    awayKey: Number((isTennis ? f["second_player_key"] : f["away_team_key"]) ?? 0),
    homeLogo: homeLogo ?? null,
    awayLogo: awayLogo ?? null,
    homeScore,
    awayScore,
    periods: periodScores(sport, f),
    marketCount: markets.length,
    odds: resolvedOdds(sport, markets, { id, home, away, finished: isFinished }),
  };
}

/* ---------------- public API ---------------- */

export type MatchScope = "live" | "today" | "upcoming" | "results" | "boosted" | "topbets";

/** Curated "Top Bets" competitions, per sport. */
const TOP_BETS: Record<Sport, RegExp> = {
  football:
    /premier league|laliga|la liga|serie a|bundesliga|ligue 1|eredivisie|primeira liga|champions league|europa league|conference league|uefa super cup|efl cup|carabao|copa libertadores|copa sudamericana|brasileir|serie b|liga profesional|primera divisi|primera a|division profesional|copa do brasil|leagues cup|club friendlies|clubs friendlies|friendlies/i,
  basketball: /\bnba\b|euroleague|eurocup|acb|\bbbl\b/i,
  tennis: /atp|wta|grand slam|australian open|roland garros|wimbledon|us open|masters/i,
  cricket: /world cup|champions trophy|premier league|big bash|the hundred|test|odi|t20/i,
};

export type MatchQuery = {
  sport: Sport;
  scope: MatchScope;
  leagueId?: number | null;
  countryId?: number | null;
  /** Multi-select filters — every selected league / country is fetched and merged. */
  leagueIds?: number[] | null;
  countryIds?: number[] | null;
};

/** Run promises with a small concurrency limit so the provider isn't flooded. */
async function pool<T>(items: T[], limit: number, run: (item: T) => Promise<void>) {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const item = items[i++]!;
      await run(item);
    }
  });
  await Promise.all(workers);
}

export async function fetchMatches(q: MatchQuery): Promise<Match[]> {
  const { sport, scope } = q;

  const uniq = (list: Array<number | null | undefined>) => [
    ...new Set(list.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0)),
  ];
  const leagueIds = uniq([...(q.leagueIds ?? []), q.leagueId]);
  const countryIds = uniq([...(q.countryIds ?? []), q.countryId]);

  // One provider request per selected league / country, merged into one list.
  const variants: Array<Record<string, string>> = [
    ...leagueIds.map((id) => ({ leagueId: String(id) })),
    ...countryIds.map((id) => ({ countryId: String(id) })),
  ];
  if (variants.length === 0) variants.push({});
  const hasFilter = leagueIds.length > 0 || countryIds.length > 0;

  // The provider hard-rejects windows wider than 7 days ("Maximum date range
  // for odds is 7 days"), which silently emptied whole sports. Request narrow
  // week-long chunks and merge them so Upcoming can still reach months ahead.
  const WINDOW = 6; // inclusive from..to => 7 days
  const chunks = (fromDay: number, toDay: number) => {
    const out: Array<{ from: string; to: string }> = [];
    for (let start = fromDay; start <= toDay; start += WINDOW + 1) {
      out.push({ from: ymd(start), to: ymd(Math.min(start + WINDOW, toDay)) });
    }
    return out;
  };

  // Upcoming is always requested through the end of the current calendar
  // year. This keeps long-range fixtures and every price already published by
  // the provider visible (for example August through December league games).
  const endOfYear = Math.max(
    0,
    Math.ceil((Date.UTC(ugNow().getUTCFullYear(), 11, 31) - ugNow().getTime()) / 86_400_000),
  );
  const ranges =
    scope === "today" || scope === "live" || scope === "boosted"
      ? [{ from: ymd(0), to: ymd(0) }]
      : scope === "upcoming" || scope === "topbets"
        ? // A filtered list must show everything the competition has scheduled,
          // however far out that is.
          chunks(0, endOfYear)
        : chunks(hasFilter ? -60 : -7, 0);

  const combos = variants.flatMap((v) => ranges.map((range) => ({ ...v, ...range })));

  const rows: Json[] = [];
  const odds = new Map<string, Market[]>();

  if (scope === "live") {
    await pool(variants, 4, async (v) => {
      // In-play scores must be as fresh as the odds beside them.
      const r = await call<unknown>(sport, { met: "Livescore", ...v }, 6_000);
      rows.push(...rowsOf(r));
      // The Livescore feed is unreliable for some sports (it can answer empty
      // while today's fixture list clearly shows games in play), so today's
      // fixtures are merged in and filtered by the same in-play test.
      const f = await call<unknown>(
        sport,
        { met: "Fixtures", from: ymd(0), to: ymd(0), ...v },
        30_000,
      );
      rows.push(...rowsOf(f));
    });
  } else {
    await pool(combos, 5, async (c) => {
      const r = await call<unknown>(sport, { met: "Fixtures", ...c }, 3 * 60_000);
      rows.push(...rowsOf(r));
    });
  }

  await pool(combos, 5, async (c) => {
    const m = await fetchOdds(sport, c, scope === "live" || scope === "today" ? 30_000 : 5 * 60_000);
    for (const [k, v] of m) odds.set(k, v);
  });

  // In-play prices override the pre-match list, market by market, so a live
  // list always shows the provider's latest live odds.
  if (scope === "live" || scope === "today") {
    await pool(variants, 4, async (v) => {
      const live = await fetchLiveOdds(sport, v);
      for (const [id, liveMarkets] of live) {
        const merged = new Map<string, Market>();
        for (const mk of odds.get(id) ?? []) merged.set(mk.name, mk);
        for (const mk of liveMarkets) merged.set(mk.name, mk);
        odds.set(id, [...merged.values()]);
      }
    });
  }


  const list = [
    ...new Map(
      rows.filter((f) => f && f["event_key"] != null).map((f) => [String(f["event_key"]), f]),
    ).values(),
  ];

  const st = (f: Json) => String(f["event_status"] ?? "");
  const isEnded = (f: Json) => FINISHED_RE.test(st(f));
  const isVoid = (f: Json) => /cancel|postp|abandon|suspend|walkover|retired|awarded/i.test(st(f));
  const isLive = (f: Json) => {
    if (isEnded(f) || isVoid(f)) return false;
    // A future-dated row can carry a numeric status token that is not a match
    // minute, so in-play is only ever claimed for today's games.
    if (dateKey(f) !== ymd(0)) return false;
    if (String(f["event_live"] ?? "0") === "1") return true;
    // Providers also mark in-play games by minute / period status text. The
    // period tokens must be anchored, otherwise "Not Started" matches "ot".
    return /^\d+|half|^ht$|break|set \d|quarter|q\d|^ot$|pen/i.test(st(f));
  };

  const notPlayed = (f: Json) => !isEnded(f) && !isVoid(f);
  const nowMs = ugNow().getTime();
  const upcomingOnly = (f: Json) => {
    if (!notPlayed(f)) return false;
    if (isLive(f)) return false;
    if (splitScore(f["event_final_result"])[0] !== null) return false;
    const start = Date.parse(
      `${dateKey(f)}T${f["event_time"] ?? "00:00"}:00Z`,
    );
    return !Number.isFinite(start) || start >= nowMs - 5 * 60_000;
  };

  let filtered =
    scope === "results"
      ? // Results = ended, postponed, cancelled and abandoned games only — never live ones.
        list.filter((f) => !isLive(f) && (isEnded(f) || isVoid(f)))
      : scope === "today" || scope === "boosted"
        ? // Today = everything still playable today: in-play games plus fixtures
          // that have not kicked off yet. Late in the day almost every fixture
          // has already started, so excluding live games emptied the list.
          list.filter((f) => notPlayed(f) && (isLive(f) || upcomingOnly(f)))
        : scope === "upcoming" || scope === "topbets"
          ? list.filter(upcomingOnly)
          : scope === "live"
            ? // Live = games actually in play right now.
              list.filter(isLive)
            : list;


  // "Today" must never leak tomorrow's fixtures, even if the feed widens the window.
  if (scope === "today" || scope === "boosted") {
    const todayKey = ymd(0);
    filtered = filtered.filter((f) => dateKey(f) === todayKey);
  }

  // Top Bets = the curated shortlist of elite competitions.
  if (scope === "topbets") {
    const re = TOP_BETS[sport];
    filtered = filtered.filter((f) =>
      re.test(`${String(f["country_name"] ?? "")} ${String(f["league_name"] ?? "")}`),
    );
  }


  // Boosted = today's fixtures narrowed to the competitions AI rates as top leagues.
  if (scope === "boosted" && filtered.length > 0) {
    const { pickTopLeagues } = await import("./boosted.server");
    const byLeague = new Map<number, { key: number; label: string; fixtures: number }>();
    for (const f of filtered) {
      const key = Number(f["league_key"] ?? 0);
      if (!key) continue;
      const entry = byLeague.get(key);
      if (entry) entry.fixtures += 1;
      else
        byLeague.set(key, {
          key,
          label: `${String(f["country_name"] ?? "")}. ${String(f["league_name"] ?? "")}`.trim(),
          fixtures: 1,
        });
    }
    const top = new Set(await pickTopLeagues(sport, [...byLeague.values()]));
    if (top.size > 0) filtered = filtered.filter((f) => top.has(Number(f["league_key"] ?? 0)));
  }

  const sorted = filtered.sort((a, b) => {
    const ka = `${dateKey(a)}${a["event_time"]}`;
    const kb = `${dateKey(b)}${b["event_time"]}`;
    return scope === "results" ? kb.localeCompare(ka) : ka.localeCompare(kb);
  });

  const page = sorted.slice(
    0,
    hasFilter ? 2000 : scope === "upcoming" || scope === "topbets" ? 3000 : 1500,
  );

  // The bulk Odds feed skips some fixtures, so top up per match for the ones
  // that came back without any market at all. A filtered list is small, so we
  // can afford to chase many more of them.
  if (scope !== "results") {
    // Chase missing odds for as many fixtures as we can afford. Fixtures that
    // still end up without prices are listed anyway (locked markets), so no
    // country or league can silently disappear.
    const topUpCap = hasFilter ? Math.min(page.length, 500) : 250;
    const missing = page
      .map((f) => String(f["event_key"]))
      .filter((id) => !odds.has(id))
      .slice(0, topUpCap);


    await pool(missing, 14, async (id) => {
      try {
        const res = await call<Record<string, unknown>>(
          sport,
          { met: "Odds", matchId: id },
          2 * 60_000,
        );
        const markets = parseOddsNode(sport, res?.[id] ?? null);
        if (markets.length) odds.set(id, markets);
      } catch {
        /* optional */
      }
    });
  }


  return page.map((f) => normalise(sport, f, odds.get(String(f["event_key"])) ?? []));
}


export type League = {
  key: number;
  name: string;
  country: string;
  countryKey: number;
  logo: string | null;
  countryLogo: string | null;
  sport: Sport;
};

export async function fetchLeagues(sport: Sport): Promise<League[]> {
  const res = (await call<Json[]>(sport, { met: "Leagues" }, 60 * 60_000)) ?? [];
  return res.map((l) => ({
    key: Number(l["league_key"] ?? 0),
    name: String(l["league_name"] ?? "").trim(),
    country: String(l["country_name"] ?? "").trim(),
    countryKey: Number(l["country_key"] ?? 0),
    logo: (l["league_logo"] as string | null) ?? null,
    countryLogo: (l["country_logo"] as string | null) ?? null,
    sport,
  }));
}

/** Live event counts per sport, for sidebar badges. */
export async function fetchLiveCounts(): Promise<Record<Sport, number>> {
  // Counts must use exactly the same in-play test as the live list, otherwise a
  // badge promises matches the page cannot show.
  const rowIsLive = (f: Json) => {
    const status = String(f["event_status"] ?? "");
    if (dateKey(f) !== ymd(0)) return false;
    if (FINISHED_RE.test(status) || VOID_RE.test(status)) return false;
    if (String(f["event_live"] ?? "0") === "1") return true;
    return /^\d+|half|^ht$|break|set \d|quarter|q\d|^ot$|pen/i.test(status);
  };
  const entries = await Promise.all(
    SPORTS.map(async (sport) => {
      try {
        const [livescore, fixtures] = await Promise.all([
          call<unknown>(sport, { met: "Livescore" }, 30_000),
          call<unknown>(sport, { met: "Fixtures", from: ymd(0), to: ymd(0) }, 30_000),
        ]);
        const rows = [...rowsOf(livescore), ...rowsOf(fixtures)];
        const unique = new Map(
          rows.filter((f) => f && f["event_key"] != null).map((f) => [String(f["event_key"]), f]),
        );
        return [sport, [...unique.values()].filter(rowIsLive).length] as const;
      } catch {
        return [sport, 0] as const;
      }
    }),
  );
  return Object.fromEntries(entries) as Record<Sport, number>;
}

export type H2HGame = {
  id: string;
  date: string;
  league: string;
  home: string;
  away: string;
  result: string;
};

export type StatRow = { type: string; home: string; away: string };

export type StandingRow = {
  place: number;
  team: string;
  teamKey: number;
  played: number;
  win: number;
  draw: number;
  loss: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
};

export type EventRow = {
  time: string;
  side: "home" | "away";
  player: string;
  detail: string;
};

export type LineupPlayer = { name: string; number: string; position: string };
export type TeamLineup = {
  starting: LineupPlayer[];
  substitutes: LineupPlayer[];
  coach: string;
  missing: LineupPlayer[];
};
export type VideoItem = { title: string; url: string };
export type CommentRow = { time: string; text: string; info: string };
export type ProbabilityRow = { label: string; home: number; away: number };
export type BoxScorePlayer = {
  name: string;
  position: string;
  minutes: string;
  points: string;
  rebounds: string;
  assists: string;
  steals: string;
  blocks: string;
  turnovers: string;
  fouls: string;
  plusMinus: string;
};
export type BoxScore = { home: BoxScorePlayer[]; away: BoxScorePlayer[] };

export type MatchDetails = {
  match: Match | null;
  markets: Market[];
  statistics: StatRow[];
  h2h: H2HGame[];
  homeRecent: H2HGame[];
  awayRecent: H2HGame[];
  standings: StandingRow[];
  goals: EventRow[];
  cards: EventRow[];
  substitutions: EventRow[];
  lineups: { home: TeamLineup; away: TeamLineup } | null;
  videos: VideoItem[];
  comments: CommentRow[];
  probabilities: ProbabilityRow[];
  boxScore: BoxScore | null;
  referee: string;
};

/** Provider `Probabilities` row -> readable percentage pairs. */
function toProbabilities(raw: unknown): ProbabilityRow[] {
  const row = (Array.isArray(raw) ? (raw[0] as Json | undefined) : undefined) ?? null;
  if (!row) return [];
  const pct = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n) : null;
  };
  const pairs: Array<[string, unknown, unknown]> = [
    ["Home win / Away win", row["event_HW"], row["event_AW"]],
    ["Draw", row["event_D"], row["event_D"]],
    ["Home or draw / Away or draw", row["event_HW_D"], row["event_AW_D"]],
    ["Both teams score / No goal", row["event_bts"], row["event_ots"]],
    ["Over 2.5 / Under 2.5", row["event_O"], row["event_U"]],
    ["Over 1.5 / Under 1.5", row["event_O_1"], row["event_U_1"]],
    ["Over 3.5 / Under 3.5", row["event_O_3"], row["event_U_3"]],
  ];
  for (const line of ["05", "15", "25", "35", "45"]) {
    pairs.push([
      `Asian handicap ${line[0]}.${line[1]}`,
      row[`event_ah_h_${line}`],
      row[`event_ah_a_${line}`],
    ]);
  }
  return pairs
    .map(([label, h, a]) => ({ label, home: pct(h) ?? -1, away: pct(a) ?? -1 }))
    .filter((p) => p.home >= 0 && p.away >= 0);
}

function toComments(raw: unknown, matchId: string): CommentRow[] {
  const node = (raw && typeof raw === "object" ? (raw as Json) : {}) as Json;
  const list = Array.isArray(node[matchId])
    ? (node[matchId] as Json[])
    : (Object.values(node).find(Array.isArray) as Json[] | undefined) ?? [];
  return list
    .map((c) => ({
      time: String(c["comments_time"] ?? ""),
      text: String(c["comments_text"] ?? ""),
      info: String(c["comments_state_info"] ?? ""),
    }))
    // Straight chronological order, exactly as the provider commentates it.
    .filter((c) => c.text);
}

function toBoxScore(raw: unknown): BoxScore | null {
  if (!raw || typeof raw !== "object") return null;
  const node = raw as Json;
  const side = (v: unknown): BoxScorePlayer[] =>
    (Array.isArray(v) ? (v as Json[]) : []).map((p) => ({
      name: String(p["player"] ?? ""),
      position: String(p["player_position"] ?? ""),
      minutes: String(p["player_minutes"] ?? ""),
      points: String(p["player_points"] ?? ""),
      rebounds: String(p["player_total_rebounds"] ?? ""),
      assists: String(p["player_assists"] ?? ""),
      steals: String(p["player_steals"] ?? ""),
      blocks: String(p["player_blocks"] ?? ""),
      turnovers: String(p["player_turnovers"] ?? ""),
      fouls: String(p["player_personal_fouls"] ?? ""),
      plusMinus: String(p["player_plus_minus"] ?? ""),
    })).filter((p) => p.name);
  const home = side(node["home_team"]);
  const away = side(node["away_team"]);
  return home.length || away.length ? { home, away } : null;
}



function toGame(sport: Sport, g: Json): H2HGame {
  const isTennis = sport === "tennis";
  return {
    id: String(g["event_key"] ?? ""),
    date: String(g["event_date"] ?? ""),
    league: String(g["league_name"] ?? ""),
    home: String((isTennis ? g["event_first_player"] : g["event_home_team"]) ?? ""),
    away: String((isTennis ? g["event_second_player"] : g["event_away_team"]) ?? ""),
    result: String(g["event_final_result"] ?? "-"),
  };
}

function toStats(raw: unknown): StatRow[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Json[])
    .map((s) => ({
      type: String(s["type"] ?? ""),
      home: String(s["home"] ?? ""),
      away: String(s["away"] ?? ""),
    }))
    .filter((s) => s.type);
}

async function fetchStandings(sport: Sport, leagueKey: number): Promise<StandingRow[]> {
  if (!leagueKey) return [];
  const res = await call<{ total?: Json[] }>(
    sport,
    { met: "Standings", leagueId: String(leagueKey) },
    30 * 60_000,
  );
  const rows = res?.total ?? [];
  return rows
    .map((s) => ({
      place: Number(s["standing_place"] ?? 0),
      team: String(s["standing_team"] ?? ""),
      teamKey: Number(s["team_key"] ?? 0),
      played: Number(s["standing_P"] ?? 0),
      win: Number(s["standing_W"] ?? 0),
      draw: Number(s["standing_D"] ?? 0),
      loss: Number(s["standing_L"] ?? 0),
      goalsFor: Number(s["standing_F"] ?? 0),
      goalsAgainst: Number(s["standing_A"] ?? 0),
      points: Number(s["standing_PTS"] ?? 0),
    }))
    .sort((a, b) => a.place - b.place || b.points - a.points);
}

function toEventRows(raw: unknown, kind: "goal" | "card" | "sub"): EventRow[] {
  if (!Array.isArray(raw)) return [];
  const rows: EventRow[] = [];
  for (const e of raw as Json[]) {
    const time = String(e["time"] ?? "");
    for (const side of ["home", "away"] as const) {
      if (kind === "goal") {
        const player = String(e[`${side}_scorer`] ?? "").trim();
        if (!player) continue;
        const assist = String(e[`${side}_assist`] ?? "").trim();
        rows.push({
          time,
          side,
          player,
          detail: [String(e["score"] ?? ""), assist ? `assist ${assist}` : "", String(e["info"] ?? "")]
            .filter(Boolean)
            .join(" · "),
        });
      } else if (kind === "card") {
        const player = String(e[`${side}_fault`] ?? "").trim();
        if (!player) continue;
        rows.push({ time, side, player, detail: String(e["card"] ?? "card") });
      } else {
        const node = e[`${side}_scorer`];
        if (!node || typeof node !== "object") continue;
        const inn = String((node as Json)["in"] ?? "").trim();
        const out = String((node as Json)["out"] ?? "").trim();
        if (!inn && !out) continue;
        rows.push({ time, side, player: inn || out, detail: out ? `out: ${out}` : "" });
      }
    }
  }
  return rows.sort((a, b) => parseInt(a.time || "0", 10) - parseInt(b.time || "0", 10));
}

function toPlayers(raw: unknown): LineupPlayer[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Json[])
    .map((p) => ({
      name: String(p["player"] ?? "").trim(),
      number: String(p["player_number"] ?? ""),
      position: String(p["player_position"] ?? ""),
    }))
    .filter((p) => p.name);
}

function toTeamLineup(raw: unknown): TeamLineup {
  const n = (raw && typeof raw === "object" ? raw : {}) as Json;
  const coaches = toPlayers(n["coaches"]);
  return {
    starting: toPlayers(n["starting_lineups"]),
    substitutes: toPlayers(n["substitutes"]),
    coach: coaches[0]?.name ?? "",
    missing: toPlayers(n["missing_players"]),
  };
}

/**
 * Highlight search on YouTube, used when the provider publishes no video for
 * a fixture. Parses the public results page (no API key required) and returns
 * the first few clips.
 */
/** Video-game / simulation uploads that must never pass as real highlights. */
const FAKE_VIDEO_RE =
  /\b(pes\s?\d*|efootball|fifa\s?\d+|fc\s?2[45]|pc\s?game|gameplay|game\s?play|simulation|simulated|prediction|predictions|preview\s?show|tips|betting|fm\s?\d+|football\s?manager|dream\s?league|ps[45]|xbox|mod|patch|realistic|recreation|emulator|sub\s?vs)\b/i;

async function youtubeVideos(query: string, limit = 6): Promise<VideoItem[]> {
  try {
    const res = await fetch(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAQ%253D%253D`,
      { headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "en" } },
    );
    if (!res.ok) return [];
    const html = await res.text();
    const re = /"videoId":"([\w-]{11})"[\s\S]{0,400}?"text":"([^"]{5,120})"/g;
    const seen = new Set<string>();
    const out: VideoItem[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) && out.length < limit) {
      const id = m[1]!;
      if (seen.has(id)) continue;
      seen.add(id);
      const raw = m[2] ?? "Highlights";
      const title = raw
        .replace(/\\u([\dA-Fa-f]{4})/g, (_s, h: string) => String.fromCharCode(parseInt(h, 16)))
        .replace(/\\(.)/g, "$1")
        .trim();
      if (FAKE_VIDEO_RE.test(title)) continue;
      out.push({ title: title || "Highlights", url: `https://www.youtube.com/watch?v=${id}` });
    }
    return out;
  } catch {
    return [];
  }
}

/** Provider videos first; YouTube highlights when the provider has none. */
async function resolveVideos(
  raw: Json[] | null,
  fixture: { home: string; away: string; league: string; finished: boolean },
): Promise<VideoItem[]> {
  const provider = (raw ?? [])
    .map((v) => ({
      title: String(v["video_title_full"] ?? v["video_title"] ?? "Highlight"),
      url: String(v["video_url"] ?? ""),
    }))
    .filter((v) => v.url);
  if (provider.length) return provider;
  if (!fixture.home || !fixture.away) return [];
  const suffix = fixture.finished ? "highlights" : "preview";
  const league = fixture.league ? ` ${fixture.league}` : "";
  const primary = await youtubeVideos(
    `"${fixture.home}" vs "${fixture.away}"${league} ${suffix} -PES -eFootball -FIFA -gameplay`,
  );
  if (primary.length) return primary;
  return youtubeVideos(`${fixture.home} vs ${fixture.away} ${suffix} -gameplay -PES -eFootball`);
}

export async function fetchMatchDetails(sport: Sport, matchId: string): Promise<MatchDetails> {
  const empty: MatchDetails = {
    match: null,
    markets: [],
    statistics: [],
    h2h: [],
    homeRecent: [],
    awayRecent: [],
    standings: [],
    goals: [],
    cards: [],
    substitutions: [],
    lineups: null,
    videos: [],
    comments: [],
    probabilities: [],
    boxScore: null,
    referee: "",

  };

  const live = (await call<Json[]>(sport, { met: "Livescore", matchId }, 6_000)) ?? [];
  const fixture =
    live[0] ?? ((await call<Json[]>(sport, { met: "Fixtures", matchId }, 60_000)) ?? [])[0] ?? null;
  if (!fixture) return empty;

  const isTennis = sport === "tennis";
  const firstTeamId = String((isTennis ? fixture["first_player_key"] : fixture["home_team_key"]) ?? "");
  const secondTeamId = String(
    (isTennis ? fixture["second_player_key"] : fixture["away_team_key"]) ?? "",
  );

  const isFootball = sport === "football";

  const [oddsRes, fullOddsRes, h2hRes, standings, videoRes, probRes, commentRes] =
    await Promise.all([
      call<Record<string, unknown>>(sport, { met: "Odds", matchId }, 3 * 60_000).catch(() => null),
      call<Record<string, unknown>>(sport, { met: "FullOdds", matchId }, 3 * 60_000).catch(
        () => null,
      ),
      firstTeamId && secondTeamId
        ? call<{ H2H?: Json[]; firstTeamResults?: Json[]; secondTeamResults?: Json[] }>(
            sport,
            { met: "H2H", firstTeamId, secondTeamId },
            10 * 60_000,
          ).catch(() => null)
        : Promise.resolve(null),
      fetchStandings(sport, Number(fixture["league_key"] ?? 0)).catch(() => []),
      call<Json[]>(sport, { met: "Videos", eventId: matchId, matchId }, 10 * 60_000).catch(
        () => null,
      ),
      isFootball
        ? call<Json[]>(sport, { met: "Probabilities", matchId }, 5 * 60_000).catch(() => null)
        : Promise.resolve(null),
      isFootball
        ? call<Record<string, unknown>>(sport, { met: "Comments", matchId }, 8_000).catch(
            () => null,
          )
        : Promise.resolve(null),
    ]);

  // Odds + FullOdds are merged so every market the provider publishes is shown.
  const baseMarkets = parseOddsNode(sport, oddsRes?.[matchId] ?? null);
  const fullMarkets = parseNestedOdds(
    (fullOddsRes?.[matchId] && typeof fullOddsRes[matchId] === "object"
      ? fullOddsRes[matchId]
      : {}) as Json,
  );
  let markets = mergeMarkets(baseMarkets, fullMarkets);
  // In-play prices (football live odds feed) override/extend the pre-match list.
  const isLiveNow = String(fixture["event_live"] ?? "0") === "1";
  if (isFootball && isLiveNow) {
    const liveOdds = await call<Record<string, unknown>>(
      sport,
      { met: "OddsLive", matchId },
      6_000,
    ).catch(() => null);
    const rows = Array.isArray(liveOdds?.[matchId]) ? (liveOdds[matchId] as Json[]) : [];
    markets = mergeMarkets(markets, parseLiveOdds(rows));
  }

  const detailHome = String(
    (isTennis ? fixture["event_first_player"] : fixture["event_home_team"]) ?? "",
  );
  const detailAway = String(
    (isTennis ? fixture["event_second_player"] : fixture["event_away_team"]) ?? "",
  );
  const detailFinished = FINISHED_RE.test(String(fixture["event_status"] ?? ""));
  // Unpriced fixtures get the same derived prices the board shows, so the
  // detail page always lists every market the fixture is bettable on.
  if (!detailFinished && isUnpriced(mainOdds(sport, markets))) {
    markets = mergeMarkets(
      markets,
      derivedMarkets({
        id: matchId,
        home: detailHome,
        away: detailAway,
        drawPossible: DRAW_SPORTS[sport] ?? true,
      }),
    );
  }

  const lineupNode = fixture["lineups"];
  const hasLineups = lineupNode && typeof lineupNode === "object";

  return {
    match: normalise(sport, fixture, markets),
    markets,

    statistics: toStats(fixture["statistics"]),
    h2h: (h2hRes?.H2H ?? []).slice(0, 12).map((g) => toGame(sport, g)),
    homeRecent: (h2hRes?.firstTeamResults ?? []).slice(0, 8).map((g) => toGame(sport, g)),
    awayRecent: (h2hRes?.secondTeamResults ?? []).slice(0, 8).map((g) => toGame(sport, g)),
    standings,
    goals: toEventRows(fixture["goalscorers"], "goal"),
    cards: toEventRows(fixture["cards"], "card"),
    substitutions: toEventRows(fixture["substitutes"], "sub"),
    lineups: hasLineups
      ? {
          home: toTeamLineup((lineupNode as Json)["home_team"]),
          away: toTeamLineup((lineupNode as Json)["away_team"]),
        }
      : null,
    videos: await resolveVideos(videoRes, {
      home: detailHome,
      away: detailAway,
      league: String(fixture["league_name"] ?? ""),
      finished: detailFinished,
    }),
    comments: toComments(commentRes, matchId),
    probabilities: toProbabilities(probRes),
    boxScore: toBoxScore(fixture["player_statistics"]),
    referee: String(fixture["event_referee"] ?? ""),

  };
}


/* ---------------- league activity ---------------- */

export type LeagueActivity = {
  leagueKey: number;
  league: string;
  leagueLogo: string | null;
  country: string;
  countryKey: number;
  countryLogo: string | null;
  matches: number;
  live: number;
  sport: Sport;
};

/**
 * Countries / leagues that actually have fixtures in the requested scope.
 * Used by the sidebar and the countries landing page so no empty competition
 * is ever listed.
 */
export async function fetchLeagueActivity(
  sport: Sport,
  scope: MatchScope = "today",
): Promise<LeagueActivity[]> {
  const rows: Json[] = [];

  if (scope === "live") {
    const [ls, fx] = await Promise.all([
      call<unknown>(sport, { met: "Livescore" }, 20_000),
      call<unknown>(sport, { met: "Fixtures", from: ymd(0), to: ymd(0) }, 30_000),
    ]);
    rows.push(...rowsOf(ls), ...rowsOf(fx));
  } else {
    const ranges =
      scope === "results"
        ? [{ from: ymd(-7), to: ymd(0) }]
        : scope === "today" || scope === "boosted"
          ? [{ from: ymd(0), to: ymd(0) }]
          : [
              { from: ymd(0), to: ymd(6) },
              { from: ymd(7), to: ymd(13) },
              { from: ymd(14), to: ymd(20) },
            ];
    await pool(ranges, 3, async (r) => {
      const res = await call<unknown>(sport, { met: "Fixtures", ...r }, 5 * 60_000);
      rows.push(...rowsOf(res));
    });
  }

  const map = new Map<number, LeagueActivity>();
  const seen = new Set<string>();
  for (const f of rows) {
    const key = Number(f["league_key"] ?? 0);
    if (!key) continue;
    const eventKey = String(f["event_key"] ?? "");
    if (eventKey && seen.has(eventKey)) continue;
    if (eventKey) seen.add(eventKey);

    let entry = map.get(key);
    if (!entry) {
      entry = {
        leagueKey: key,
        league: String(f["league_name"] ?? "").trim(),
        leagueLogo: (f["league_logo"] as string | null) ?? null,
        country: String(f["country_name"] ?? "").trim(),
        countryKey: Number(f["country_key"] ?? 0),
        countryLogo: (f["country_logo"] as string | null) ?? null,
        matches: 0,
        live: 0,
        sport,
      };
      map.set(key, entry);
    }
    entry.matches += 1;
    if (String(f["event_live"] ?? "0") === "1") entry.live += 1;
  }

  return [...map.values()].sort(
    (a, b) => a.country.localeCompare(b.country) || b.matches - a.matches,
  );
}

/* ---------------- provider directory: countries, seasons, teams, players, scorers ---------------- */

export type Country = { key: number; name: string; logo: string | null };

/** All countries the provider covers for a sport (met=Countries). */
export async function fetchCountries(sport: Sport): Promise<Country[]> {
  const res = (await call<Json[]>(sport, { met: "Countries" }, 24 * 60 * 60_000)) ?? [];
  return res
    .map((c) => ({
      key: Number(c["country_key"] ?? 0),
      name: String(c["country_name"] ?? "").trim(),
      logo: (c["country_logo"] as string | null) ?? null,
    }))
    .filter((c) => c.key && c.name)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type Season = { key: string; name: string; current: boolean };

/** Seasons available for a competition (met=Seasons). */
export async function fetchSeasons(sport: Sport, leagueKey: number): Promise<Season[]> {
  if (!leagueKey) return [];
  const res =
    (await call<Json[]>(sport, { met: "Seasons", leagueId: String(leagueKey) }, 6 * 60 * 60_000)) ??
    [];
  return res.map((s) => ({
    key: String(s["seasonKey"] ?? s["season_key"] ?? s["season"] ?? ""),
    name: String(s["seasonName"] ?? s["season_name"] ?? s["season"] ?? ""),
    current: String(s["seasonCurrent"] ?? s["current"] ?? "") === "1",
  }));
}

export type SquadPlayer = {
  key: number;
  name: string;
  number: string;
  position: string;
  age: string;
  image: string | null;
  goals: number;
  assists: number;
  yellow: number;
  red: number;
  matches: number;
};

export type Team = {
  key: number;
  name: string;
  logo: string | null;
  coach: string;
  players: SquadPlayer[];
};

function toSquad(raw: unknown): SquadPlayer[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Json[])
    .map((p) => ({
      key: Number(p["player_key"] ?? 0),
      name: String(p["player_name"] ?? "").trim(),
      number: String(p["player_number"] ?? ""),
      position: String(p["player_type"] ?? p["player_position"] ?? ""),
      age: String(p["player_age"] ?? ""),
      image: (p["player_image"] as string | null) || null,
      goals: Number(p["player_goals"] ?? 0) || 0,
      assists: Number(p["player_assists"] ?? 0) || 0,
      yellow: Number(p["player_yellow_cards"] ?? 0) || 0,
      red: Number(p["player_red_cards"] ?? 0) || 0,
      matches: Number(p["player_match_played"] ?? 0) || 0,
    }))
    .filter((p) => p.name);
}

/** Teams of a competition, one team, or a name search (met=Teams). */
export async function fetchTeams(
  sport: Sport,
  q: { leagueKey?: number | null; teamKey?: number | null; search?: string | null },
): Promise<Team[]> {
  const params: Record<string, string> = { met: "Teams" };
  if (q.teamKey) params["teamId"] = String(q.teamKey);
  else if (q.leagueKey) params["leagueId"] = String(q.leagueKey);
  else if (q.search) params["teamName"] = q.search;
  else return [];

  const res = (await call<Json[]>(sport, params, 30 * 60_000)) ?? [];
  return res.map((t) => ({
    key: Number(t["team_key"] ?? 0),
    name: String(t["team_name"] ?? "").trim(),
    logo: (t["team_logo"] as string | null) ?? null,
    coach: String(
      Array.isArray(t["coaches"])
        ? ((t["coaches"] as Json[])[0]?.["coache_name"] ??
            (t["coaches"] as Json[])[0]?.["coach_name"] ??
            "")
        : "",
    ),
    players: toSquad(t["players"]),
  }));
}

export type PlayerRow = {
  key: number;
  name: string;
  image: string | null;
  team: string;
  teamKey: number;
  number: string;
  position: string;
  age: string;
  matches: number;
  goals: number;
  assists: number;
  yellow: number;
  red: number;
};

/** Player search / player profile (met=Players). */
export async function fetchPlayers(
  sport: Sport,
  q: { search?: string | null; playerKey?: number | null; teamKey?: number | null },
): Promise<PlayerRow[]> {
  const params: Record<string, string> = { met: "Players" };
  if (q.playerKey) params["playerId"] = String(q.playerKey);
  else if (q.teamKey) params["teamId"] = String(q.teamKey);
  else if (q.search && q.search.trim().length >= 3) params["playerName"] = q.search.trim();
  else return [];

  const res = (await call<Json[]>(sport, params, 10 * 60_000)) ?? [];
  return res
    .map((p) => ({
      key: Number(p["player_key"] ?? 0),
      name: String(p["player_name"] ?? "").trim(),
      image: (p["player_image"] as string | null) || null,
      team: String(p["team_name"] ?? ""),
      teamKey: Number(p["team_key"] ?? 0),
      number: String(p["player_number"] ?? ""),
      position: String(p["player_type"] ?? ""),
      age: String(p["player_age"] ?? ""),
      matches: Number(p["player_match_played"] ?? 0) || 0,
      goals: Number(p["player_goals"] ?? 0) || 0,
      assists: Number(p["player_assists"] ?? 0) || 0,
      yellow: Number(p["player_yellow_cards"] ?? 0) || 0,
      red: Number(p["player_red_cards"] ?? 0) || 0,
    }))
    .filter((p) => p.name);
}

export type TopScorer = {
  place: number;
  player: string;
  playerKey: number;
  team: string;
  teamKey: number;
  goals: number;
  assists: number;
};

/** Competition top scorers (met=Topscorers). */
export async function fetchTopScorers(sport: Sport, leagueKey: number): Promise<TopScorer[]> {
  if (!leagueKey) return [];
  const res =
    (await call<Json[]>(sport, { met: "Topscorers", leagueId: String(leagueKey) }, 30 * 60_000)) ??
    [];
  return res
    .map((s) => ({
      place: Number(s["player_place"] ?? 0),
      player: String(s["player_name"] ?? "").trim(),
      playerKey: Number(s["player_key"] ?? 0),
      team: String(s["team_name"] ?? ""),
      teamKey: Number(s["team_key"] ?? 0),
      goals: Number(s["goals"] ?? 0) || 0,
      assists: Number(s["assists"] ?? 0) || 0,
    }))
    .filter((s) => s.player)
    .sort((a, b) => b.goals - a.goals || a.place - b.place);
}

/** Public wrapper around the standings feed (met=Standings). */
export async function fetchLeagueStandings(
  sport: Sport,
  leagueKey: number,
): Promise<StandingRow[]> {
  return fetchStandings(sport, leagueKey);
}

/* ---------------- on-demand odds + provider-wide search ---------------- */

/** Week-long chunks covering an inclusive day-offset range (provider caps at 7 days). */
function dayChunks(fromDay: number, toDay: number): Array<{ from: string; to: string }> {
  const out: Array<{ from: string; to: string }> = [];
  for (let start = fromDay; start <= toDay; start += 7) {
    out.push({ from: ymd(start), to: ymd(Math.min(start + 6, toDay)) });
  }
  return out;
}

/**
 * Per-match odds lookup for fixtures the bulk feed skipped. Falls back to the
 * FullOdds endpoint so a fixture priced only there still shows prices.
 */
export async function fetchOddsForIds(
  sport: Sport,
  ids: string[],
): Promise<Map<string, Market[]>> {
  const out = new Map<string, Market[]>();
  await pool([...new Set(ids)].slice(0, 250), 12, async (id) => {
    try {
      // Basic Odds and FullOdds are complementary: the basic feed can contain
      // one minor market while FullOdds holds the result and totals prices.
      // Always request and merge both instead of treating FullOdds as a fallback.
      const [res, full] = await Promise.all([
        call<Record<string, unknown>>(sport, { met: "Odds", matchId: id }, 60_000),
        call<Record<string, unknown>>(
          sport,
          { met: "FullOdds", matchId: id },
          60_000,
        ),
      ]);
      const fullNode = full?.[id];
      const markets = mergeMarkets(
        parseOddsNode(sport, res?.[id] ?? null),
        fullNode && typeof fullNode === "object" ? parseNestedOdds(fullNode as Json) : [],
      );
      if (markets.length > 0) out.set(id, markets);
    } catch {
      /* odds are optional */
    }
  });
  return out;
}

export type MatchOddsPatch = { id: string; marketCount: number; odds: MainOdds };

/**
 * Main-market odds for a list of match ids, used to hydrate rows lazily.
 * Only genuinely priced fixtures are returned — an unpriced result would
 * otherwise overwrite the derived prices the row already shows.
 */
export async function fetchMatchOdds(sport: Sport, ids: string[]): Promise<MatchOddsPatch[]> {
  const found = await fetchOddsForIds(sport, ids);
  const patches: MatchOddsPatch[] = [];
  for (const [id, markets] of found) {
    const odds = mainOdds(sport, markets);
    if (isUnpriced(odds)) continue;
    patches.push({ id, marketCount: markets.length, odds });
  }
  return patches;
}

/**
 * Search the provider itself, not just the loaded page: team / player names are
 * resolved through met=Teams and their fixtures fetched directly, and league or
 * country names pull that competition's fixtures.
 */
export async function searchMatchesEverywhere(sport: Sport, term: string): Promise<Match[]> {
  const q = term.trim();
  if (q.length < 2) return [];
  const needle = q.toLowerCase();

  const rows: Json[] = [];
  const endOfYear = Math.max(
    60,
    Math.ceil((Date.UTC(ugNow().getUTCFullYear(), 11, 31) - ugNow().getTime()) / 86_400_000),
  );
  const ranges = dayChunks(-2, endOfYear);

  // 1) Teams / players matching the term -> their own fixture list.
  const teams = await fetchTeams(sport, { search: q }).catch(() => []);
  const teamKeys = teams
    .filter((t) => t.key > 0)
    .sort((a, b) => {
      const an = a.name.toLowerCase();
      const bn = b.name.toLowerCase();
      return (an.startsWith(needle) ? 0 : 1) - (bn.startsWith(needle) ? 0 : 1);
    })
    .slice(0, 5)
    .map((t) => t.key);

  // 2) Competitions / countries matching the term -> their fixture list.
  const leagues = await fetchLeagues(sport).catch(() => []);
  const leagueKeys = leagues
    .filter(
      (l) =>
        l.name.toLowerCase().includes(needle) || l.country.toLowerCase().includes(needle),
    )
    .slice(0, 4)
    .map((l) => l.key);

  const combos = [
    ...teamKeys.flatMap((id) => ranges.map((r) => ({ teamId: String(id), ...r }))),
    ...leagueKeys.flatMap((id) => ranges.map((r) => ({ leagueId: String(id), ...r }))),
  ];

  await pool(combos, 8, async (c) => {
    const res = await call<unknown>(sport, { met: "Fixtures", ...c }, 3 * 60_000);
    rows.push(...rowsOf(res));
  });

  const nowMs = ugNow().getTime();
  const list = [
    ...new Map(
      rows.filter((f) => f && f["event_key"] != null).map((f) => [String(f["event_key"]), f]),
    ).values(),
  ]
    .filter((f) => {
      const status = String(f["event_status"] ?? "");
      if (FINISHED_RE.test(status) || VOID_RE.test(status)) return false;
      const start = Date.parse(
        `${dateKey(f)}T${f["event_time"] ?? "00:00"}:00Z`,
      );
      return !Number.isFinite(start) || start >= nowMs - 3 * 60 * 60_000;
    })
    .filter((f) => {
      const hay = [
        f["event_home_team"],
        f["event_away_team"],
        f["event_first_player"],
        f["event_second_player"],
        f["league_name"],
        f["country_name"],
      ]
        .map((v) => String(v ?? ""))
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    })
    .sort((a, b) =>
      `${dateKey(a)}${a["event_time"]}`.localeCompare(`${dateKey(b)}${b["event_time"]}`),
    )
    .slice(0, 300);

  const odds = await fetchOddsForIds(
    sport,
    list.map((f) => String(f["event_key"])),
  );
  return list.map((f) => normalise(sport, f, odds.get(String(f["event_key"])) ?? []));
}

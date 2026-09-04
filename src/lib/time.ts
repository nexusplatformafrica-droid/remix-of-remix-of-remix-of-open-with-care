// The provider is queried with timezone=Africa/Kampala, so every date/time
// string we receive is already Uganda local time — never shift it again.
export const UGANDA_TZ = "Africa/Kampala";

function parts(time?: string) {
  const m = /^(\d{1,2}):(\d{2})/.exec(time ?? "");
  if (!m) return null;
  return { h: Number(m[1]), min: m[2]! };
}

/** "7:45pm" from a Kampala-local "19:45". */
export function ugTime(_date: string, time?: string) {
  const p = parts(time);
  if (!p) return time ?? "";
  const suffix = p.h >= 12 ? "pm" : "am";
  const hour = p.h % 12 === 0 ? 12 : p.h % 12;
  return `${hour}:${p.min}${suffix}`;
}

/** Kampala calendar day key — the provider already returns it. */
export function ugDateKey(date: string, _time?: string) {
  return date;
}

/** "Sun, 2 Aug" for a Kampala date key. */
export function ugDateLabel(dateKey: string) {
  const d = new Date(`${dateKey}T12:00:00Z`);
  if (isNaN(d.getTime())) return dateKey;
  return d.toLocaleDateString("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** "Sun, 2 Aug 7:45pm" in Kampala time. */
export function ugDateTime(date: string, time?: string) {
  const t = ugTime(date, time);
  return `${ugDateLabel(date)}${t ? ` ${t}` : ""}`;
}

/** Current wall-clock time in Kampala, "7:45pm". */
export function ugClock(now: Date = new Date()) {
  return now
    .toLocaleTimeString("en-US", {
      timeZone: UGANDA_TZ,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .replace(/\s?([AP])M$/i, (_m, p1: string) => `${p1.toLowerCase()}m`);
}

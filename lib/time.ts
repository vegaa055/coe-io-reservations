/**
 * Everything the user sees is wall-clock time in one campus timezone; everything
 * stored is a UTC instant (timestamptz). This module is the only place that
 * converts between the two.
 *
 * Arizona does not observe DST, so America/Phoenix is a fixed UTC-7 — but the
 * conversions below are DST-correct anyway, so a second campus in a DST zone
 * would not need new code.
 */

export const TZ = process.env.NEXT_PUBLIC_TZ || "America/Phoenix";

export const SLOT_MINUTES = 30;

type Parts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  weekday: "short",
});

/** Wall-clock fields of `date` as seen in TZ. */
export function zonedParts(date: Date): Parts {
  const out: Record<string, string> = {};
  for (const p of partsFormatter.formatToParts(date)) {
    if (p.type !== "literal") out[p.type] = p.value;
  }
  return {
    year: Number(out.year),
    month: Number(out.month),
    day: Number(out.day),
    // Some engines emit hour "24" for midnight under hour12:false.
    hour: Number(out.hour) % 24,
    minute: Number(out.minute),
    second: Number(out.second),
    weekday: WEEKDAYS.indexOf(out.weekday),
  };
}

function offsetMs(date: Date): number {
  const p = zonedParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * Turn a local wall time into the UTC instant it refers to.
 * Two passes so the offset is sampled at (approximately) the right instant,
 * which is what makes it correct across a DST boundary.
 */
export function zonedToUtc(
  year: number,
  month: number,
  day: number,
  minutesFromMidnight: number,
): Date {
  const naive = Date.UTC(year, month - 1, day, 0, minutesFromMidnight, 0, 0);
  let ts = naive - offsetMs(new Date(naive));
  ts = naive - offsetMs(new Date(ts));
  return new Date(ts);
}

/** "2026-09-03" + minutes-from-midnight -> UTC instant. */
export function dateKeyToUtc(dateKey: string, minutesFromMidnight = 0): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  return zonedToUtc(y, m, d, minutesFromMidnight);
}

/** UTC instant -> "2026-09-03" as seen in TZ. */
export function toDateKey(date: Date): string {
  const p = zonedParts(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

/** Minutes from local midnight, in TZ. */
export function minutesOfDay(date: Date): number {
  const p = zonedParts(date);
  return p.hour * 60 + p.minute;
}

export function weekdayOf(dateKey: string): number {
  return zonedParts(dateKeyToUtc(dateKey, 12 * 60)).weekday;
}

export function addDaysToKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(
    shifted.getUTCDate(),
  ).padStart(2, "0")}`;
}

export function daysBetweenKeys(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/** 570 -> "9:30 AM" */
export function formatMinutes(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const suffix = h24 < 12 ? "AM" : "PM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return m === 0 ? `${h12} ${suffix}` : `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

const timeFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hour: "numeric",
  minute: "2-digit",
});

const dateFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

const longDateFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  weekday: "long",
  month: "long",
  day: "numeric",
});

export function formatTime(date: Date): string {
  return timeFmt.format(date);
}

export function formatDate(date: Date): string {
  return dateFmt.format(date);
}

export function formatDateKeyLong(dateKey: string): string {
  return longDateFmt.format(dateKeyToUtc(dateKey, 12 * 60));
}

export function formatRange(start: Date, end: Date): string {
  return `${formatDate(start)} · ${formatTime(start)} – ${formatTime(end)}`;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h} hr ${m} min`;
  if (h) return `${h} hr`;
  return `${m} min`;
}

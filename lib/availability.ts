import {
  SLOT_MINUTES,
  dateKeyToUtc,
  daysBetweenKeys,
  toDateKey,
  weekdayOf,
} from "./time";

export type Interval = { start: Date; end: Date };

export type SlotStatus = "free" | "booked" | "closed" | "past";

export type Slot = {
  /** Minutes from local midnight. */
  start: number;
  end: number;
  status: SlotStatus;
  /** Set when status is "booked" — the reservation title, if it may be shown. */
  label?: string;
};

export type RoomPolicy = {
  openMinute: number;
  closeMinute: number;
  openDays: number[];
  minMinutes: number;
  maxMinutes: number;
  advanceDays: number;
  isBookable: boolean;
};

export type DaySchedule = {
  dateKey: string;
  /** False when the room is closed all day (weekend, blackout, outside window). */
  isOpen: boolean;
  closedReason: string | null;
  slots: Slot[];
};

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  // Half-open [start, end): touching intervals do not overlap.
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Why a whole day is unavailable, or null when at least part of it is bookable.
 */
export function dayClosedReason(
  room: RoomPolicy,
  dateKey: string,
  now = new Date(),
): string | null {
  if (!room.isBookable) return "This space is not open for online reservations yet.";

  // Derived from `now` rather than the wall clock so callers (and tests) can
  // pin the current time.
  const today = toDateKey(now);
  const offset = daysBetweenKeys(today, dateKey);
  if (offset < 0) return "That date has already passed.";
  if (offset > room.advanceDays) {
    return `Reservations open ${room.advanceDays} days ahead.`;
  }
  if (!room.openDays.includes(weekdayOf(dateKey))) {
    return "The building is closed on this day.";
  }
  return null;
}

export function buildDaySchedule(
  room: RoomPolicy,
  dateKey: string,
  busy: Interval[],
  closures: Interval[],
  now = new Date(),
): DaySchedule {
  const closedReason = dayClosedReason(room, dateKey, now);
  if (closedReason) {
    return { dateKey, isOpen: false, closedReason, slots: [] };
  }

  const slots: Slot[] = [];
  for (let m = room.openMinute; m + SLOT_MINUTES <= room.closeMinute; m += SLOT_MINUTES) {
    const start = dateKeyToUtc(dateKey, m);
    const end = dateKeyToUtc(dateKey, m + SLOT_MINUTES);

    let status: SlotStatus = "free";
    if (end <= now) status = "past";
    else if (closures.some((c) => overlaps(start, end, c.start, c.end))) status = "closed";
    else if (busy.some((b) => overlaps(start, end, b.start, b.end))) status = "booked";

    slots.push({ start: m, end: m + SLOT_MINUTES, status });
  }

  return {
    dateKey,
    isOpen: slots.some((s) => s.status === "free"),
    closedReason: null,
    slots,
  };
}

/**
 * Longest reservation (in minutes) that can start at `startMinute` — stops at
 * the first taken slot, at closing time, and at the room's own maximum.
 */
export function maxDurationFrom(
  schedule: DaySchedule,
  room: RoomPolicy,
  startMinute: number,
): number {
  const index = schedule.slots.findIndex((s) => s.start === startMinute);
  if (index === -1 || schedule.slots[index].status !== "free") return 0;

  let minutes = 0;
  for (let i = index; i < schedule.slots.length; i++) {
    if (schedule.slots[i].status !== "free") break;
    if (schedule.slots[i].start !== startMinute + minutes) break;
    minutes += SLOT_MINUTES;
    if (minutes >= room.maxMinutes) break;
  }
  return minutes;
}

/** Selectable durations for a start time, respecting the room's min/max. */
export function durationOptions(
  schedule: DaySchedule,
  room: RoomPolicy,
  startMinute: number,
): number[] {
  const max = maxDurationFrom(schedule, room, startMinute);
  const options: number[] = [];
  for (let d = room.minMinutes; d <= max; d += SLOT_MINUTES) options.push(d);
  return options;
}

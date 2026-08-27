import { NextResponse } from "next/server";

import { buildDaySchedule } from "@/lib/availability";
import { getDayIntervals, getRoom } from "@/lib/rooms";
import { addDaysToKey, dateKeyToUtc, todayKey } from "@/lib/time";

export const dynamic = "force-dynamic";

/**
 * GET /api/rooms/b139/availability?date=2026-09-03
 *
 * Slot statuses only — no requester details, so this stays safe to expose.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const room = await getRoom(slug);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const requested = new URL(request.url).searchParams.get("date");
  const dateKey = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : todayKey();

  const { bookings, closures } = await getDayIntervals(
    room.id,
    dateKeyToUtc(dateKey, 0),
    dateKeyToUtc(addDaysToKey(dateKey, 1), 0),
  );

  const schedule = buildDaySchedule(
    room,
    dateKey,
    bookings.map((b) => ({ start: b.startsAt, end: b.endsAt })),
    closures.map((c) => ({ start: c.startsAt, end: c.endsAt })),
  );

  return NextResponse.json({
    room: { slug: room.slug, name: room.name, capacity: room.capacity },
    date: dateKey,
    isOpen: schedule.isOpen,
    closedReason: schedule.closedReason,
    slots: schedule.slots,
  });
}

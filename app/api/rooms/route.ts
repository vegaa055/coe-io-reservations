import { NextResponse } from "next/server";

import { getRoomsWithStatus } from "@/lib/rooms";

export const dynamic = "force-dynamic";

/**
 * Read-only room list. Kept deliberately public and simple so a kiosk display,
 * a digital-signage board or a future Outlook sync can consume it without
 * touching the database.
 */
export async function GET() {
  const rooms = await getRoomsWithStatus();

  return NextResponse.json({
    rooms: rooms.map((room) => ({
      slug: room.slug,
      number: room.number,
      name: room.name,
      type: room.type,
      capacity: room.capacity,
      dimensionsFt:
        room.widthFt && room.lengthFt ? { width: room.widthFt, length: room.lengthFt } : null,
      summary: room.summary,
      isBookable: room.isBookable,
      needsApproval: room.needsApproval,
      hours: { openMinute: room.openMinute, closeMinute: room.closeMinute, openDays: room.openDays },
      amenities: room.amenities.map((a) => ({ key: a.key, label: a.label, category: a.category })),
      images: room.images.map((i) => ({ url: i.url, alt: i.alt, kind: i.kind })),
      status: room.status,
      busyUntil: room.busyUntil?.toISOString() ?? null,
    })),
  });
}

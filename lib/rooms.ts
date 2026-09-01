import type { Prisma, RoomType } from "@prisma/client";

import { prisma } from "./prisma";
import { minutesOfDay, todayKey, zonedParts } from "./time";

export const ROOM_TYPE_LABEL: Record<RoomType, string> = {
  MEETING: "Meeting",
  CONFERENCE: "Conference",
  ADAPTABLE: "Adaptable",
};

export const ROOM_TYPE_BLURB: Record<RoomType, string> = {
  MEETING: "Small rooms around one table",
  CONFERENCE: "Larger rooms for presentations and hybrid sessions",
  ADAPTABLE: "Spaces that reconfigure for the session you are running",
};

export type RoomFilters = {
  type?: RoomType;
  minSeats?: number;
  amenity?: string;
  freeNow?: boolean;
};

export type RoomWithDetail = Prisma.RoomGetPayload<{
  include: { amenities: true; images: true };
}> & {
  /** Live status used by the floor plan and the card pills. */
  status: "free" | "busy" | "closed";
  /** When status is "busy", the reservation currently in the room. */
  busyUntil: Date | null;
};

/** Rooms plus what is happening in them right now. */
export async function getRoomsWithStatus(filters: RoomFilters = {}): Promise<RoomWithDetail[]> {
  const now = new Date();

  const rooms = await prisma.room.findMany({
    where: {
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.minSeats ? { capacity: { gte: filters.minSeats } } : {}),
      ...(filters.amenity ? { amenities: { some: { key: filters.amenity } } } : {}),
    },
    include: { amenities: true, images: { orderBy: { sortOrder: "asc" } } },
    orderBy: { sortOrder: "asc" },
  });

  // "Busy" has to be judged per physical space, not per listing: a booking of
  // the combined C165 makes both halves busy even though their room ids differ.
  const [live, links] = await Promise.all([
    prisma.bookingSpace.findMany({
      where: { startsAt: { lte: now }, endsAt: { gt: now } },
      select: { spaceId: true, endsAt: true },
    }),
    prisma.roomSpace.findMany({ select: { roomId: true, spaceId: true } }),
  ]);
  const busyBySpace = new Map<string, Date>();
  for (const claim of live) {
    const seen = busyBySpace.get(claim.spaceId);
    if (!seen || claim.endsAt > seen) busyBySpace.set(claim.spaceId, claim.endsAt);
  }
  const busyByRoom = new Map<string, Date>();
  for (const link of links) {
    const until = busyBySpace.get(link.spaceId);
    if (!until) continue;
    const seen = busyByRoom.get(link.roomId);
    if (!seen || until > seen) busyByRoom.set(link.roomId, until);
  }

  const nowMinute = minutesOfDay(now);
  const weekday = zonedParts(now).weekday;

  const decorated = rooms.map((room) => {
    const busyUntil = busyByRoom.get(room.id) ?? null;
    const withinHours =
      room.isBookable &&
      room.openDays.includes(weekday) &&
      nowMinute >= room.openMinute &&
      nowMinute < room.closeMinute;

    const status: RoomWithDetail["status"] = busyUntil
      ? "busy"
      : withinHours
        ? "free"
        : "closed";

    return { ...room, status, busyUntil };
  });

  return filters.freeNow ? decorated.filter((room) => room.status === "free") : decorated;
}

export async function getRoom(slug: string) {
  return prisma.room.findUnique({
    where: { slug },
    include: {
      amenities: { orderBy: { label: "asc" } },
      images: { orderBy: { sortOrder: "asc" } },
    },
  });
}

export type DayBookingRow = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  title: string;
  requesterName: string;
  /** Null when the reservation is of this very room; otherwise the listing that
   *  holds the space — "Room C165 (both halves)" blocking C165a, for example. */
  viaRoomName: string | null;
};

/**
 * What blocks this room on one local day, read through the physical spaces it
 * occupies so that a reservation of an overlapping listing shows up too.
 */
export async function getDayIntervals(roomId: string, dayStart: Date, dayEnd: Date) {
  const links = await prisma.roomSpace.findMany({
    where: { roomId },
    select: { spaceId: true },
  });
  const spaceIds = links.map((l) => l.spaceId);

  const [claims, closures] = await Promise.all([
    prisma.bookingSpace.findMany({
      where: {
        spaceId: { in: spaceIds },
        startsAt: { lt: dayEnd },
        endsAt: { gt: dayStart },
      },
      include: {
        booking: {
          select: {
            id: true,
            title: true,
            requesterName: true,
            roomId: true,
            room: { select: { name: true } },
          },
        },
      },
      orderBy: { startsAt: "asc" },
    }),
    prisma.closure.findMany({
      where: {
        OR: [{ roomId }, { roomId: null }],
        startsAt: { lt: dayEnd },
        endsAt: { gt: dayStart },
      },
    }),
  ]);

  // A listing covering several spaces yields one claim per space; collapse them.
  const byBooking = new Map<string, DayBookingRow>();
  for (const claim of claims) {
    if (byBooking.has(claim.bookingId)) continue;
    byBooking.set(claim.bookingId, {
      id: claim.booking.id,
      startsAt: claim.startsAt,
      endsAt: claim.endsAt,
      title: claim.booking.title,
      requesterName: claim.booking.requesterName,
      viaRoomName: claim.booking.roomId === roomId ? null : claim.booking.room.name,
    });
  }

  return { bookings: [...byBooking.values()], closures };
}

/**
 * Other listings that share a physical space with this one — the two halves of
 * C165 and the combined listing. Used to explain on the room page why a slot is
 * taken by something with a different name.
 */
export async function getOverlappingRooms(roomId: string) {
  const links = await prisma.roomSpace.findMany({
    where: { roomId },
    select: { spaceId: true },
  });
  if (links.length === 0) return [];

  const siblings = await prisma.roomSpace.findMany({
    where: { spaceId: { in: links.map((l) => l.spaceId) }, roomId: { not: roomId } },
    select: { room: { select: { slug: true, name: true } } },
  });

  const seen = new Map<string, { slug: string; name: string }>();
  for (const s of siblings) seen.set(s.room.slug, s.room);
  return [...seen.values()];
}

/** All amenities that at least one room has, for the filter row. */
export async function getFilterableAmenities() {
  return prisma.amenity.findMany({
    where: { rooms: { some: {} } },
    orderBy: [{ category: "asc" }, { label: "asc" }],
  });
}

export function todayDateKey(): string {
  return todayKey();
}

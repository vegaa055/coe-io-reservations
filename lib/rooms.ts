import type { Prisma, RoomType } from "@prisma/client";

import { BLOCKING_STATUSES } from "./bookings";
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

  const live = await prisma.booking.findMany({
    where: {
      status: { in: [...BLOCKING_STATUSES] },
      startsAt: { lte: now },
      endsAt: { gt: now },
    },
    select: { roomId: true, endsAt: true },
  });
  const busyByRoom = new Map(live.map((b) => [b.roomId, b.endsAt]));

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

/** Bookings and closures that overlap one local day, for the availability grid. */
export async function getDayIntervals(roomId: string, dayStart: Date, dayEnd: Date) {
  const [bookings, closures] = await Promise.all([
    prisma.booking.findMany({
      where: {
        roomId,
        status: { in: [...BLOCKING_STATUSES] },
        startsAt: { lt: dayEnd },
        endsAt: { gt: dayStart },
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
  return { bookings, closures };
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

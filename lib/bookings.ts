import { Prisma, type Booking, type Room } from "@prisma/client";

import { dayClosedReason } from "./availability";
import { prisma } from "./prisma";
import { SLOT_MINUTES, dateKeyToUtc, formatMinutes } from "./time";
import type { BookingInput } from "./validation";

/** Statuses that hold a slot. A pending request blocks the room while staff review it. */
export const BLOCKING_STATUSES = ["PENDING", "CONFIRMED"] as const;

export type BookingResult =
  | { ok: true; booking: Booking }
  | { ok: false; code: "NOT_FOUND" | "INVALID" | "CONFLICT"; message: string };

/**
 * PostgreSQL raises 23P01 (exclusion_violation) when the `bookings_no_overlap`
 * constraint rejects an insert. Prisma has no typed error for it, so match on
 * the driver code and the constraint name.
 */
function isOverlapViolation(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const meta = error.meta as { code?: string; constraint?: string } | undefined;
    if (meta?.code === "23P01") return true;
    if (meta?.constraint === "bookings_no_overlap") return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("23P01") || message.includes("bookings_no_overlap");
}

function allowedDomains(): string[] {
  return (process.env.ALLOWED_EMAIL_DOMAINS || "")
    .split(",")
    .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
}

/**
 * Every rule that is not the overlap check. Returns a human-readable reason, or
 * null when the request is acceptable. Called on the server for real; the client
 * only ever pre-filters the UI.
 */
export function checkBookingRules(
  room: Room,
  input: BookingInput,
  now = new Date(),
): string | null {
  if (!room.isBookable) {
    return `${room.name} is not open for online reservations yet.`;
  }

  const closed = dayClosedReason(room, input.dateKey, now);
  if (closed) return closed;

  if (input.startMinute % SLOT_MINUTES !== 0) {
    return `Start times are on ${SLOT_MINUTES}-minute boundaries.`;
  }
  if (input.durationMinutes % SLOT_MINUTES !== 0) {
    return `Length must be a multiple of ${SLOT_MINUTES} minutes.`;
  }
  if (input.durationMinutes < room.minMinutes) {
    return `Reservations are at least ${room.minMinutes} minutes.`;
  }
  if (input.durationMinutes > room.maxMinutes) {
    return `Reservations in this room are at most ${room.maxMinutes / 60} hours. Contact the JAG-Ed Center for a longer booking.`;
  }
  if (input.startMinute < room.openMinute) {
    return `${room.name} opens at ${formatMinutes(room.openMinute)}.`;
  }
  if (input.startMinute + input.durationMinutes > room.closeMinute) {
    return `${room.name} closes at ${formatMinutes(room.closeMinute)}.`;
  }
  if (input.attendees > room.capacity) {
    return `${room.name} seats ${room.capacity}. Choose a larger space for ${input.attendees} people.`;
  }

  const domains = allowedDomains();
  if (domains.length) {
    const domain = input.requesterEmail.split("@")[1]?.toLowerCase() ?? "";
    if (!domains.some((d) => domain === d || domain.endsWith(`.${d}`))) {
      return `Reservations are limited to ${domains.map((d) => `@${d}`).join(", ")} addresses right now.`;
    }
  }

  const startsAt = dateKeyToUtc(input.dateKey, input.startMinute);
  if (startsAt.getTime() <= now.getTime()) {
    return "Pick a start time in the future.";
  }

  return null;
}

export async function createBooking(
  input: BookingInput,
  now = new Date(),
): Promise<BookingResult> {
  const room = await prisma.room.findUnique({ where: { slug: input.roomSlug } });
  if (!room) return { ok: false, code: "NOT_FOUND", message: "That room does not exist." };

  const ruleError = checkBookingRules(room, input, now);
  if (ruleError) return { ok: false, code: "INVALID", message: ruleError };

  const startsAt = dateKeyToUtc(input.dateKey, input.startMinute);
  const endsAt = dateKeyToUtc(input.dateKey, input.startMinute + input.durationMinutes);

  // Blackout windows are not covered by the exclusion constraint, so check them here.
  const closure = await prisma.closure.findFirst({
    where: {
      OR: [{ roomId: room.id }, { roomId: null }],
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
  });
  if (closure) {
    return { ok: false, code: "INVALID", message: `Unavailable: ${closure.reason}.` };
  }

  // Friendly pre-check. The database constraint below is what actually makes
  // this safe under concurrency — this only produces a better message.
  const clash = await prisma.booking.findFirst({
    where: {
      roomId: room.id,
      status: { in: [...BLOCKING_STATUSES] },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
  });
  if (clash) {
    return {
      ok: false,
      code: "CONFLICT",
      message: "That time was just taken. Pick another slot.",
    };
  }

  try {
    const booking = await prisma.booking.create({
      data: {
        roomId: room.id,
        startsAt,
        endsAt,
        status: room.needsApproval ? "PENDING" : "CONFIRMED",
        title: input.title,
        purpose: input.purpose || null,
        attendees: input.attendees,
        requesterName: input.requesterName,
        requesterEmail: input.requesterEmail.toLowerCase(),
        requesterPhone: input.requesterPhone || null,
        department: input.department || null,
      },
    });
    return { ok: true, booking };
  } catch (error) {
    if (isOverlapViolation(error)) {
      return {
        ok: false,
        code: "CONFLICT",
        message: "Someone booked that time a moment before you. Pick another slot.",
      };
    }
    throw error;
  }
}

export async function cancelBooking(
  manageToken: string,
  reason: string | null,
): Promise<BookingResult> {
  const booking = await prisma.booking.findUnique({ where: { manageToken } });
  if (!booking) {
    return { ok: false, code: "NOT_FOUND", message: "We could not find that reservation." };
  }
  if (booking.status === "CANCELLED" || booking.status === "DENIED") {
    return { ok: true, booking };
  }
  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason },
  });
  return { ok: true, booking: updated };
}

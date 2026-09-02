import { Prisma, type Booking, type Room } from "@prisma/client";

import { dayClosedReason } from "./availability";
import { prisma } from "./prisma";
import { SLOT_MINUTES, dateKeyToUtc, formatMinutes } from "./time";
import type { BookingInput } from "./validation";

// Whether a booking holds a slot is no longer a question of status: it holds
// exactly the spaces it has BookingSpace rows for. Pending requests keep their
// claims (so a request under review still blocks the room); cancelling or
// denying deletes them.

export type BookingResult =
  | { ok: true; booking: Booking }
  | { ok: false; code: "NOT_FOUND" | "INVALID" | "CONFLICT"; message: string };

/**
 * PostgreSQL raises 23P01 (exclusion_violation) when either no-overlap
 * constraint rejects an insert. Prisma has no typed error for it, so match on
 * the driver code and the constraint name.
 */
export function isOverlapViolation(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const meta = error.meta as { code?: string; constraint?: string } | undefined;
    if (meta?.code === "23P01") return true;
    if (meta?.constraint?.endsWith("_no_overlap")) return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("23P01") ||
    message.includes("bookings_no_overlap") ||
    message.includes("booking_spaces_no_overlap")
  );
}

/**
 * Failures that mean "try again", not "the slot is taken":
 *
 *   40P01  deadlock — PostgreSQL picked this transaction as the victim
 *   40001  serialization failure
 *   P2028  Prisma's interactive-transaction timeout
 *
 * All three come from contention. A booking waits on the exclusion index while
 * an overlapping request is in flight, and under a burst of simultaneous
 * requests for the same slot those waits stack up. The caller retries with
 * backoff rather than reporting a conflict that may not exist.
 */
function isTransient(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2028") return true;
    const meta = error.meta as { code?: string } | undefined;
    if (meta?.code === "40P01" || meta?.code === "40001") return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("40P01") ||
    message.includes("40001") ||
    message.includes("P2028") ||
    message.includes("Transaction already closed")
  );
}

/**
 * Whether a reservation requires a signed-in NetID.
 *
 * Defaults to *required*. An access control should fail closed: forgetting to
 * set this on a deployment leaves booking locked down, which is a support
 * question, rather than silently open to the internet. Set
 * REQUIRE_SIGN_IN_TO_BOOK=0 when the service opens to the public.
 *
 * Enforcement lives in createBookingAction, not here — that is the request
 * boundary, and it is the only place with access to the session.
 */
export function bookingRequiresSignIn(): boolean {
  return process.env.REQUIRE_SIGN_IN_TO_BOOK !== "0";
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
  // The hard limit is the posted occupancy where there is one; the seated count
  // is only a comfort figure. A 45-person classroom with 18 chairs can still
  // legitimately host a 30-person standing session.
  const headcountLimit = room.maxOccupancy ?? room.capacity;
  if (input.attendees > headcountLimit) {
    return `${room.name} holds ${headcountLimit}. Choose a larger space for ${input.attendees} people.`;
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

  // Which physical spaces this listing occupies. For C165 the combined listing
  // covers both halves, so booking it has to hold both.
  const roomSpaces = await prisma.roomSpace.findMany({
    where: { roomId: room.id },
    select: { spaceId: true },
  });
  if (roomSpaces.length === 0) {
    return {
      ok: false,
      code: "INVALID",
      message: `${room.name} is not mapped to a physical space yet. Contact the center.`,
    };
  }
  const spaceIds = roomSpaces.map((rs) => rs.spaceId);

  // Friendly pre-check. The exclusion constraint below is what actually makes
  // this safe under concurrency — this only produces a better message.
  const clash = await prisma.bookingSpace.findFirst({
    where: {
      spaceId: { in: spaceIds },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
    include: { booking: { select: { roomId: true, room: { select: { name: true } } } } },
  });
  if (clash) {
    const other = clash.booking.roomId === room.id ? null : clash.booking.room.name;
    return {
      ok: false,
      code: "CONFLICT",
      message: other
        ? `That time is taken by a reservation of ${other}, which shares this space.`
        : "That time was just taken. Pick another slot.",
    };
  }

  // Sorted, so every transaction takes the spaces in the same order.
  const ordered = [...spaceIds].sort();

  const attempt = () =>
    prisma.$transaction(async (tx) => {
      // Queue on the spaces before touching the exclusion index.
      //
      // Ordering the inserts alone is not enough. Inserting into a GiST
      // exclusion index makes a speculative entry and then waits on the
      // conflicting transaction, so a booking that claims two spaces can hold
      // one entry while waiting for the other, and two such transactions
      // deadlock (40P01). Under a burst of simultaneous requests that happened
      // often enough to exhaust the retries.
      //
      // Taking a transaction-scoped advisory lock per space, in the same sorted
      // order everywhere, makes that impossible: conflicting requests serialise
      // into a plain queue instead of racing inside the index. The exclusion
      // constraint is still what guarantees correctness — this only decides who
      // gets to try first. Locks are released when the transaction ends.
      for (const spaceId of ordered) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(4711, hashtext(${spaceId}))`;
      }

      const created = await tx.booking.create({
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
      for (const spaceId of ordered) {
        await tx.bookingSpace.create({
          data: { bookingId: created.id, spaceId, startsAt, endsAt },
        });
      }
      return created;
    },
    {
      // The default 5s is not enough: this transaction can legitimately sit
      // waiting on the exclusion index while an overlapping request commits,
      // and a burst of simultaneous requests queues those waits up. Timing out
      // here surfaces as an opaque P2028 rather than a clean conflict.
      timeout: 15_000,
      maxWait: 10_000,
    });

  const MAX_TRIES = 4;
  for (let tries = 0; tries < MAX_TRIES; tries++) {
    try {
      return { ok: true, booking: await attempt() };
    } catch (error) {
      if (isOverlapViolation(error)) {
        return {
          ok: false,
          code: "CONFLICT",
          message: "Someone booked that time a moment before you. Pick another slot.",
        };
      }
      // A deadlock means PostgreSQL picked this transaction as the victim, not
      // that the slot is taken — the right response is to try again. Back off a
      // little, with jitter, so retries do not collide with each other.
      if (isTransient(error) && tries < MAX_TRIES - 1) {
        await new Promise((r) => setTimeout(r, 20 * 2 ** tries + Math.random() * 25));
        continue;
      }
      throw error;
    }
  }

  return {
    ok: false,
    code: "CONFLICT",
    message: "That slot is busy right now. Try again in a moment.",
  };
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
  // Releasing the space claims is what frees the slot for everyone else.
  const [, updated] = await prisma.$transaction([
    prisma.bookingSpace.deleteMany({ where: { bookingId: booking.id } }),
    prisma.booking.update({
      where: { id: booking.id },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason },
    }),
  ]);
  return { ok: true, booking: updated };
}

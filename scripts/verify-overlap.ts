/**
 * Proves the no-double-booking guarantee end to end. Run against a scratch
 * database: `npm run verify:overlap`.
 *
 * It exercises the database constraint directly *and* the createBooking() path
 * under concurrency, because the application-level pre-check alone cannot stop
 * two simultaneous requests.
 */
import { PrismaClient } from "@prisma/client";

import { createBooking } from "../lib/bookings";
import { addDaysToKey, dateKeyToUtc, todayKey, weekdayOf } from "../lib/time";

const prisma = new PrismaClient();
const TEST_EMAIL_DOMAIN = "@overlap-test.invalid";

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

/** A weekday far enough out that the seeded demo bookings are not in the way. */
function testDateKey(): string {
  let key = addDaysToKey(todayKey(), 30);
  while (weekdayOf(key) === 0 || weekdayOf(key) === 6) key = addDaysToKey(key, 1);
  return key;
}

async function cleanup() {
  // BookingSpace rows cascade from the booking.
  await prisma.booking.deleteMany({
    where: { requesterEmail: { endsWith: TEST_EMAIL_DOMAIN } },
  });
}

async function rawInsert(roomId: string, startMinute: number, minutes: number, status = "CONFIRMED") {
  const dateKey = testDateKey();
  const startsAt = dateKeyToUtc(dateKey, startMinute);
  const endsAt = dateKeyToUtc(dateKey, startMinute + minutes);
  const spaces = await prisma.roomSpace.findMany({ where: { roomId }, select: { spaceId: true } });
  return prisma.booking.create({
    data: {
      roomId,
      startsAt,
      endsAt,
      status: status as "CONFIRMED" | "PENDING" | "CANCELLED" | "DENIED",
      title: "Overlap test",
      requesterName: "Test Runner",
      requesterEmail: `raw${TEST_EMAIL_DOMAIN}`,
      spaces: { create: spaces.map((s) => ({ spaceId: s.spaceId, startsAt, endsAt })) },
    },
  });
}

/**
 * `codes` are the PostgreSQL SQLSTATEs that count as the *right* rejection:
 * 23P01 exclusion_violation, 23514 check_violation.
 */
async function expectRejected(name: string, codes: string[], fn: () => Promise<unknown>) {
  try {
    await fn();
    check(name, false, "the insert was accepted but should have been rejected");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const matched = codes.some((code) => message.includes(code));
    check(name, matched, matched ? "" : `rejected for the wrong reason: ${message.slice(0, 160)}`);
  }
}

async function main() {
  const room = await prisma.room.findUniqueOrThrow({ where: { slug: "b139" } });
  const dateKey = testDateKey();
  console.log(`\nTesting against ${room.name} on ${dateKey}\n`);

  await cleanup();

  // Dropping the old per-room constraint is only safe while this holds: the
  // guarantee now lives entirely on space claims, so a room mapped to no space
  // could be booked without ever conflicting.
  console.log("Invariants");
  const roomsWithoutSpace = await prisma.room.findMany({
    where: { spaces: { none: {} } },
    select: { number: true },
  });
  check(
    "every room maps to at least one physical space",
    roomsWithoutSpace.length === 0,
    roomsWithoutSpace.map((r) => r.number).join(", "),
  );

  console.log("");
  console.log("Database constraint");
  const base = await rawInsert(room.id, 10 * 60, 60); // 10:00–11:00
  check("a first booking is accepted", Boolean(base.id));

  await expectRejected("an identical booking is rejected", ["23P01"], () =>
    rawInsert(room.id, 10 * 60, 60),
  );
  await expectRejected("a booking starting inside it is rejected", ["23P01"], () =>
    rawInsert(room.id, 10 * 60 + 30, 60),
  );
  await expectRejected("a booking ending inside it is rejected", ["23P01"], () =>
    rawInsert(room.id, 9 * 60 + 30, 60),
  );
  await expectRejected("a booking that swallows it is rejected", ["23P01"], () =>
    rawInsert(room.id, 9 * 60, 180),
  );
  await expectRejected("a PENDING request over a confirmed booking is rejected", ["23P01"], () =>
    rawInsert(room.id, 10 * 60, 60, "PENDING"),
  );

  const abutting = await rawInsert(room.id, 11 * 60, 60); // 11:00–12:00
  check("a booking starting exactly when it ends is accepted", Boolean(abutting.id));

  const otherRoom = await prisma.room.findUniqueOrThrow({ where: { slug: "b138" } });
  const elsewhere = await rawInsert(otherRoom.id, 10 * 60, 60);
  check("the same slot in a different room is accepted", Boolean(elsewhere.id));

  await prisma.bookingSpace.deleteMany({ where: { bookingId: base.id } });
  await prisma.booking.update({ where: { id: base.id }, data: { status: "CANCELLED" } });
  const rebooked = await rawInsert(room.id, 10 * 60, 60);
  check("the slot frees up after a cancellation", Boolean(rebooked.id));

  await expectRejected("ends_at before starts_at is rejected", ["23514"], () =>
    prisma.booking.create({
      data: {
        roomId: room.id,
        startsAt: dateKeyToUtc(dateKey, 14 * 60),
        endsAt: dateKeyToUtc(dateKey, 13 * 60),
        title: "Backwards",
        requesterName: "Test Runner",
        requesterEmail: `raw${TEST_EMAIL_DOMAIN}`,
      },
    }),
  );

  await cleanup();

  console.log("\nConcurrency through createBooking()");
  const racers = 12;
  const results = await Promise.all(
    Array.from({ length: racers }, (_, i) =>
      createBooking({
        roomSlug: "b139",
        dateKey,
        startMinute: 13 * 60,
        durationMinutes: 60,
        title: `Race entrant ${i + 1}`,
        attendees: 2,
        requesterName: `Racer ${i + 1}`,
        requesterEmail: `racer${i + 1}${TEST_EMAIL_DOMAIN}`,
      }),
    ),
  );

  const wins = results.filter((r) => r.ok).length;
  const conflicts = results.filter((r) => !r.ok && r.code === "CONFLICT").length;
  check(
    `exactly one of ${racers} simultaneous requests wins the slot`,
    wins === 1,
    `${wins} succeeded`,
  );
  check(
    "every loser gets a CONFLICT, not a crash",
    conflicts === racers - 1,
    `${conflicts} of ${racers - 1} reported CONFLICT`,
  );

  const stored = await prisma.booking.count({
    where: {
      roomId: room.id,
      status: { in: ["PENDING", "CONFIRMED"] },
      startsAt: dateKeyToUtc(dateKey, 13 * 60),
    },
  });
  check("only one row is actually stored", stored === 1, `${stored} rows`);

  await cleanup();

  // ---------------------------------------------------------------------
  // Divisible rooms. C165a and C165b are two halves of one room with a movable
  // partition; "C165a+b" lists the same floor as a single space. That is three
  // room ids over two physical spaces, so the per-room constraint cannot see
  // the conflict — only the space claims can.
  // ---------------------------------------------------------------------
  console.log("");
  console.log("Divisible room (C165)");

  async function book(slug: string, startMinute: number, minutes = 60, attendees = 4) {
    return createBooking({
      roomSlug: slug,
      dateKey,
      startMinute,
      durationMinutes: minutes,
      title: `Divisible test ${slug}`,
      attendees,
      requesterName: "Test Runner",
      requesterEmail: `split${TEST_EMAIL_DOMAIN}`,
    });
  }

  const whole = await book("c165a-b", 9 * 60);
  check("the combined room can be booked", whole.ok, whole.ok ? "" : whole.message);

  const halfA = await book("c165a", 9 * 60);
  check(
    "a half is blocked while the combined room is booked",
    !halfA.ok && halfA.code === "CONFLICT",
    halfA.ok ? "it was accepted" : halfA.message,
  );

  const halfB = await book("c165b", 9 * 60);
  check(
    "the other half is blocked too",
    !halfB.ok && halfB.code === "CONFLICT",
    halfB.ok ? "it was accepted" : halfB.message,
  );

  if (whole.ok) {
    await prisma.bookingSpace.deleteMany({ where: { bookingId: whole.booking.id } });
    await prisma.booking.update({
      where: { id: whole.booking.id },
      data: { status: "CANCELLED" },
    });
  }

  const freedA = await book("c165a", 9 * 60);
  check("cancelling the combined booking frees the halves", freedA.ok, freedA.ok ? "" : freedA.message);

  const independentB = await book("c165b", 9 * 60);
  check(
    "the two halves stay independent of each other",
    independentB.ok,
    independentB.ok ? "" : independentB.message,
  );

  const wholeBlocked = await book("c165a-b", 9 * 60);
  check(
    "the combined room is blocked while a half is booked",
    !wholeBlocked.ok && wholeBlocked.code === "CONFLICT",
    wholeBlocked.ok ? "it was accepted" : wholeBlocked.message,
  );

  await cleanup();

  console.log("");
  console.log("Concurrency across listings of the same floor");
  const mixed = await Promise.all([
    ...Array.from({ length: 4 }, (_, i) =>
      createBooking({
        roomSlug: "c165a-b",
        dateKey,
        startMinute: 15 * 60,
        durationMinutes: 60,
        title: `whole ${i}`,
        attendees: 4,
        requesterName: "Racer",
        requesterEmail: `whole${i}${TEST_EMAIL_DOMAIN}`,
      }),
    ),
    ...Array.from({ length: 4 }, (_, i) =>
      createBooking({
        roomSlug: "c165a",
        dateKey,
        startMinute: 15 * 60,
        durationMinutes: 60,
        title: `half ${i}`,
        attendees: 4,
        requesterName: "Racer",
        requesterEmail: `half${i}${TEST_EMAIL_DOMAIN}`,
      }),
    ),
  ]);
  const mixedWins = mixed.filter((r) => r.ok).length;
  check(
    "8 simultaneous requests for the whole room and one half yield exactly one winner",
    mixedWins === 1,
    `${mixedWins} succeeded`,
  );

  const claimRows = await prisma.bookingSpace.count({
    where: { startsAt: dateKeyToUtc(dateKey, 15 * 60) },
  });
  check(
    "the winner holds its own spaces only, never a mix from two bookings",
    claimRows === 1 || claimRows === 2,
    `${claimRows} claim rows`,
  );

  await cleanup();

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch(async (error) => {
    console.error(error);
    await cleanup().catch(() => undefined);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

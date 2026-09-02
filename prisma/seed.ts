/**
 * Seed data transcribed from "Room Reservation Presentation (1).pdf"
 * (College of Engineering Reservable Rooms) plus the photos in /img.
 *
 * Two things to confirm with the space owners — see README "Data questions":
 *   1. The handout's summary slide lists B138, B139, B153, B154, B155 as
 *      available, but detail slides also exist for B142 and B143. Both are
 *      seeded as bookable here.
 *   2. The JAG-Ed Center commons slide lists its amenities as "xxxxxxx", so no
 *      amenities are seeded for it.
 */
import { PrismaClient, type ImageKind, type RoomType } from "@prisma/client";

import { dateKeyToUtc, todayKey, addDaysToKey, weekdayOf } from "../lib/time";

const prisma = new PrismaClient();

const AMENITIES = [
  { key: "projector", label: "Ceiling projector and screen", category: "av" },
  { key: "tv", label: "Wall-mounted TV", category: "av" },
  { key: "dual-tv", label: "Two TVs", category: "av" },
  { key: "mobile-tv", label: "Two TVs on wheels", category: "av" },
  { key: "camera", label: "Room camera", category: "av" },
  { key: "aver-camera", label: "AVer PTZ camera", category: "av" },
  { key: "dual-aver-camera", label: "Two AVer PTZ cameras", category: "av" },
  { key: "camera-remote", label: "Camera remote", category: "av" },
  { key: "camera-controller", label: "Camera controller", category: "av" },
  { key: "speaker", label: "Conference speaker", category: "av" },
  { key: "zoom", label: "Zoom capable", category: "av" },
  { key: "whiteboard", label: "Whiteboard and markers", category: "features" },
  { key: "classroom", label: "Classroom setup", category: "features" },
  { key: "wheeled-tables", label: "Wheeled tables", category: "furniture" },
  { key: "tables", label: "Tables", category: "furniture" },
  { key: "pc", label: "Windows PC", category: "computing" },
  { key: "mac", label: "Macintosh", category: "computing" },
  { key: "keyboard-mouse", label: "Keyboard and mouse", category: "computing" },
];

type SeedRoom = {
  slug: string;
  number: string;
  name: string;
  type: RoomType;
  capacity: number;
  maxOccupancy?: number;
  building?: string;
  /// Physical spaces this listing occupies. Defaults to [slug] — only the
  /// divisible C165 listings need more than one.
  spaces?: string[];
  widthFt: number;
  lengthFt: number;
  summary: string;
  description: string;
  amenities: string[];
  images: { url: string; alt: string; kind: ImageKind }[];
  planKey: string;
  sortOrder: number;
  needsApproval?: boolean;
  maxMinutes?: number;
};

const ROOMS: SeedRoom[] = [
  {
    slug: "jag-ed-center",
    number: "JAG-Ed Center",
    name: "JAG-Ed Center Commons",
    type: "ADAPTABLE",
    capacity: 120,
    widthFt: 69,
    lengthFt: 61,
    summary: "The full open commons at the heart of the center, for events and receptions.",
    description:
      "Reserving the commons takes the whole central floor of the JAG-Ed Center, including the circulation space around the meeting pods. It suits poster sessions, receptions, orientations and design reviews. Because a commons booking affects access to the surrounding rooms, requests are reviewed by center staff before they are confirmed.",
    amenities: [],
    images: [
      {
        url: "/rooms/jag-ed-center-1.jpg",
        alt: "The open commons floor, with study seating in the foreground and the meeting room doors along the far wall",
        kind: "PHOTO",
      },
      {
        url: "/rooms/jag-ed-center-3.jpg",
        alt: "A wide view down the length of the commons, past the flags toward the glass-walled rooms at the far end",
        kind: "PHOTO",
      },
      {
        url: "/rooms/jag-ed-center-2.jpg",
        alt: "Computer workstations along the commons, looking out through the glass wall to the courtyard",
        kind: "PHOTO",
      },
      { url: "/plans/jag-ed-center.png", alt: "Floor plan with the commons highlighted", kind: "PLAN" },
    ],
    planKey: "commons",
    sortOrder: 0,
    needsApproval: true,
    maxMinutes: 480,
  },
  {
    slug: "b138",
    number: "B138",
    name: "Room B138",
    type: "MEETING",
    capacity: 8,
    widthFt: 19,
    lengthFt: 12,
    summary: "Eight-seat meeting room with a display, camera and whiteboard.",
    description:
      "One of three meeting rooms along the west wall of the JAG-Ed Center. A single table seats eight, with a wall display, camera and speaker for hybrid calls, plus a whiteboard for working sessions.",
    amenities: [
      "tables",
      "tv",
      "camera",
      "camera-remote",
      "speaker",
      "keyboard-mouse",
      "whiteboard",
      "pc",
    ],
    images: [
      { url: "/rooms/b138.jpg", alt: "Room B138 seen from the doorway", kind: "PHOTO" },
      { url: "/plans/b138.png", alt: "Floor plan with B138 highlighted", kind: "PLAN" },
    ],
    planKey: "b138",
    sortOrder: 10,
  },
  {
    slug: "b139",
    number: "B139",
    name: "Room B139",
    type: "MEETING",
    capacity: 9,
    widthFt: 19,
    lengthFt: 12,
    summary: "Nine-seat meeting room with dual displays and an AVer camera.",
    description:
      "The best-equipped of the small rooms: two displays, an AVer camera with its own controller, and a speaker, which makes it the easier pick when several people are joining remotely. A whiteboard covers one wall.",
    amenities: [
      "tables",
      "dual-tv",
      "speaker",
      "keyboard-mouse",
      "aver-camera",
      "camera-controller",
      "whiteboard",
      "pc",
    ],
    images: [
      { url: "/rooms/b139.jpg", alt: "Room B139 seen from the doorway", kind: "PHOTO" },
      { url: "/plans/b139.png", alt: "Floor plan with B139 highlighted", kind: "PLAN" },
    ],
    planKey: "b139",
    sortOrder: 20,
  },
  {
    slug: "b142",
    number: "B142",
    name: "Room B142",
    type: "MEETING",
    capacity: 5,
    widthFt: 11,
    lengthFt: 12,
    summary: "Five-seat huddle pod in the middle of the commons.",
    description:
      "A compact pod off the commons floor with one table, five chairs and a display with a camera. Sized for a quick sync, a one-on-one or a small hybrid call.",
    amenities: ["tables", "tv", "camera", "camera-remote", "keyboard-mouse", "pc"],
    images: [
      { url: "/rooms/b142.jpg", alt: "Room B142 seen from the doorway", kind: "PHOTO" },
      { url: "/plans/b142.png", alt: "Floor plan with B142 highlighted", kind: "PLAN" },
    ],
    planKey: "b142",
    sortOrder: 30,
    maxMinutes: 120,
  },
  {
    slug: "b143",
    number: "B143",
    name: "Room B143",
    type: "MEETING",
    capacity: 5,
    widthFt: 11,
    lengthFt: 12,
    summary: "Five-seat huddle pod in the middle of the commons.",
    description:
      "The twin of B142, on the far side of the security kiosk. One table, five chairs, a display with a camera and a PC.",
    amenities: ["tables", "tv", "camera", "camera-remote", "keyboard-mouse", "pc"],
    images: [
      { url: "/rooms/b143.jpg", alt: "Room B143 seen from the doorway", kind: "PHOTO" },
      { url: "/plans/b143.png", alt: "Floor plan with B143 highlighted", kind: "PLAN" },
    ],
    planKey: "b143",
    sortOrder: 40,
    maxMinutes: 120,
  },
  {
    slug: "b153",
    number: "B153",
    name: "Room B153",
    type: "ADAPTABLE",
    capacity: 16,
    widthFt: 30,
    lengthFt: 20,
    summary: "Zoom-capable classroom on wheeled tables — reconfigures in minutes.",
    description:
      "A 30-by-20 classroom whose ten tables are on wheels, so the room can be set as rows, pods or an open U depending on the session. Two displays and two AVer cameras cover the room for Zoom, and a Macintosh drives the front-of-room display.",
    amenities: [
      "classroom",
      "zoom",
      "wheeled-tables",
      "dual-tv",
      "dual-aver-camera",
      "camera-remote",
      "keyboard-mouse",
      "whiteboard",
      "mac",
    ],
    images: [
      {
        url: "/rooms/b153.jpg",
        alt: "Room B153 with its wheeled tables set in a U-shape, whiteboard on the right",
        kind: "PHOTO",
      },
      { url: "/plans/b153.png", alt: "Floor plan with B153 highlighted", kind: "PLAN" },
    ],
    planKey: "b153",
    sortOrder: 50,
  },
  {
    slug: "b154",
    number: "B154",
    name: "Room B154",
    type: "CONFERENCE",
    capacity: 16,
    widthFt: 30,
    lengthFt: 20,
    summary: "Zoom-capable classroom seating 16 at nine tables.",
    description:
      "A 30-by-20 classroom with nine tables and 16 chairs, two displays and a camera for Zoom sessions, driven by a Macintosh. The middle of the three large rooms along the south wall.",
    amenities: [
      "classroom",
      "zoom",
      "tables",
      "dual-tv",
      "camera",
      "camera-remote",
      "keyboard-mouse",
      "mac",
    ],
    images: [
      {
        url: "/rooms/b154.jpg",
        alt: "Room B154 with its tables set in a U-shape facing the wall display",
        kind: "PHOTO",
      },
      { url: "/plans/b154.png", alt: "Floor plan with B154 highlighted", kind: "PLAN" },
    ],
    planKey: "b154",
    sortOrder: 60,
  },
  {
    slug: "b155",
    number: "B155",
    name: "Room B155",
    type: "CONFERENCE",
    capacity: 18,
    widthFt: 30,
    lengthFt: 20,
    summary: "The largest classroom — 18 seats, Zoom-capable, displays on wheels.",
    description:
      "The east-most of the three large rooms and the biggest of them by seat count, with nine tables and 18 chairs. Its two displays are on wheels, so the front of the room can move with the layout. Zoom-capable, driven by a Windows PC.",
    amenities: [
      "classroom",
      "zoom",
      "tables",
      "mobile-tv",
      "camera",
      "camera-remote",
      "keyboard-mouse",
      "pc",
    ],
    images: [
      { url: "/rooms/b155.jpg", alt: "Room B155 set up as a classroom", kind: "PHOTO" },
      { url: "/plans/b155.png", alt: "Floor plan with B155 highlighted", kind: "PLAN" },
    ],
    planKey: "b155",
    sortOrder: 70,
  },
  {
    slug: "c165a",
    number: "C165a",
    name: "Room C165a",
    type: "CONFERENCE",
    building: "ATB C State Building",
    capacity: 18,
    maxOccupancy: 45,
    widthFt: 28,
    lengthFt: 24,
    summary: "Zoom-capable classroom with a projector, along the ATB C wing.",
    description:
      "A 28-by-24 classroom at the east end of the corridor, in the ATB C State Building rather than the JAG-Ed Center itself. Six tables and 18 chairs face a projector screen, with a camera and PC for Zoom sessions. Posted occupancy is 45, so it takes a larger standing audience than the seated count suggests.",
    amenities: [
      "classroom",
      "zoom",
      "tables",
      "projector",
      "camera",
      "camera-remote",
      "keyboard-mouse",
      "pc",
    ],
    images: [{ url: "/rooms/c165a.jpg", alt: "Room C165a set up in rows facing the projector screen", kind: "PHOTO" }],
    planKey: "c165a",
    sortOrder: 80,
  },
  {
    slug: "c165b",
    number: "C165b",
    name: "Room C165b",
    type: "CONFERENCE",
    building: "ATB C State Building",
    capacity: 18,
    maxOccupancy: 45,
    widthFt: 23,
    lengthFt: 27,
    summary: "Zoom-capable classroom with a projector and whiteboard.",
    description:
      "A 23-by-27 classroom in the ATB C State Building, next door to C165a. Six tables and 18 chairs face a projector screen, with a whiteboard on the side wall and a camera and PC for Zoom. Posted occupancy is 45.",
    amenities: [
      "classroom",
      "zoom",
      "tables",
      "projector",
      "camera",
      "camera-remote",
      "keyboard-mouse",
      "whiteboard",
      "pc",
    ],
    images: [{ url: "/rooms/c165b.jpg", alt: "Room C165b set up in rows facing the projector screen", kind: "PHOTO" }],
    planKey: "c165b",
    sortOrder: 90,
  },
  {
    slug: "c165a-b",
    number: "C165a+b",
    name: "Room C165 (both halves)",
    type: "ADAPTABLE",
    building: "ATB C State Building",
    capacity: 36,
    maxOccupancy: 90,
    // No width/length: the two halves sit side by side, so the combined
    // footprint is not a simple rectangle. Roughly 1,290 sq ft in total.
    widthFt: undefined as unknown as number,
    lengthFt: undefined as unknown as number,
    spaces: ["c165a", "c165b"],
    summary: "C165a and C165b with the partition opened — the largest room on offer.",
    description:
      "C165 is one room divided by a movable partition wall. Opened up it seats 36 at twelve tables with a posted occupancy of 90, roughly 1,290 square feet, and has a projector at each end. Because opening the partition takes staff time, requests for the combined space are reviewed before they are confirmed. Reserving it holds both halves, so C165a and C165b cannot be booked separately at the same time.",
    amenities: [
      "classroom",
      "zoom",
      "tables",
      "projector",
      "camera",
      "camera-remote",
      "keyboard-mouse",
      "whiteboard",
      "pc",
    ],
    images: [
      { url: "/rooms/c165a.jpg", alt: "The C165a half, set up in rows facing the projector screen", kind: "PHOTO" },
      { url: "/rooms/c165b.jpg", alt: "The C165b half, set up in rows facing the projector screen", kind: "PHOTO" },
    ],
    planKey: "c165a",
    sortOrder: 100,
    needsApproval: true,
    maxMinutes: 480,
  },
];

/** A few reservations so an empty prototype does not look broken. */
const DEMO_BOOKINGS = [
  { slug: "b153", dayOffset: 1, startMinute: 9 * 60, minutes: 120, title: "ENGR 102 review session", who: ["Dana Whitfield", "dwhitfield@example.edu"], attendees: 14 },
  { slug: "b138", dayOffset: 1, startMinute: 10 * 60, minutes: 60, title: "Advising drop-in", who: ["Marcus Reyes", "mreyes@example.edu"], attendees: 4 },
  { slug: "b139", dayOffset: 1, startMinute: 13 * 60 + 30, minutes: 90, title: "Capstone team standup", who: ["Priya Raman", "praman@example.edu"], attendees: 8 },
  { slug: "b155", dayOffset: 2, startMinute: 8 * 60, minutes: 180, title: "Faculty search committee", who: ["Alex Osei", "aosei@example.edu"], attendees: 12 },
  { slug: "b142", dayOffset: 2, startMinute: 11 * 60, minutes: 60, title: "1:1", who: ["Jordan Kim", "jkim@example.edu"], attendees: 2 },
  { slug: "b154", dayOffset: 3, startMinute: 14 * 60, minutes: 120, title: "Grad recruiting info session", who: ["Sam Ortega", "sortega@example.edu"], attendees: 16 },
  { slug: "b153", dayOffset: 3, startMinute: 9 * 60, minutes: 120, title: "ENGR 102 review session", who: ["Dana Whitfield", "dwhitfield@example.edu"], attendees: 14 },
  { slug: "b143", dayOffset: 4, startMinute: 15 * 60, minutes: 60, title: "Sponsor call", who: ["Priya Raman", "praman@example.edu"], attendees: 3 },
  { slug: "jag-ed-center", dayOffset: 7, startMinute: 16 * 60, minutes: 180, title: "Engineering Design Day reception", who: ["Alex Osei", "aosei@example.edu"], attendees: 90 },
];

/** Skip weekends so demo data lands inside opening hours. */
function nextOpenDayKey(offset: number): string {
  let key = todayKey();
  let moved = 0;
  while (moved < offset) {
    key = addDaysToKey(key, 1);
    const day = weekdayOf(key);
    if (day >= 1 && day <= 5) moved += 1;
  }
  return key;
}

async function main() {
  console.log("Seeding amenities…");
  for (const amenity of AMENITIES) {
    await prisma.amenity.upsert({
      where: { key: amenity.key },
      update: { label: amenity.label, category: amenity.category },
      create: amenity,
    });
  }

  console.log("Seeding physical spaces…");
  const spaceKeys = new Set<string>();
  for (const room of ROOMS) {
    for (const key of room.spaces ?? [room.slug]) spaceKeys.add(key);
  }
  for (const key of spaceKeys) {
    const owner = ROOMS.find((r) => (r.spaces ?? [r.slug]).length === 1 && r.slug === key);
    await prisma.space.upsert({
      where: { key },
      update: { label: owner?.name ?? key },
      create: { key, label: owner?.name ?? key },
    });
  }

  // Once the admin panel is in use the database is the source of truth, not
  // this file. Re-seeding therefore leaves existing rooms completely alone —
  // fields, amenities and photos — so an edit or an uploaded photo is never
  // silently reverted. SEED_RESET=1 restores the original transcription.
  const reset = process.env.SEED_RESET === "1";
  console.log(reset ? "Seeding rooms (SEED_RESET: overwriting)…" : "Seeding rooms…");

  for (const room of ROOMS) {
    const { amenities, images, spaces, ...fields } = room;
    const spaceList = spaces ?? [room.slug];

    const existing = await prisma.room.findUnique({
      where: { slug: room.slug },
      select: { id: true },
    });
    if (existing && !reset) {
      console.log(`  kept ${room.number} (already exists)`);
      continue;
    }
    const saved = await prisma.room.upsert({
      where: { slug: room.slug },
      update: {
        ...fields,
        amenities: { set: amenities.map((key) => ({ key })) },
      },
      create: {
        ...fields,
        amenities: { connect: amenities.map((key) => ({ key })) },
      },
    });

    await prisma.roomSpace.deleteMany({ where: { roomId: saved.id } });
    await prisma.roomSpace.createMany({
      data: await Promise.all(
        spaceList.map(async (key) => ({
          roomId: saved.id,
          spaceId: (await prisma.space.findUniqueOrThrow({ where: { key } })).id,
        })),
      ),
    });

    await prisma.roomImage.deleteMany({ where: { roomId: saved.id } });
    await prisma.roomImage.createMany({
      data: images.map((image, index) => ({ ...image, roomId: saved.id, sortOrder: index })),
    });
  }

  console.log("Seeding demo reservations…");
  await prisma.booking.deleteMany({ where: { requesterEmail: { endsWith: "@example.edu" } } });
  for (const demo of DEMO_BOOKINGS) {
    const room = await prisma.room.findUnique({ where: { slug: demo.slug } });
    if (!room) continue;
    const dateKey = nextOpenDayKey(demo.dayOffset);
    const startsAt = dateKeyToUtc(dateKey, demo.startMinute);
    const endsAt = dateKeyToUtc(dateKey, demo.startMinute + demo.minutes);
    const [name, email] = demo.who;
    const roomSpaces = await prisma.roomSpace.findMany({ where: { roomId: room.id } });
    await prisma.booking.create({
      data: {
        roomId: room.id,
        startsAt,
        endsAt,
        status: room.needsApproval ? "PENDING" : "CONFIRMED",
        title: demo.title,
        attendees: demo.attendees,
        requesterName: name,
        requesterEmail: email,
        department: "College of Engineering",
        spaces: {
          create: roomSpaces.map((rs) => ({ spaceId: rs.spaceId, startsAt, endsAt })),
        },
      },
    });
  }

  const [rooms, bookings] = await Promise.all([prisma.room.count(), prisma.booking.count()]);
  console.log(`Done — ${rooms} rooms, ${bookings} reservations.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

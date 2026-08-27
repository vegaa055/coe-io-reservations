-- CreateEnum
CREATE TYPE "RoomType" AS ENUM ('MEETING', 'CONFERENCE', 'ADAPTABLE');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'DENIED');

-- CreateEnum
CREATE TYPE "ImageKind" AS ENUM ('PHOTO', 'PLAN');

-- CreateTable
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "RoomType" NOT NULL,
    "building" TEXT NOT NULL DEFAULT 'JAG-Ed Center',
    "floor" TEXT NOT NULL DEFAULT 'B',
    "summary" TEXT NOT NULL,
    "description" TEXT,
    "capacity" INTEGER NOT NULL,
    "widthFt" INTEGER,
    "lengthFt" INTEGER,
    "isBookable" BOOLEAN NOT NULL DEFAULT true,
    "needsApproval" BOOLEAN NOT NULL DEFAULT false,
    "openMinute" INTEGER NOT NULL DEFAULT 420,
    "closeMinute" INTEGER NOT NULL DEFAULT 1200,
    "openDays" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5]::INTEGER[],
    "minMinutes" INTEGER NOT NULL DEFAULT 30,
    "maxMinutes" INTEGER NOT NULL DEFAULT 240,
    "advanceDays" INTEGER NOT NULL DEFAULT 120,
    "planKey" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "amenities" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',

    CONSTRAINT "amenities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_images" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT NOT NULL,
    "kind" "ImageKind" NOT NULL DEFAULT 'PHOTO',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "room_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "title" TEXT NOT NULL,
    "purpose" TEXT,
    "attendees" INTEGER NOT NULL DEFAULT 1,
    "requester_name" TEXT NOT NULL,
    "requester_email" TEXT NOT NULL,
    "requester_phone" TEXT,
    "department" TEXT,
    "manage_token" TEXT NOT NULL,
    "cancelled_at" TIMESTAMPTZ(3),
    "cancel_reason" TEXT,
    "staff_note" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "closures" (
    "id" TEXT NOT NULL,
    "room_id" TEXT,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "closures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_AmenityToRoom" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AmenityToRoom_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "rooms_slug_key" ON "rooms"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_number_key" ON "rooms"("number");

-- CreateIndex
CREATE INDEX "rooms_type_idx" ON "rooms"("type");

-- CreateIndex
CREATE UNIQUE INDEX "amenities_key_key" ON "amenities"("key");

-- CreateIndex
CREATE INDEX "room_images_room_id_idx" ON "room_images"("room_id");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_manage_token_key" ON "bookings"("manage_token");

-- CreateIndex
CREATE INDEX "bookings_room_id_starts_at_idx" ON "bookings"("room_id", "starts_at");

-- CreateIndex
CREATE INDEX "bookings_requester_email_idx" ON "bookings"("requester_email");

-- CreateIndex
CREATE INDEX "bookings_status_idx" ON "bookings"("status");

-- CreateIndex
CREATE INDEX "closures_room_id_starts_at_idx" ON "closures"("room_id", "starts_at");

-- CreateIndex
CREATE INDEX "_AmenityToRoom_B_index" ON "_AmenityToRoom"("B");

-- AddForeignKey
ALTER TABLE "room_images" ADD CONSTRAINT "room_images_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "closures" ADD CONSTRAINT "closures_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AmenityToRoom" ADD CONSTRAINT "_AmenityToRoom_A_fkey" FOREIGN KEY ("A") REFERENCES "amenities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AmenityToRoom" ADD CONSTRAINT "_AmenityToRoom_B_fkey" FOREIGN KEY ("B") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Double-booking safety.
--
-- Hand-written: Prisma cannot express exclusion constraints, so this block is
-- appended to the generated migration. Keep it if this migration is ever
-- regenerated.
--
-- btree_gist lets a GiST index mix plain equality ("room_id") with a range
-- overlap operator, which is what makes the constraint below possible.
-- The range is half-open '[)', so a booking ending at 10:00 and one starting at
-- 10:00 do not collide. Only PENDING and CONFIRMED hold a slot; cancelled and
-- denied rows fall out of the index, so a room can be rebooked after a
-- cancellation.
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "bookings"
    ADD CONSTRAINT "bookings_end_after_start" CHECK ("ends_at" > "starts_at");

ALTER TABLE "bookings"
    ADD CONSTRAINT "bookings_no_overlap"
    EXCLUDE USING gist (
        "room_id" WITH =,
        tstzrange("starts_at", "ends_at", '[)') WITH &&
    ) WHERE ("status" IN ('PENDING', 'CONFIRMED'));

ALTER TABLE "closures"
    ADD CONSTRAINT "closures_end_after_start" CHECK ("ends_at" > "starts_at");

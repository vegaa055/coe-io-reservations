-- CreateTable
CREATE TABLE "spaces" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "spaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_spaces" (
    "room_id" TEXT NOT NULL,
    "space_id" TEXT NOT NULL,

    CONSTRAINT "room_spaces_pkey" PRIMARY KEY ("room_id","space_id")
);

-- CreateTable
CREATE TABLE "booking_spaces" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "space_id" TEXT NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "booking_spaces_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "spaces_key_key" ON "spaces"("key");

-- CreateIndex
CREATE INDEX "room_spaces_space_id_idx" ON "room_spaces"("space_id");

-- CreateIndex
CREATE INDEX "booking_spaces_space_id_starts_at_idx" ON "booking_spaces"("space_id", "starts_at");

-- CreateIndex
CREATE INDEX "booking_spaces_booking_id_idx" ON "booking_spaces"("booking_id");

-- AddForeignKey
ALTER TABLE "room_spaces" ADD CONSTRAINT "room_spaces_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_spaces" ADD CONSTRAINT "room_spaces_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_spaces" ADD CONSTRAINT "booking_spaces_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_spaces" ADD CONSTRAINT "booking_spaces_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Double-booking safety, generalised to divisible rooms.
--
-- The constraint on "bookings" can only compare bookings of the same room_id.
-- That is not enough once one physical space is listed more than once: C165a,
-- C165b and the combined C165 are three different room_ids over two physical
-- halves, so two concurrent requests for "the whole room" and "half of it"
-- would both pass and both insert.
--
-- Every booking therefore claims one row per physical space it occupies, and
-- the exclusion lives here instead. No WHERE clause is needed: a claim exists
-- only while the booking holds the space, and is deleted on cancel or deny.
-- ---------------------------------------------------------------------------
ALTER TABLE "booking_spaces"
    ADD CONSTRAINT "booking_spaces_end_after_start" CHECK ("ends_at" > "starts_at");

ALTER TABLE "booking_spaces"
    ADD CONSTRAINT "booking_spaces_no_overlap"
    EXCLUDE USING gist (
        "space_id" WITH =,
        tstzrange("starts_at", "ends_at", '[)') WITH &&
    );

-- Backfill: every existing room becomes exactly one space, and every booking
-- that currently holds its room claims that space.
INSERT INTO "spaces" ("id", "key", "label")
SELECT gen_random_uuid()::text, r."slug", r."name" FROM "rooms" r;

INSERT INTO "room_spaces" ("room_id", "space_id")
SELECT r."id", s."id" FROM "rooms" r JOIN "spaces" s ON s."key" = r."slug";

INSERT INTO "booking_spaces" ("id", "booking_id", "space_id", "starts_at", "ends_at")
SELECT gen_random_uuid()::text, b."id", rs."space_id", b."starts_at", b."ends_at"
FROM "bookings" b
JOIN "room_spaces" rs ON rs."room_id" = b."room_id"
WHERE b."status" IN ('PENDING', 'CONFIRMED');

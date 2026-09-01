import type { RoomType } from "@prisma/client";
import { Suspense } from "react";

import { FloorPlan } from "@/components/floor-plan/floor-plan";
import { RoomCard } from "@/components/room-card";
import { RoomFilters } from "@/components/room-filters";
import { getFilterableAmenities, getRoomsWithStatus } from "@/lib/rooms";

export const dynamic = "force-dynamic";

const VALID_TYPES: RoomType[] = ["MEETING", "CONFERENCE", "ADAPTABLE"];

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const typeParam = first(params.type);
  const seatsParam = Number(first(params.seats));

  const filters = {
    type: VALID_TYPES.includes(typeParam as RoomType) ? (typeParam as RoomType) : undefined,
    minSeats: Number.isFinite(seatsParam) && seatsParam > 0 ? seatsParam : undefined,
    amenity: first(params.amenity),
    freeNow: first(params.free) === "1",
  };

  const [rooms, amenities, allRooms] = await Promise.all([
    getRoomsWithStatus(filters),
    getFilterableAmenities(),
    getRoomsWithStatus(),
  ]);

  const planRooms = allRooms.map((room) => ({
    slug: room.slug,
    number: room.number,
    name: room.name,
    capacity: room.capacity,
    status: room.status,
  }));

  return (
    <div className="flex flex-col gap-8">
      <section className="max-w-2xl">
        {/* The header logo already says College of Engineering, so no eyebrow here. */}
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Reserve a room
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted">
          Meeting rooms, classrooms and the full commons, across the JAG-Ed Center and the ATB C
          State Building. Pick a room to see photos, equipment and what is open this week.
        </p>
      </section>

      <section className="rounded-xl border border-line bg-raised p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 className="text-sm font-semibold">Where the rooms are</h2>
          <p className="text-xs text-muted">
            Select a room to open it. Shaded rooms are not reservable.
          </p>
        </div>
        <FloorPlan rooms={planRooms} className="mt-3 overflow-x-auto" />
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
          <LegendItem color="var(--free)" background="var(--free-soft)" label="Free now" />
          <LegendItem color="var(--busy)" background="var(--busy-soft)" label="In use" />
          <LegendItem
            color="var(--plan-line)"
            background="var(--plan-context)"
            label="Closed or not reservable"
          />
        </ul>
      </section>

      <div className="flex flex-col gap-5">
        <Suspense fallback={<div className="h-36 rounded-xl border border-line bg-raised" />}>
          <RoomFilters amenities={amenities.map((a) => ({ key: a.key, label: a.label }))} />
        </Suspense>

        <p className="text-sm text-muted" aria-live="polite">
          {rooms.length} of {allRooms.length} spaces
        </p>

        {rooms.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line-strong p-10 text-center">
            <p className="font-medium">Nothing matches those filters.</p>
            <p className="mt-1 text-sm text-muted">
              Try widening the seat count or clearing the equipment filter.
            </p>
          </div>
        ) : (
          <ul className="grid gap-4 xl:grid-cols-2">
            {rooms.map((room) => (
              <li key={room.id}>
                <RoomCard room={room} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function LegendItem({
  color,
  background,
  label,
}: {
  color: string;
  background: string;
  label: string;
}) {
  return (
    <li className="flex items-center gap-1.5">
      <span
        aria-hidden
        className="h-3 w-3 rounded-sm border"
        style={{ background, borderColor: color }}
      />
      {label}
    </li>
  );
}

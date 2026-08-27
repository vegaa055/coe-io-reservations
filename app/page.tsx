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
        <p className="text-sm font-medium uppercase tracking-wide text-brand">
          College of Engineering
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Reserve a space in the JAG-Ed Center
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted">
          Eight reservable spaces, from five-seat huddle pods to the full commons. Pick a room to
          see photos, equipment and what is open this week.
        </p>
      </section>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="flex flex-col gap-5">
          <Suspense
            fallback={<div className="h-36 rounded-xl border border-line bg-raised" />}
          >
            <RoomFilters
              amenities={amenities.map((a) => ({ key: a.key, label: a.label }))}
            />
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
            <ul className="flex flex-col gap-4">
              {rooms.map((room) => (
                <li key={room.id}>
                  <RoomCard room={room} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="order-first rounded-xl border border-line bg-raised p-4 lg:order-none lg:sticky lg:top-24">
          <h2 className="text-sm font-semibold">Where the rooms are</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Select a room on the plan to open it.
          </p>
          <FloorPlan rooms={planRooms} className="mt-3" />
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
            <LegendItem color="var(--free)" background="var(--free-soft)" label="Free now" />
            <LegendItem color="var(--busy)" background="var(--busy-soft)" label="In use" />
            <LegendItem
              color="var(--plan-line)"
              background="var(--plan-context)"
              label="Closed or not reservable"
            />
          </ul>
        </aside>
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

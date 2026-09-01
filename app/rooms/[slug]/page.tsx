import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BookingPanel, type DayBooking } from "@/components/booking-panel";
import { FloorPlan } from "@/components/floor-plan/floor-plan";
import { PLANNED_SLUGS } from "@/components/floor-plan/geometry";
import { Gallery } from "@/components/gallery";
import { LiveStatusPill } from "@/components/status-pill";
import { getViewer } from "@/lib/auth";
import { buildDaySchedule } from "@/lib/availability";
import {
  getDayIntervals,
  getOverlappingRooms,
  getRoom,
  getRoomsWithStatus,
  ROOM_TYPE_LABEL,
} from "@/lib/rooms";
import { addDaysToKey, dateKeyToUtc, minutesOfDay, todayKey } from "@/lib/time";

export const dynamic = "force-dynamic";

const CATEGORY_LABEL: Record<string, string> = {
  av: "Audio / video",
  computing: "Computing",
  furniture: "Furniture",
  features: "Room features",
  general: "Other",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const room = await getRoom(slug);
  if (!room) return { title: "Room not found" };
  return { title: room.name, description: room.summary };
}

export default async function RoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const room = await getRoom(slug);
  if (!room) notFound();

  const requested = Array.isArray(query.date) ? query.date[0] : query.date;
  const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(requested ?? "") ? requested! : todayKey();

  const dayStart = dateKeyToUtc(dateKey, 0);
  const dayEnd = dateKeyToUtc(addDaysToKey(dateKey, 1), 0);
  const [{ bookings, closures }, viewer, allRooms, sharesWith] = await Promise.all([
    getDayIntervals(room.id, dayStart, dayEnd),
    getViewer(),
    getRoomsWithStatus(),
    getOverlappingRooms(room.id),
  ]);

  const schedule = buildDaySchedule(
    room,
    dateKey,
    bookings.map((b) => ({ start: b.startsAt, end: b.endsAt })),
    closures.map((c) => ({ start: c.startsAt, end: c.endsAt })),
  );

  // Non-staff see that a slot is taken, not who took it or why.
  const dayBookings: DayBooking[] = bookings.map((booking) => ({
    startMinute: minutesOfDay(booking.startsAt),
    endMinute: minutesOfDay(booking.endsAt),
    label: viewer?.isStaff
      ? `${booking.title} — ${booking.requesterName}${booking.viaRoomName ? ` · via ${booking.viaRoomName}` : ""}`
      : booking.viaRoomName
        ? `Reserved — ${booking.viaRoomName}`
        : "Reserved",
  }));

  const photos = room.images.filter((image) => image.kind === "PHOTO");
  const live = allRooms.find((r) => r.id === room.id);

  const byCategory = new Map<string, typeof room.amenities>();
  for (const amenity of room.amenities) {
    const list = byCategory.get(amenity.category) ?? [];
    list.push(amenity);
    byCategory.set(amenity.category, list);
  }

  return (
    <div className="flex flex-col gap-8">
      <nav className="text-sm">
        <Link href="/" className="text-muted hover:text-ink hover:underline">
          ← All spaces
        </Link>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{room.name}</h1>
          <p className="mt-1.5 text-muted">
            {ROOM_TYPE_LABEL[room.type]} · seats {room.capacity}
            {room.widthFt && room.lengthFt ? ` · ${room.widthFt}×${room.lengthFt} ft` : ""} ·{" "}
            {room.building}
          </p>
        </div>
        {live && <LiveStatusPill status={live.status} busyUntil={live.busyUntil} />}
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start">
        <div className="flex flex-col gap-8">
          <Gallery
            images={photos.map((image) => ({ id: image.id, url: image.url, alt: image.alt }))}
          />

          {room.description && (
            <section>
              <h2 className="text-lg font-semibold">About this space</h2>
              <p className="mt-2 leading-relaxed text-muted">{room.description}</p>
            </section>
          )}

          {sharesWith.length > 0 && (
            <aside className="rounded-xl border border-line bg-sunken p-4 text-sm">
              <p className="font-medium">Shares floor space</p>
              <p className="mt-1 leading-relaxed text-muted">
                The same floor is also listed as{" "}
                {sharesWith.map((other, i) => (
                  <span key={other.slug}>
                    {i > 0 && (i === sharesWith.length - 1 ? " and " : ", ")}
                    <Link href={`/rooms/${other.slug}`} className="text-brand hover:underline">
                      {other.name}
                    </Link>
                  </span>
                ))}
                . Reserving any one of them holds the space, so they can never overlap.
              </p>
            </aside>
          )}

          <section>
            <h2 className="text-lg font-semibold">At a glance</h2>
            <dl className="spec-grid mt-3">
              <Spec label="Seats" value={String(room.capacity)} />
              {room.maxOccupancy && (
                <Spec label="Max occupancy" value={String(room.maxOccupancy)} />
              )}
              {room.widthFt && room.lengthFt && (
                <Spec label="Size" value={`${room.widthFt} × ${room.lengthFt} ft`} />
              )}
              <Spec label="Type" value={ROOM_TYPE_LABEL[room.type]} />
              <Spec
                label="Max booking"
                value={`${Math.round(room.maxMinutes / 60)} hr`}
              />
              <Spec label="Room" value={room.number} />
            </dl>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Equipment</h2>
            {room.amenities.length === 0 ? (
              <p className="mt-2 text-sm text-muted">
                The equipment list for this space has not been confirmed yet — contact the
                JAG-Ed Center before you plan around specific AV.
              </p>
            ) : (
              <div className="mt-3 grid gap-5 sm:grid-cols-2">
                {[...byCategory.entries()].map(([category, items]) => (
                  <div key={category}>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">
                      {CATEGORY_LABEL[category] ?? category}
                    </h3>
                    <ul className="mt-1.5 space-y-1 text-sm text-muted">
                      {items.map((item) => (
                        <li key={item.id}>{item.label}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-lg font-semibold">Finding it</h2>
            {PLANNED_SLUGS.has(room.slug) ? (
              <>
                <p className="mt-1 text-sm text-muted">
                  {room.name} highlighted on the floor plan.
                </p>
                <div className="mt-3 rounded-xl border border-line bg-raised p-4">
                  <FloorPlan
                    rooms={allRooms.map((r) => ({
                      slug: r.slug,
                      number: r.number,
                      name: r.name,
                      capacity: r.capacity,
                    }))}
                    selectedSlug={room.slug}
                  />
                </div>
              </>
            ) : (
              <p className="mt-1 text-sm text-muted">
                {room.name} is in the {room.building}, east along the corridor from the JAG-Ed
                Center. It is not on the floor plan yet.
              </p>
            )}
          </section>
        </div>

        <div className="lg:sticky lg:top-24">
          <BookingPanel
            key={dateKey}
            room={{
              slug: room.slug,
              name: room.name,
              capacity: room.capacity,
              maxOccupancy: room.maxOccupancy,
              needsApproval: room.needsApproval,
              isBookable: room.isBookable,
              openMinute: room.openMinute,
              closeMinute: room.closeMinute,
              openDays: room.openDays,
              minMinutes: room.minMinutes,
              maxMinutes: room.maxMinutes,
              advanceDays: room.advanceDays,
            }}
            dateKey={dateKey}
            schedule={schedule}
            dayBookings={dayBookings}
            viewer={viewer}
          />
        </div>
      </div>
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-faint">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}

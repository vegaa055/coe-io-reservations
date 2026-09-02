import Link from "next/link";

import { RoomAdminList } from "@/components/admin/room-admin-list";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { storageStatus } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function AdminRoomsPage() {
  const admin = await requireAdmin();
  if (!admin) return null;

  const rooms = await prisma.room.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      spaces: { include: { space: { select: { key: true } } } },
      _count: { select: { bookings: true } },
    },
  });

  const storage = storageStatus();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          Changes here take effect immediately. Editing a room does not touch existing
          reservations, so shortening the opening hours will not cancel a booking that already
          falls outside them.
        </p>
        <Link
          href="/admin/rooms/new"
          className="shrink-0 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-on-brand hover:bg-brand-hover"
        >
          Add a room
        </Link>
      </div>

      <RoomAdminList
        storageNote={storage.note}
        storageDriver={storage.driver}
        rooms={rooms.map((room) => ({
          slug: room.slug,
          name: room.name,
          number: room.number,
          building: room.building,
          type: room.type,
          summary: room.summary,
          description: room.description,
          capacity: room.capacity,
          maxOccupancy: room.maxOccupancy,
          widthFt: room.widthFt,
          lengthFt: room.lengthFt,
          isBookable: room.isBookable,
          needsApproval: room.needsApproval,
          openMinute: room.openMinute,
          closeMinute: room.closeMinute,
          openDays: room.openDays,
          minMinutes: room.minMinutes,
          maxMinutes: room.maxMinutes,
          advanceDays: room.advanceDays,
          sortOrder: room.sortOrder,
          bookingCount: room._count.bookings,
          spaceKeys: room.spaces.map((s) => s.space.key),
          images: room.images.map((i) => ({
            id: i.id,
            url: i.url,
            alt: i.alt,
            kind: i.kind,
            sortOrder: i.sortOrder,
          })),
        }))}
      />
    </div>
  );
}

import Image from "next/image";
import Link from "next/link";

import { ROOM_TYPE_LABEL, type RoomWithDetail } from "@/lib/rooms";

import { LiveStatusPill } from "./status-pill";

export function RoomCard({ room }: { room: RoomWithDetail }) {
  const photo = room.images.find((image) => image.kind === "PHOTO");
  const amenities = room.amenities.slice(0, 4);
  const extra = room.amenities.length - amenities.length;

  return (
    <Link
      href={`/rooms/${room.slug}`}
      className="group grid gap-0 overflow-hidden rounded-xl border border-line bg-raised transition-all hover:border-line-strong hover:shadow-lg sm:grid-cols-[13rem_1fr]"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-sunken sm:aspect-auto sm:h-full">
        {photo ? (
          <Image
            src={photo.url}
            alt={photo.alt}
            fill
            sizes="(max-width: 640px) 100vw, 13rem"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full min-h-32 items-center justify-center text-xs text-faint">
            Photo coming soon
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold leading-tight">{room.name}</h3>
            <p className="mt-0.5 text-sm text-muted">
              {ROOM_TYPE_LABEL[room.type]} · seats {room.capacity}
              {room.maxOccupancy ? ` (holds ${room.maxOccupancy})` : ""}
              {room.widthFt && room.lengthFt ? ` · ${room.widthFt}×${room.lengthFt} ft` : ""}
            </p>
            <p className="mt-0.5 text-xs text-faint">{room.building}</p>
          </div>
          <LiveStatusPill status={room.status} busyUntil={room.busyUntil} />
        </div>

        <p className="text-sm leading-relaxed text-muted">{room.summary}</p>

        {amenities.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {amenities.map((amenity) => (
              <li
                key={amenity.id}
                className="rounded-md border border-line bg-surface px-2 py-1 text-xs text-muted"
              >
                {amenity.label}
              </li>
            ))}
            {extra > 0 && (
              <li className="rounded-md px-2 py-1 text-xs text-faint">+{extra} more</li>
            )}
          </ul>
        )}

        <span className="mt-auto pt-1 text-sm font-medium text-brand group-hover:underline">
          {room.needsApproval ? "Request this space" : "See availability"} →
        </span>
      </div>
    </Link>
  );
}

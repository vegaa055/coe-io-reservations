"use client";

import Link from "next/link";
import { useState } from "react";

import { ImageManager, type AdminImage } from "./image-manager";
import { RoomForm, type RoomFormValues } from "./room-form";

export type AdminRoom = RoomFormValues & {
  bookingCount: number;
  spaceKeys: string[];
  images: AdminImage[];
};

export function RoomAdminList({
  rooms,
  storageNote,
  storageDriver,
}: {
  rooms: AdminRoom[];
  storageNote: string;
  storageDriver: "blob" | "local";
}) {
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  return (
    <ul className="flex flex-col gap-3">
      {rooms.map((room) => {
        const isOpen = openSlug === room.slug;
        const photos = room.images.filter((i) => i.kind === "PHOTO").length;
        return (
          <li key={room.slug} className="rounded-xl border border-line bg-raised">
            <div className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {room.name}
                  {!room.isBookable && (
                    <span className="ml-2 rounded-full bg-sunken px-2 py-0.5 text-xs font-normal text-muted">
                      Not bookable
                    </span>
                  )}
                  {room.needsApproval && (
                    <span className="ml-2 rounded-full bg-pending-soft px-2 py-0.5 text-xs font-normal text-pending">
                      Needs approval
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-sm text-muted">
                  {room.building} · seats {room.capacity} · {photos} photo
                  {photos === 1 ? "" : "s"} · {room.bookingCount} reservation
                  {room.bookingCount === 1 ? "" : "s"}
                  {room.spaceKeys.length > 1 && (
                    <> · shares {room.spaceKeys.length} spaces</>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={`/rooms/${room.slug}`}
                  className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-sunken"
                >
                  View
                </Link>
                <button
                  type="button"
                  onClick={() => setOpenSlug(isOpen ? null : room.slug)}
                  aria-expanded={isOpen}
                  className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-on-brand hover:bg-brand-hover"
                >
                  {isOpen ? "Close" : "Edit"}
                </button>
              </div>
            </div>

            {isOpen && (
              <div className="grid gap-8 border-t border-line p-5 lg:grid-cols-2">
                <RoomForm mode="edit" room={room} />
                <ImageManager
                  slug={room.slug}
                  images={room.images}
                  storageNote={storageNote}
                  storageDriver={storageDriver}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

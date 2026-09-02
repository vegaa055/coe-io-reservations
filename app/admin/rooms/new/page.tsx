import Link from "next/link";

import { BLANK_ROOM, RoomForm } from "@/components/admin/room-form";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function NewRoomPage() {
  const admin = await requireAdmin();
  if (!admin) return null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <Link href="/admin/rooms" className="text-sm text-muted hover:text-ink hover:underline">
        ← All rooms
      </Link>

      <div>
        <h2 className="text-xl font-semibold tracking-tight">Add a room</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          The room is created with its own physical space, so it cannot be double-booked. If it is
          actually one half of a divisible room like C165, say so and the space mapping needs
          setting up by hand — see the README.
        </p>
      </div>

      <div className="rounded-xl border border-line bg-raised p-5">
        <RoomForm mode="create" room={BLANK_ROOM} />
      </div>

      <p className="text-xs leading-relaxed text-faint">
        The room will not appear on the floor plan until its outline is added to the plan geometry
        (<code>scripts/trace_floor_plan.py</code>). Everything else — the room page, availability
        and booking — works straight away.
      </p>
    </div>
  );
}

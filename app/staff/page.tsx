import type { Metadata } from "next";
import Link from "next/link";

import { StaffActions } from "@/components/staff-actions";
import { BookingStatusPill } from "@/components/status-pill";
import { getViewer } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatRange } from "@/lib/time";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Staff" };

export default async function StaffPage() {
  const viewer = await getViewer();

  if (!viewer?.isStaff) {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-line bg-raised p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Staff only</h1>
        <p className="mt-2 leading-relaxed text-muted">
          This page lists every reservation in the center. Access is currently granted by email
          address through the <code className="rounded bg-sunken px-1 py-0.5">ADMIN_EMAILS</code>{" "}
          setting — it will move to a NetID group once campus sign-in is connected.
        </p>
        <Link href="/reservations" className="mt-4 inline-block text-sm text-brand hover:underline">
          Go to my reservations →
        </Link>
      </div>
    );
  }

  const now = new Date();
  const [pendingRequests, upcoming] = await Promise.all([
    prisma.booking.findMany({
      where: { status: "PENDING", endsAt: { gte: now } },
      include: { room: true },
      orderBy: { startsAt: "asc" },
    }),
    prisma.booking.findMany({
      where: { status: "CONFIRMED", endsAt: { gte: now } },
      include: { room: true },
      orderBy: { startsAt: "asc" },
      take: 100,
    }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Reservations</h1>
        <p className="mt-1.5 text-muted">
          {pendingRequests.length} awaiting approval · {upcoming.length} confirmed upcoming
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Awaiting approval</h2>
        {pendingRequests.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line-strong p-8 text-center text-sm text-muted">
            Nothing to review.
          </p>
        ) : (
          pendingRequests.map((booking) => (
            <StaffRow key={booking.id} booking={booking} isPending />
          ))
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Confirmed and upcoming</h2>
        {upcoming.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line-strong p-8 text-center text-sm text-muted">
            Nothing booked.
          </p>
        ) : (
          upcoming.map((booking) => <StaffRow key={booking.id} booking={booking} />)
        )}
      </section>
    </div>
  );
}

type Row = {
  id: string;
  title: string;
  purpose: string | null;
  attendees: number;
  requesterName: string;
  requesterEmail: string;
  requesterPhone: string | null;
  department: string | null;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "DENIED";
  startsAt: Date;
  endsAt: Date;
  room: { name: string; slug: string };
};

function StaffRow({ booking, isPending = false }: { booking: Row; isPending?: boolean }) {
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-line bg-raised p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{booking.title}</h3>
          <p className="mt-0.5 text-sm text-muted">
            <Link href={`/rooms/${booking.room.slug}`} className="hover:underline">
              {booking.room.name}
            </Link>{" "}
            · {formatRange(booking.startsAt, booking.endsAt)} · {booking.attendees}{" "}
            {booking.attendees === 1 ? "person" : "people"}
          </p>
        </div>
        <BookingStatusPill status={booking.status} />
      </div>

      <p className="text-sm text-muted">
        {booking.requesterName} ·{" "}
        <a href={`mailto:${booking.requesterEmail}`} className="hover:underline">
          {booking.requesterEmail}
        </a>
        {booking.requesterPhone ? ` · ${booking.requesterPhone}` : ""}
        {booking.department ? ` · ${booking.department}` : ""}
      </p>

      {booking.purpose && (
        <p className="rounded-lg bg-sunken px-3 py-2 text-sm text-muted">{booking.purpose}</p>
      )}

      <StaffActions bookingId={booking.id} pending={isPending} />
    </article>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

import { CancelBooking } from "@/components/cancel-booking";
import { BookingStatusPill } from "@/components/status-pill";
import { getViewer } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatRange } from "@/lib/time";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "My reservations" };

type BookingRow = Awaited<ReturnType<typeof loadByEmail>>[number];

async function loadByEmail(email: string) {
  return prisma.booking.findMany({
    where: { requesterEmail: email.toLowerCase() },
    include: { room: true },
    orderBy: { startsAt: "desc" },
    take: 100,
  });
}

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const token = Array.isArray(query.token) ? query.token[0] : query.token;
  const viewer = await getViewer();

  if (token) {
    const booking = await prisma.booking.findUnique({
      where: { manageToken: token },
      include: { room: true },
    });

    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <h1 className="text-3xl font-semibold tracking-tight">Your reservation</h1>
        {booking ? (
          <BookingCard booking={booking} showCancel />
        ) : (
          <p className="rounded-xl border border-line bg-raised p-6 text-muted">
            That reservation link is not valid. It may have been cancelled already.
          </p>
        )}
        <Link href="/reservations" className="text-sm text-brand hover:underline">
          See all of my reservations →
        </Link>
      </div>
    );
  }

  if (!viewer) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <h1 className="text-3xl font-semibold tracking-tight">My reservations</h1>
        <p className="leading-relaxed text-muted">
          Sign in with your NetID to see everything booked under your name.
        </p>
        <div>
          <Link
            href="/signin?next=/reservations"
            className="inline-block rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-on-brand hover:bg-brand-hover"
          >
            Sign in
          </Link>
        </div>
        <p className="text-sm leading-relaxed text-muted">
          Booked without signing in? The confirmation link from that reservation still opens it,
          and still cancels it.
        </p>
      </div>
    );
  }

  const bookings = await loadByEmail(viewer.email);
  const now = new Date();
  const upcoming = bookings.filter((b) => b.endsAt >= now && b.status !== "CANCELLED");
  const past = bookings.filter((b) => b.endsAt < now || b.status === "CANCELLED");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">My reservations</h1>
        <p className="mt-1.5 text-muted">Booked under {viewer.email}</p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Upcoming</h2>
        {upcoming.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line-strong p-8 text-center text-sm text-muted">
            Nothing booked yet.{" "}
            <Link href="/" className="text-brand hover:underline">
              Find a space
            </Link>
            .
          </p>
        ) : (
          upcoming.map((booking) => (
            <BookingCard key={booking.id} booking={booking} showCancel />
          ))
        )}
      </section>

      {past.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Past and cancelled</h2>
          {past.slice(0, 20).map((booking) => (
            <BookingCard key={booking.id} booking={booking} />
          ))}
        </section>
      )}
    </div>
  );
}

function BookingCard({ booking, showCancel }: { booking: BookingRow; showCancel?: boolean }) {
  const cancellable =
    showCancel && booking.status !== "CANCELLED" && booking.status !== "DENIED" && booking.endsAt >= new Date();

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-line bg-raised p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{booking.title}</h3>
          <p className="mt-0.5 text-sm text-muted">
            <Link href={`/rooms/${booking.room.slug}`} className="hover:underline">
              {booking.room.name}
            </Link>{" "}
            · {formatRange(booking.startsAt, booking.endsAt)}
          </p>
        </div>
        <BookingStatusPill status={booking.status} />
      </div>

      {booking.purpose && <p className="text-sm text-muted">{booking.purpose}</p>}
      {booking.staffNote && (
        <p className="rounded-lg bg-sunken px-3 py-2 text-sm text-muted">
          <span className="font-medium">Note from staff:</span> {booking.staffNote}
        </p>
      )}

      {cancellable && <CancelBooking manageToken={booking.manageToken} />}
    </article>
  );
}

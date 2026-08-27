import type { BookingStatus } from "@prisma/client";

import { formatTime } from "@/lib/time";

type LiveStatus = "free" | "busy" | "closed";

export function LiveStatusPill({
  status,
  busyUntil,
}: {
  status: LiveStatus;
  busyUntil?: Date | null;
}) {
  const styles: Record<LiveStatus, string> = {
    free: "bg-free-soft text-free",
    busy: "bg-busy-soft text-busy",
    closed: "bg-sunken text-muted",
  };

  const label =
    status === "free"
      ? "Free now"
      : status === "busy"
        ? busyUntil
          ? `In use until ${formatTime(busyUntil)}`
          : "In use"
        : "Closed now";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${styles[status]}`}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

const BOOKING_STATUS_STYLE: Record<BookingStatus, string> = {
  CONFIRMED: "bg-free-soft text-free",
  PENDING: "bg-pending-soft text-pending",
  CANCELLED: "bg-sunken text-muted",
  DENIED: "bg-busy-soft text-busy",
};

const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  CONFIRMED: "Confirmed",
  PENDING: "Awaiting approval",
  CANCELLED: "Cancelled",
  DENIED: "Not approved",
};

export function BookingStatusPill({ status }: { status: BookingStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${BOOKING_STATUS_STYLE[status]}`}
    >
      {BOOKING_STATUS_LABEL[status]}
    </span>
  );
}

"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useActionState, useMemo, useState } from "react";

import { createBookingAction, type BookingFormState } from "@/app/actions";
import type { DaySchedule, RoomPolicy } from "@/lib/availability";
import { durationOptions } from "@/lib/availability";
import {
  addDaysToKey,
  daysBetweenKeys,
  formatDateKeyLong,
  formatDuration,
  formatMinutes,
  todayKey,
} from "@/lib/time";

export type PanelRoom = RoomPolicy & {
  slug: string;
  name: string;
  capacity: number;
  /// Posted maximum where it differs from the seated count.
  maxOccupancy: number | null;
  needsApproval: boolean;
};

export type DayBooking = { startMinute: number; endMinute: number; label: string };

type Props = {
  room: PanelRoom;
  dateKey: string;
  schedule: DaySchedule;
  dayBookings: DayBooking[];
  viewer: { name: string; email: string; department: string | null } | null;
  /** When true, only signed-in people may reserve. Availability stays visible. */
  requireSignIn: boolean;
};

const initialState: BookingFormState = { status: "idle" };

export function BookingPanel({
  room,
  dateKey,
  schedule,
  dayBookings,
  viewer,
  requireSignIn,
}: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [startMinute, setStartMinute] = useState<number | null>(null);
  const [durationMinutes, setDuration] = useState<number | null>(null);
  const [state, formAction, pending] = useActionState(createBookingAction, initialState);

  const durations = useMemo(
    () => (startMinute === null ? [] : durationOptions(schedule, room, startMinute)),
    [schedule, room, startMinute],
  );

  const today = todayKey();
  const canGoBack = daysBetweenKeys(today, dateKey) > 0;
  const canGoForward = daysBetweenKeys(today, dateKey) < room.advanceDays;

  function goToDate(next: string) {
    const search = new URLSearchParams(params.toString());
    search.set("date", next);
    setStartMinute(null);
    setDuration(null);
    router.push(`?${search.toString()}`, { scroll: false });
  }

  function selectStart(minute: number) {
    setStartMinute(minute);
    const options = durationOptions(schedule, room, minute);
    setDuration(options.includes(60) ? 60 : (options[0] ?? null));
  }

  if (state.status === "success") {
    return (
      <div className="rounded-xl border border-line bg-raised p-6">
        <h2 className="text-lg font-semibold">
          {state.needsApproval ? "Request sent" : "You are booked"}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {state.needsApproval
            ? `Center staff will review your request for ${state.roomName} and confirm by email.`
            : `${state.roomName} is held for you.`}
        </p>
        <dl className="mt-4 space-y-1 text-sm">
          <div className="flex gap-2">
            <dt className="text-muted">When</dt>
            <dd className="font-medium">
              {formatDateKeyLong(dateKey)}, {formatMinutes(startMinute ?? 0)} –{" "}
              {formatMinutes((startMinute ?? 0) + (durationMinutes ?? 0))}
            </dd>
          </div>
        </dl>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href={`/reservations?token=${state.manageToken}`}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-on-brand hover:bg-brand-hover"
          >
            View or cancel it
          </Link>
          <button
            type="button"
            onClick={() => {
              setStartMinute(null);
              setDuration(null);
              router.refresh();
            }}
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-sunken"
          >
            Book another time
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line bg-raised p-5">
      <div>
        <h2 className="text-lg font-semibold">Check availability</h2>
        <p className="mt-1 text-sm text-muted">
          Open {formatMinutes(room.openMinute)} – {formatMinutes(room.closeMinute)}, weekdays.
          Up to {formatDuration(room.maxMinutes)} per reservation.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!canGoBack}
          onClick={() => goToDate(addDaysToKey(dateKey, -1))}
          aria-label="Previous day"
          className="rounded-lg border border-line px-3 py-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:bg-sunken"
        >
          ←
        </button>
        <input
          type="date"
          value={dateKey}
          min={today}
          max={addDaysToKey(today, room.advanceDays)}
          onChange={(event) => event.target.value && goToDate(event.target.value)}
          aria-label="Reservation date"
          className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={!canGoForward}
          onClick={() => goToDate(addDaysToKey(dateKey, 1))}
          aria-label="Next day"
          className="rounded-lg border border-line px-3 py-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:bg-sunken"
        >
          →
        </button>
      </div>

      <p className="text-sm font-medium">{formatDateKeyLong(dateKey)}</p>

      {schedule.closedReason ? (
        <p className="rounded-lg border border-line bg-sunken px-4 py-6 text-center text-sm text-muted">
          {schedule.closedReason}
        </p>
      ) : (
        <>
          <div
            role="group"
            aria-label="Available start times"
            className="grid grid-cols-3 gap-1.5 sm:grid-cols-4"
          >
            {schedule.slots.map((slot) => {
              const selected = startMinute === slot.start;
              const inSelection =
                startMinute !== null &&
                durationMinutes !== null &&
                slot.start >= startMinute &&
                slot.end <= startMinute + durationMinutes;

              if (slot.status !== "free") {
                return (
                  <span
                    key={slot.start}
                    aria-label={`${formatMinutes(slot.start)} ${
                      slot.status === "booked"
                        ? "reserved"
                        : slot.status === "past"
                          ? "already passed"
                          : "unavailable"
                    }`}
                    className={`rounded-md border border-dashed border-line px-2 py-2 text-center text-xs ${
                      slot.status === "booked" ? "bg-busy-soft text-busy" : "text-faint"
                    }`}
                  >
                    {formatMinutes(slot.start)}
                  </span>
                );
              }

              return (
                <button
                  key={slot.start}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => selectStart(slot.start)}
                  className={`rounded-md border px-2 py-2 text-center text-xs font-medium transition-colors ${
                    selected
                      ? "border-brand bg-brand text-on-brand"
                      : inSelection
                        ? "border-brand bg-brand/10 text-brand"
                        : "border-line bg-surface hover:border-brand hover:text-brand"
                  }`}
                >
                  {formatMinutes(slot.start)}
                </button>
              );
            })}
          </div>

          {dayBookings.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted hover:text-ink">
                {dayBookings.length} reservation{dayBookings.length === 1 ? "" : "s"} on this day
              </summary>
              <ul className="mt-2 space-y-1 text-xs text-muted">
                {dayBookings.map((booking) => (
                  <li key={booking.startMinute} className="flex justify-between gap-3">
                    <span>
                      {formatMinutes(booking.startMinute)} – {formatMinutes(booking.endMinute)}
                    </span>
                    <span className="truncate">{booking.label}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      {startMinute !== null && requireSignIn && !viewer && (
        <div className="flex flex-col gap-3 border-t border-line pt-4">
          <p className="text-sm leading-relaxed text-muted">
            Reservations need a University of Arizona NetID while the system is in internal use.
          </p>
          <Link
            href={`/signin?next=${encodeURIComponent(`/rooms/${room.slug}?date=${dateKey}`)}`}
            className="rounded-lg bg-brand px-4 py-2.5 text-center text-sm font-semibold text-on-brand hover:bg-brand-hover"
          >
            Sign in to reserve {formatMinutes(startMinute)}
          </Link>
        </div>
      )}

      {startMinute !== null && durations.length > 0 && !(requireSignIn && !viewer) && (
        <form action={formAction} className="flex flex-col gap-4 border-t border-line pt-4">
          <input type="hidden" name="roomSlug" value={room.slug} />
          <input type="hidden" name="dateKey" value={dateKey} />
          <input type="hidden" name="startMinute" value={startMinute} />

          <Field label="Length">
            <select
              name="durationMinutes"
              value={durationMinutes ?? durations[0]}
              onChange={(event) => setDuration(Number(event.target.value))}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            >
              {durations.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {formatDuration(minutes)} · until{" "}
                  {formatMinutes(startMinute + minutes)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="What is it for?" error={fieldError(state, "title")}>
            <input
              name="title"
              required
              maxLength={120}
              placeholder="Capstone team standup"
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="People" error={fieldError(state, "attendees")}>
              <input
                name="attendees"
                type="number"
                min={1}
                max={room.maxOccupancy ?? room.capacity}
                defaultValue={Math.min(4, room.capacity)}
                required
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-faint">
                Seats {room.capacity}
                {room.maxOccupancy ? `, holds ${room.maxOccupancy}` : ""}
              </p>
            </Field>
            <Field label="Department" error={fieldError(state, "department")}>
              <input
                name="department"
                defaultValue={viewer?.department ?? ""}
                placeholder="Optional"
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Your name" error={fieldError(state, "requesterName")}>
              <input
                name="requesterName"
                required
                defaultValue={viewer?.name ?? ""}
                readOnly={Boolean(viewer)}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm read-only:text-muted"
              />
            </Field>
            <Field
              label="Campus email"
              hint={viewer ? "From your NetID sign-in." : undefined}
              error={fieldError(state, "requesterEmail")}
            >
              <input
                name="requesterEmail"
                type="email"
                required
                defaultValue={viewer?.email ?? ""}
                readOnly={Boolean(viewer)}
                placeholder="netid@arizona.edu"
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm read-only:text-muted"
              />
            </Field>
          </div>

          <Field label="Anything staff should know?" error={fieldError(state, "purpose")}>
            <textarea
              name="purpose"
              rows={2}
              maxLength={1000}
              placeholder="Optional — room setup, catering, accessibility needs"
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            />
          </Field>

          {state.status === "error" && (
            <p role="alert" className="rounded-lg bg-busy-soft px-3 py-2 text-sm text-busy">
              {state.message}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-hover disabled:opacity-60"
          >
            {pending
              ? "Submitting…"
              : room.needsApproval
                ? "Request this space"
                : `Reserve ${formatMinutes(startMinute)} – ${formatMinutes(
                    startMinute + (durationMinutes ?? durations[0]),
                  )}`}
          </button>
          {room.needsApproval && (
            <p className="-mt-2 text-xs text-muted">
              Reservations here are reviewed by center staff before they are confirmed.
            </p>
          )}
        </form>
      )}
    </div>
  );
}

function fieldError(state: BookingFormState, field: string): string | undefined {
  return state.status === "error" ? state.fields?.[field] : undefined;
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-faint">{hint}</span>}
      {error && (
        <span role="alert" className="mt-1 block text-xs text-busy">
          {error}
        </span>
      )}
    </label>
  );
}

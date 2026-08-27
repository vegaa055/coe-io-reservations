"use client";

import { useActionState } from "react";

import { staffBookingAction, type SimpleState } from "@/app/actions";

const initial: SimpleState = { status: "idle" };

export function StaffActions({
  bookingId,
  pending: isPendingRequest,
}: {
  bookingId: string;
  pending: boolean;
}) {
  const [state, action, submitting] = useActionState(staffBookingAction, initial);

  if (state.status === "success") {
    return <p className="text-sm text-muted">{state.message}</p>;
  }

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="bookingId" value={bookingId} />
      <input
        name="note"
        placeholder="Note to the requester (optional)"
        className="min-w-52 flex-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm"
      />
      {isPendingRequest && (
        <button
          type="submit"
          name="action"
          value="confirm"
          disabled={submitting}
          className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-on-brand hover:bg-brand-hover disabled:opacity-60"
        >
          Approve
        </button>
      )}
      <button
        type="submit"
        name="action"
        value={isPendingRequest ? "deny" : "cancel"}
        disabled={submitting}
        className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-muted hover:border-line-strong hover:text-ink disabled:opacity-60"
      >
        {isPendingRequest ? "Deny" : "Cancel"}
      </button>
      {state.status === "error" && (
        <p role="alert" className="w-full text-sm text-busy">
          {state.message}
        </p>
      )}
    </form>
  );
}

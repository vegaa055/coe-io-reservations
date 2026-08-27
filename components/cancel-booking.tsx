"use client";

import { useActionState, useState } from "react";

import { cancelBookingAction, type SimpleState } from "@/app/actions";

const initial: SimpleState = { status: "idle" };

export function CancelBooking({ manageToken }: { manageToken: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState(cancelBookingAction, initial);

  if (state.status === "success") {
    return <p className="text-sm text-muted">{state.message}</p>;
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:border-line-strong hover:text-ink"
      >
        Cancel reservation
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="manageToken" value={manageToken} />
      <input
        name="reason"
        placeholder="Reason (optional)"
        className="min-w-48 flex-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Cancelling…" : "Confirm cancel"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="rounded-lg px-3 py-1.5 text-sm text-muted hover:text-ink"
      >
        Keep it
      </button>
      {state.status === "error" && (
        <p role="alert" className="w-full text-sm text-busy">
          {state.message}
        </p>
      )}
    </form>
  );
}

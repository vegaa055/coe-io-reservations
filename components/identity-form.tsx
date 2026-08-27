"use client";

import { useActionState } from "react";

import { setIdentityAction, type SimpleState } from "@/app/actions";

const initial: SimpleState = { status: "idle" };

export function IdentityForm() {
  const [state, action, pending] = useActionState(setIdentityAction, initial);

  return (
    <form action={action} className="flex flex-col gap-4 rounded-xl border border-line bg-raised p-6">
      <div>
        <h2 className="text-lg font-semibold">Who are you?</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Until campus sign-in is wired up, tell us your name and email and we will show the
          reservations booked under that address.
        </p>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Name</span>
        <input
          name="name"
          required
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Campus email</span>
        <input
          name="email"
          type="email"
          required
          placeholder="netid@arizona.edu"
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Department</span>
        <input
          name="department"
          placeholder="Optional"
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
        />
      </label>

      {state.status === "error" && (
        <p role="alert" className="rounded-lg bg-busy-soft px-3 py-2 text-sm text-busy">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-on-brand hover:bg-brand-hover disabled:opacity-60"
      >
        {pending ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}

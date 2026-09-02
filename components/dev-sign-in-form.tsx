"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

/**
 * The stand-in used until the campus app registration exists. auth.ts only
 * registers the provider behind it outside production, so this form cannot be
 * used on a deployment even if it were somehow rendered there.
 */
export function DevSignInForm({ next }: { next: string }) {
  const [pending, setPending] = useState(false);

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        const data = new FormData(event.currentTarget);
        await signIn("dev", {
          name: String(data.get("name") ?? ""),
          email: String(data.get("email") ?? ""),
          redirectTo: next,
        });
      }}
      className="flex flex-col gap-4 rounded-xl border border-dashed border-line-strong p-5"
    >
      <div>
        <p className="text-sm font-semibold">Development sign-in</p>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Stands in for NetID locally. Anyone can type any address, so this is never registered
          in production.
        </p>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Name</span>
        <input
          name="name"
          required
          minLength={2}
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Email</span>
        <input
          name="email"
          type="email"
          required
          placeholder="netid@arizona.edu"
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-on-brand hover:bg-brand-hover disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Continue"}
      </button>
    </form>
  );
}

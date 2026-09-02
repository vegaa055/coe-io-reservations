"use client";

import { useActionState } from "react";

import { removeStaffMemberAction, saveStaffMemberAction } from "@/app/admin/actions";
import { idleState } from "@/lib/admin-state";

import { ActionResult, Field, SubmitButton, fieldError, inputClass } from "./form-bits";

export type Person = {
  email: string;
  name: string | null;
  role: "ADMIN" | "STAFF";
  note: string | null;
  addedBy: string | null;
  /** Granted by ADMIN_EMAILS rather than a database row. */
  fromEnvironment: boolean;
};

const ROLE_BLURB: Record<Person["role"], string> = {
  ADMIN: "Everything staff can do, plus editing rooms and managing access.",
  STAFF: "Approve, deny and cancel reservations.",
};

export function PeopleManager({
  people,
  viewerEmail,
}: {
  people: Person[];
  viewerEmail: string;
}) {
  const [state, action, pending] = useActionState(saveStaffMemberAction, idleState);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Who has access</h2>
        {people.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line-strong p-6 text-center text-sm text-muted">
            Nobody yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {people.map((person) => (
              <PersonRow key={person.email} person={person} viewerEmail={viewerEmail} />
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-4 rounded-xl border border-line bg-raised p-5">
        <div>
          <h2 className="text-lg font-semibold">Grant access</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Entering an address that already has access updates its role instead of adding a
            duplicate.
          </p>
        </div>

        <form action={action} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Campus email" error={fieldError(state, "email")}>
              <input
                name="email"
                type="email"
                required
                placeholder="netid@arizona.edu"
                className={inputClass}
              />
            </Field>
            <Field label="Name" hint="Optional" error={fieldError(state, "name")}>
              <input name="name" className={inputClass} />
            </Field>
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">Role</legend>
            <div className="flex flex-col gap-2">
              {(["STAFF", "ADMIN"] as const).map((role) => (
                <label
                  key={role}
                  className="flex items-start gap-2 rounded-lg border border-line p-3 text-sm"
                >
                  <input
                    type="radio"
                    name="role"
                    value={role}
                    defaultChecked={role === "STAFF"}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block font-medium">
                      {role === "ADMIN" ? "Admin" : "Staff"}
                    </span>
                    <span className="block text-xs text-muted">{ROLE_BLURB[role]}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <Field label="Note" hint="Optional — why they have access." error={fieldError(state, "note")}>
            <input name="note" className={inputClass} />
          </Field>

          <ActionResult state={state} />
          <div>
            <SubmitButton pending={pending}>Grant access</SubmitButton>
          </div>
        </form>
      </section>
    </div>
  );
}

function PersonRow({ person, viewerEmail }: { person: Person; viewerEmail: string }) {
  const [state, action, pending] = useActionState(removeStaffMemberAction, idleState);
  const isSelf = person.email === viewerEmail;

  return (
    <li className="flex flex-col gap-2 rounded-xl border border-line bg-raised p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">
            {person.name || person.email}
            {isSelf && <span className="ml-2 text-xs font-normal text-muted">(you)</span>}
          </p>
          {person.name && <p className="truncate text-sm text-muted">{person.email}</p>}
          {person.note && <p className="mt-1 text-xs text-faint">{person.note}</p>}
          {person.addedBy && (
            <p className="mt-1 text-xs text-faint">Added by {person.addedBy}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              person.role === "ADMIN" ? "bg-brand text-on-brand" : "bg-sunken text-muted"
            }`}
          >
            {person.role === "ADMIN" ? "Admin" : "Staff"}
          </span>
          {person.fromEnvironment ? (
            <span
              className="text-xs text-faint"
              title="Granted by the ADMIN_EMAILS setting, so it cannot be removed here."
            >
              from settings
            </span>
          ) : (
            !isSelf && (
              <form action={action}>
                <input type="hidden" name="email" value={person.email} />
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-lg px-2.5 py-1 text-xs text-muted hover:text-busy disabled:opacity-60"
                >
                  Remove
                </button>
              </form>
            )
          )}
        </div>
      </div>
      {state.status === "error" && <ActionResult state={state} />}
    </li>
  );
}

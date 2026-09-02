"use client";

import type { AdminState } from "@/lib/admin-state";

export const inputClass =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm";

export function fieldError(state: AdminState, name: string): string | undefined {
  return state.status === "error" ? state.fields?.[name] : undefined;
}

export function Field({
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

/** Success and failure banner for an action's result. */
export function ActionResult({ state }: { state: AdminState }) {
  if (state.status === "idle") return null;
  const failed = state.status === "error";
  return (
    <p
      role={failed ? "alert" : "status"}
      className={`rounded-lg px-3 py-2 text-sm ${
        failed ? "bg-busy-soft text-busy" : "bg-free-soft text-free"
      }`}
    >
      {state.message}
    </p>
  );
}

export function SubmitButton({
  pending,
  children,
  variant = "primary",
}: {
  pending: boolean;
  children: React.ReactNode;
  variant?: "primary" | "quiet" | "danger";
}) {
  const styles = {
    primary: "bg-brand text-on-brand hover:bg-brand-hover",
    quiet: "border border-line hover:bg-sunken",
    danger: "bg-accent text-white hover:opacity-90",
  }[variant];
  return (
    <button
      type="submit"
      disabled={pending}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${styles}`}
    >
      {pending ? "Working…" : children}
    </button>
  );
}

/** 570 -> "09:30", for <input type="time">. */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function timeToMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export const WEEKDAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

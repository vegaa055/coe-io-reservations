/**
 * Shared result shape for the admin panel's server actions.
 *
 * This lives outside app/admin/actions.ts on purpose: a "use server" file may
 * only export async functions, so exporting the `idleState` constant from there
 * fails the whole module at runtime with "A 'use server' file can only export
 * async functions" — and every form on the page silently falls back to a native
 * submit that does nothing.
 */
export type AdminState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string; fields?: Record<string, string> };

export const idleState: AdminState = { status: "idle" };

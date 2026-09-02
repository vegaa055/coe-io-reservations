/**
 * Who you are, and what you may do.
 *
 *   Identity      -> auth.ts (NetID via Microsoft Entra ID, or the development
 *                    sign-in form when the campus app registration is not set
 *                    up yet).
 *   Authorisation -> the staff_members table, read here.
 *
 * The two are kept apart deliberately. Roles are keyed by email address, so
 * they survived the move off the old typed-in identity cookie without any data
 * change, and would survive another move to Shibboleth the same way.
 */
import { auth, REAL_SIGN_IN_CONFIGURED } from "@/auth";

import { prisma } from "./prisma";

export type Role = "ADMIN" | "STAFF";

export type Viewer = {
  name: string;
  email: string;
  department: string | null;
  /** null when this person has no granted access. */
  role: Role | null;
  /** Staff or admin — may act on reservations. */
  isStaff: boolean;
  /** Admin — may also edit rooms and grant access. */
  isAdmin: boolean;
};

/**
 * Bootstrap admins from the environment. These are always admins, whether or
 * not they have a row, so the panel that grants access can never lock everyone
 * out — including after a database reset.
 */
export function bootstrapAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isBootstrapAdmin(email: string): boolean {
  return bootstrapAdminEmails().includes(email.trim().toLowerCase());
}

/** The signed-in person, straight from the session. */
async function currentIdentity(): Promise<{ name: string; email: string } | null> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return null;
  return { name: session.user?.name || email, email: email.toLowerCase() };
}

/** Granted role for an email, with the environment bootstrap applied. */
export async function roleFor(email: string): Promise<Role | null> {
  const normalised = email.trim().toLowerCase();
  if (isBootstrapAdmin(normalised)) return "ADMIN";
  const member = await prisma.staffMember.findUnique({
    where: { email: normalised },
    select: { role: true },
  });
  return member?.role ?? null;
}

export async function getViewer(): Promise<Viewer | null> {
  const identity = await currentIdentity();
  if (!identity) return null;

  const role = await roleFor(identity.email);
  return {
    ...identity,
    // Not part of a NetID token; the booking form collects it when it matters.
    department: null,
    role,
    isStaff: role === "STAFF" || role === "ADMIN",
    isAdmin: role === "ADMIN",
  };
}

/** The viewer if they may act on reservations, otherwise null. */
export async function requireStaff(): Promise<Viewer | null> {
  const viewer = await getViewer();
  return viewer?.isStaff ? viewer : null;
}

/** The viewer if they may edit rooms and grant access, otherwise null. */
export async function requireAdmin(): Promise<Viewer | null> {
  const viewer = await getViewer();
  return viewer?.isAdmin ? viewer : null;
}

/**
 * The admin panel is refused in production unless a real identity provider is
 * configured. The old ALLOW_INSECURE_ADMIN escape hatch is gone: it existed
 * only because identity used to be a cookie anyone could type, and keeping it
 * would leave a way to turn that back on by accident.
 */
export function panelBlockedReason(): string | null {
  if (process.env.NODE_ENV !== "production") return null;
  if (REAL_SIGN_IN_CONFIGURED) return null;
  return "The admin panel is disabled because NetID sign-in is not configured on this deployment. Set the AUTH_MICROSOFT_ENTRA_ID_* variables.";
}

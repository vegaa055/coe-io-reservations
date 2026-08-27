/**
 * PROTOTYPE IDENTITY SHIM.
 *
 * There is no real authentication yet: the visitor types a name + campus email
 * and we keep it in a cookie so the booking form is pre-filled and "My
 * reservations" can find their bookings. It is a convenience, not a security
 * boundary — anyone can type any email.
 *
 * Replacing this with real auth should touch only this file plus the sign-in
 * route. For UA the path is NetID via Entra ID / Shibboleth SAML: add NextAuth
 * with a `microsoft-entra-id` (or SAML) provider, make `getViewer()` read the
 * session, and derive `isStaff` from a group claim instead of ADMIN_EMAILS.
 *
 * Until that lands, keep every staff-only page calling `requireStaff()` so the
 * swap is a single-file change.
 */
import { cookies } from "next/headers";

export const IDENTITY_COOKIE = "venue_identity";

export type Viewer = {
  name: string;
  email: string;
  department: string | null;
  isStaff: boolean;
};

function staffEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isStaffEmail(email: string): boolean {
  return staffEmails().includes(email.trim().toLowerCase());
}

export async function getViewer(): Promise<Viewer | null> {
  const raw = (await cookies()).get(IDENTITY_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as {
      name?: string;
      email?: string;
      department?: string;
    };
    if (!parsed.email || !parsed.name) return null;
    return {
      name: parsed.name,
      email: parsed.email,
      department: parsed.department || null,
      isStaff: isStaffEmail(parsed.email),
    };
  } catch {
    return null;
  }
}

/** True when the current visitor may see and act on every reservation. */
export async function requireStaff(): Promise<Viewer | null> {
  const viewer = await getViewer();
  return viewer?.isStaff ? viewer : null;
}

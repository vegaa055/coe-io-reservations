import { PeopleManager, type Person } from "@/components/admin/people-manager";
import { bootstrapAdminEmails, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  // The layout already refused non-admins; this is belt and braces so the page
  // is never renderable on its own.
  const admin = await requireAdmin();
  if (!admin) return null;

  const [rows, bootstrap] = await Promise.all([
    prisma.staffMember.findMany({ orderBy: [{ role: "asc" }, { email: "asc" }] }),
    Promise.resolve(bootstrapAdminEmails()),
  ]);

  const byEmail = new Map<string, Person>();

  // Environment admins first — they exist whether or not they have a row, and
  // a row must not make them look removable.
  for (const email of bootstrap) {
    byEmail.set(email, {
      email,
      name: null,
      role: "ADMIN",
      note: "Set in the ADMIN_EMAILS environment variable",
      addedBy: null,
      fromEnvironment: true,
    });
  }

  for (const row of rows) {
    const existing = byEmail.get(row.email);
    byEmail.set(row.email, {
      email: row.email,
      name: row.name,
      role: existing?.fromEnvironment ? "ADMIN" : row.role,
      note: existing?.fromEnvironment ? existing.note : row.note,
      addedBy: row.addedBy,
      fromEnvironment: Boolean(existing?.fromEnvironment),
    });
  }

  const people = [...byEmail.values()].sort((a, b) => {
    if (a.role !== b.role) return a.role === "ADMIN" ? -1 : 1;
    return a.email.localeCompare(b.email);
  });

  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-2xl text-sm leading-relaxed text-muted">
        Staff can approve, deny and cancel reservations. Admins can do that and also edit rooms,
        manage photos and change who has access.
      </p>
      <PeopleManager people={people} viewerEmail={admin.email} />
    </div>
  );
}

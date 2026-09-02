import type { Metadata } from "next";
import Link from "next/link";

import { getViewer, panelBlockedReason, requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Two separate refusals. The first is a deployment guard — the panel is not
  // safe to expose while identity is a cookie anyone can type. The second is
  // the ordinary role check.
  const blocked = panelBlockedReason();
  if (blocked) {
    return (
      <Shell>
        <h1 className="text-2xl font-semibold tracking-tight">Admin panel disabled</h1>
        <p className="mt-2 leading-relaxed text-muted">{blocked}</p>
      </Shell>
    );
  }

  const admin = await requireAdmin();
  if (!admin) {
    const viewer = await getViewer();
    return (
      <Shell>
        <h1 className="text-2xl font-semibold tracking-tight">Admins only</h1>
        <p className="mt-2 leading-relaxed text-muted">
          {viewer
            ? `${viewer.email} does not have admin access. An existing admin can grant it.`
            : "Tell us who you are first, then ask an admin for access."}
        </p>
        <Link
          href={viewer ? "/" : "/reservations"}
          className="mt-4 inline-block text-sm text-brand hover:underline"
        >
          {viewer ? "Back to rooms" : "Sign in"} →
        </Link>
      </Shell>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
          <p className="mt-0.5 text-sm text-muted">Signed in as {admin.email}</p>
        </div>
        <nav className="flex flex-wrap gap-1 text-sm">
          <AdminLink href="/admin/rooms">Rooms</AdminLink>
          <AdminLink href="/admin/people">People</AdminLink>
          <AdminLink href="/staff">Reservations</AdminLink>
        </nav>
      </header>
      {children}
    </div>
  );
}

function AdminLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md px-3 py-2 text-muted transition-colors hover:bg-sunken hover:text-ink"
    >
      {children}
    </Link>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-xl rounded-xl border border-line bg-raised p-8">{children}</div>;
}

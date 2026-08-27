import Link from "next/link";

import { clearIdentityAction } from "@/app/actions";
import { getViewer } from "@/lib/auth";

export async function SiteHeader() {
  const viewer = await getViewer();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3 sm:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-sm font-bold tracking-tight text-on-brand"
          >
            JE
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold">JAG-Ed Center</span>
            <span className="block text-xs text-muted">Room reservations</span>
          </span>
        </Link>

        <nav className="ml-auto flex items-center gap-1 text-sm">
          <Link
            href="/"
            className="rounded-md px-3 py-2 text-muted transition-colors hover:bg-sunken hover:text-ink"
          >
            Rooms
          </Link>
          <Link
            href="/reservations"
            className="rounded-md px-3 py-2 text-muted transition-colors hover:bg-sunken hover:text-ink"
          >
            My reservations
          </Link>
          {viewer?.isStaff && (
            <Link
              href="/staff"
              className="rounded-md px-3 py-2 text-muted transition-colors hover:bg-sunken hover:text-ink"
            >
              Staff
            </Link>
          )}
        </nav>

        {viewer && (
          <div className="flex items-center gap-2 rounded-full border border-line bg-raised py-1 pl-3 pr-1 text-xs">
            <span className="max-w-40 truncate text-muted" title={viewer.email}>
              {viewer.name}
            </span>
            <form action={clearIdentityAction}>
              <button
                type="submit"
                className="rounded-full px-2 py-1 text-faint transition-colors hover:bg-sunken hover:text-ink"
              >
                Not you?
              </button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}

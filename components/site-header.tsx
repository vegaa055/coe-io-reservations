import Link from "next/link";

import { signOut } from "@/auth";
import { getViewer } from "@/lib/auth";

export async function SiteHeader() {
  const viewer = await getViewer();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3 sm:px-8">
        <Link href="/" className="flex items-center gap-3">
          {/*
            A <picture> rather than next/image: the artwork draws its wordmark in
            Arizona Blue, which disappears on the dark background, so dark mode
            gets a reversed copy (npm run logo). next/image cannot swap sources
            on a media query, and there is nothing to optimise in an SVG anyway.
            width/height are the artwork's own viewBox, to reserve the space.
          */}
          <picture>
            <source
              srcSet="/coe-intelligence-operations-dark.svg"
              media="(prefers-color-scheme: dark)"
            />
            <img
              src="/coe-intelligence-operations.svg"
              alt="College of Engineering, Intelligence Operations"
              width={209}
              height={33}
              className="h-7 w-auto sm:h-8"
            />
          </picture>
          <span className="hidden text-xs text-muted sm:inline">Room reservations</span>
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
              Reservations
            </Link>
          )}
          {viewer?.isAdmin && (
            <Link
              href="/admin/rooms"
              className="rounded-md px-3 py-2 text-muted transition-colors hover:bg-sunken hover:text-ink"
            >
              Admin
            </Link>
          )}
        </nav>

        {viewer ? (
          <div className="flex items-center gap-2 rounded-full border border-line bg-raised py-1 pl-3 pr-1 text-xs">
            <span className="max-w-40 truncate text-muted" title={viewer.email}>
              {viewer.name}
            </span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button
                type="submit"
                className="rounded-full px-2 py-1 text-faint transition-colors hover:bg-sunken hover:text-ink"
              >
                Sign out
              </button>
            </form>
          </div>
        ) : (
          <Link
            href="/signin"
            className="rounded-full border border-line px-3 py-1.5 text-xs text-muted transition-colors hover:bg-sunken hover:text-ink"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DEV_SIGN_IN_ENABLED, REAL_SIGN_IN_CONFIGURED, signIn } from "@/auth";
import { DevSignInForm } from "@/components/dev-sign-in-form";
import { getViewer } from "@/lib/auth";
import { bookingRequiresSignIn } from "@/lib/bookings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  AccessDenied:
    "That account is not allowed to sign in here. Use your University of Arizona NetID account.",
  Configuration: "Sign-in is not configured correctly. Contact the JAG-Ed Center.",
  Verification: "That sign-in link has expired. Try again.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next;
  // Only ever redirect within this app — never to a URL supplied in the query.
  const next = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
  const error = Array.isArray(params.error) ? params.error[0] : params.error;

  const viewer = await getViewer();
  if (viewer) redirect(next);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-2 leading-relaxed text-muted">
          {REAL_SIGN_IN_CONFIGURED
            ? "Use your University of Arizona NetID."
            : "NetID sign-in is not configured on this environment yet."}
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-busy-soft px-3 py-2 text-sm text-busy">
          {ERRORS[error] ?? "Something went wrong signing in. Try again."}
        </p>
      )}

      {REAL_SIGN_IN_CONFIGURED && (
        <form
          action={async () => {
            "use server";
            await signIn("microsoft-entra-id", { redirectTo: next });
          }}
        >
          <button
            type="submit"
            className="w-full rounded-lg bg-brand px-4 py-3 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-hover"
          >
            Continue with NetID
          </button>
        </form>
      )}

      {DEV_SIGN_IN_ENABLED && <DevSignInForm next={next} />}

      <p className="text-sm leading-relaxed text-muted">
        {bookingRequiresSignIn()
          ? "Reservations need a NetID while the system is in internal use. Existing reservations can still be cancelled from their confirmation link without signing in."
          : "You do not need to sign in to make a reservation — the confirmation link lets you cancel it later. Signing in fills the form in for you and lists everything you have booked."}
      </p>
    </div>
  );
}

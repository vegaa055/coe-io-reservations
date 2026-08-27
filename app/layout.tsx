import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";
import { TZ } from "@/lib/time";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "JAG-Ed Center Reservations",
    template: "%s · JAG-Ed Center Reservations",
  },
  description:
    "Browse and reserve the meeting, conference and adaptable spaces in the JAG-Ed Center, College of Engineering.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-surface text-ink antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-brand focus:px-4 focus:py-2 focus:text-on-brand"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="mx-auto w-full max-w-6xl px-5 pb-24 pt-8 sm:px-8">
          {children}
        </main>
        <footer className="border-t border-line">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-5 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <p>College of Engineering · JAG-Ed Center</p>
            <p>
              All times shown in {TZ.replace("_", " ")} (Arizona does not observe daylight saving).
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}

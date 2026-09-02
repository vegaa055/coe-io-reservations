import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // There is a package-lock.json in the user profile directory, which makes
  // Turbopack guess the wrong workspace root. Pin it to this project.
  turbopack: {
    root: path.resolve(process.cwd()),
  },

  images: {
    /*
      How long an optimised image variant is reused before it is regenerated.
      This is also the window in which a replaced photo can still serve its old
      version, because the cache key is the URL and the URL does not change when
      a file is overwritten in place.

      One hour keeps caching worthwhile while making any staleness short and
      self-healing. Locally `npm run photos` clears the cache outright, so this
      only affects deployed environments. If a photo swap ever needs to be
      visible immediately in production, give the new file a different filename
      (and update prisma/seed.ts) — that changes the key and takes effect at
      once.
    */
    minimumCacheTTL: 3600,

    /*
      Uploaded photos live on Vercel Blob, which serves them from a
      per-store subdomain of blob.vercel-storage.com. next/image refuses
      remote hosts unless they are listed here.
    */
    remotePatterns: [{ protocol: "https", hostname: "**.public.blob.vercel-storage.com" }],
  },
};

export default nextConfig;

import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // There is a package-lock.json in the user profile directory, which makes
  // Turbopack guess the wrong workspace root. Pin it to this project.
  turbopack: {
    root: path.resolve(process.cwd()),
  },
};

export default nextConfig;

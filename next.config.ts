import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A second dev server (for example an isolated test run) needs its own build folder.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Loaded dynamically on the server only; keep them out of the bundle.
  serverExternalPackages: ["pg", "@electric-sql/pglite"],
};

export default nextConfig;

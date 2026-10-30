import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The repo root also has a lockfile (for the dev runner); pin the app root explicitly.
  turbopack: { root: path.join(__dirname) },
  agentRules: false,
};

export default nextConfig;

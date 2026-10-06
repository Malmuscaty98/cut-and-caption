import type { NextConfig } from "next";
import pkg from "./package.json";

// Build id = version + build/start time. It's inlined into the client bundle and sent by the
// server on every live-updates connection, so a tab left open across an update (running old code
// without knowing it) reloads itself.
const BUILD = `${pkg.version}-${Date.now().toString(36)}`;

const config: NextConfig = {
  // Remotion's renderer/bundler are Node-only; keep them out of the client & server bundles.
  serverExternalPackages: ["@remotion/renderer", "@remotion/bundler"],
  devIndicators: false,
  env: { NEXT_PUBLIC_QASS_BUILD: BUILD },
};

export default config;

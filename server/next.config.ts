import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lean, self-contained server bundle for the Cloud Run image.
  output: "standalone",
};

export default nextConfig;

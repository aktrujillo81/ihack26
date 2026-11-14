import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-hosted behind a Cloudflare Tunnel; don't advertise the framework.
  poweredByHeader: false,
};

export default nextConfig;

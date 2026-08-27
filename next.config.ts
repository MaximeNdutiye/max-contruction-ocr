import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow Cursor/network preview hosts to load HMR + `/_next/*` in development.
  // Without this, opening the Network URL (not localhost) fails the WebSocket handshake.
  allowedDevOrigins: ["127.248.211.78"],
};

export default nextConfig;

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The shared package ships compiled JS, but transpiling it here keeps source
  // maps working and avoids a stale-dist surprise during development.
  transpilePackages: ['@instant-mechanic/shared'],
  // Next 16 writes its own AGENTS.md and CLAUDE.md into the workspace on first
  // run. This repo already has its own conventions, and a second CLAUDE.md
  // inside apps/web would compete with them.
  agentRules: false,
  // typedRoutes is deliberately off: it generates types into .next/types during
  // a build, and this repo's gate runs `tsc --noEmit` without ever building.
};

export default nextConfig;

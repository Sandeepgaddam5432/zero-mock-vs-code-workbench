import type { NextConfig } from "next";

/**
 * `npm run build:static` sets STATIC_EXPORT=1 -> `output: 'export'` (pure static HTML/JS/CSS in out/).
 * The default `npm run build` keeps a standard production build so `next start` (preview runtime) works.
 * The application itself is 100% client-side + static JSON, so both outputs behave identically.
 */
const isStaticExport = process.env.STATIC_EXPORT === "1";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  ...(isStaticExport ? { output: "export" as const } : {}),
  basePath,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;

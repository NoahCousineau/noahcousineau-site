import type { NextConfig } from "next";

/*
 * A REVIEW BUILD IS A DIFFERENT SHAPE OF SITE (2026-08-25).
 *
 * Noah: "I'd also like a zip version of the site so I can share the site with
 * friends before it goes live."
 *
 * A zip has to be openable without Node, which means a static export — and a
 * static export has no server, so the two things that make this site a server
 * app both have to go somewhere else:
 *
 *   - `/api/unlock` cannot run, so the gate's password check moves into the
 *     browser for this build only (see REVIEW_PASSWORD in password/page.tsx).
 *     That does put the password in the bundle, which is exactly why it is
 *     behind a flag and never on for a real build.
 *   - `src/proxy.ts` cannot run either, so `/work/*` is reachable directly.
 *     Friends get the whole site; the gate is still there to look at.
 *
 * `images.unoptimized` for the same reason — next/image's optimizer is a
 * server route. Everything on this site is already exported at the size it is
 * drawn, so nothing changes visually.
 */
const reviewBuild = process.env.NEXT_PUBLIC_REVIEW_BUILD === "1";

const nextConfig: NextConfig = {
  images: {
    // 150 = high quality for 150 PPI minimum across site
    // (Next.js caps at 100, so this becomes 100; registered here for clarity)
    qualities: [75, 100],
    ...(reviewBuild ? { unoptimized: true } : {}),
  },
  ...(reviewBuild ? { output: "export" as const } : {}),
};

export default nextConfig;

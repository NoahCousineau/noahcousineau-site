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

/*
 * SECURITY HEADERS (2026-08-29, launch hardening).
 *
 * The site had none. These are the ones that are unambiguously right for a
 * portfolio — each closes a real class of attack and none of them can break
 * a page that only serves its own assets:
 *
 *   Strict-Transport-Security  after the first visit the browser refuses to
 *                              talk to this domain over plain HTTP at all, so
 *                              the gate cookie can never be sent in the clear
 *                              — the other half of the Secure flag in gate.ts.
 *   X-Content-Type-Options     stops a browser guessing that an image is
 *                              really a script.
 *   X-Frame-Options            no one can put noahcousineau.com in an iframe
 *                              and dress it up as their own.
 *   Referrer-Policy            outbound clicks (the résumé, the newsletter
 *                              form) carry the origin, not the full path — so
 *                              a gated /work URL is not leaked to third
 *                              parties.
 *   Permissions-Policy         the site asks for no camera, microphone or
 *                              location, so it says so.
 *
 * NOT a Content-Security-Policy, deliberately, and it is the one people
 * reach for first. Next injects inline bootstrap scripts, and GSAP writes
 * inline styles on nearly every animated element here; a correct policy needs
 * per-request nonces threaded through both, which is a real change to how the
 * app renders. Getting it wrong ships a site whose animations silently do not
 * run. It is worth doing after launch, with time to test, rather than the
 * night before.
 *
 * Applied to every route. `next start` sends them too, so they can be checked
 * locally with `curl -I`.
 */
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
];

const nextConfig: NextConfig = {
  /* A static export has no server to send headers, so this is skipped there;
     the review zip is opened from a file system anyway. */
  ...(reviewBuild
    ? {}
    : { headers: async () => [{ source: "/:path*", headers: securityHeaders }] }),
  images: {
    // 150 = high quality for 150 PPI minimum across site
    // (Next.js caps at 100, so this becomes 100; registered here for clarity)
    qualities: [75, 100],
    ...(reviewBuild ? { unoptimized: true } : {}),
  },
  ...(reviewBuild ? { output: "export" as const } : {}),
};

export default nextConfig;

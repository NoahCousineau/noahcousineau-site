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
  /* THE CASE STUDIES MOVED TO THE ROOT (2026-11-10). Noah: "in the url
     names, can we remove /work? Instead of noahcousineau.com/work/
     sprouts-farmers-market it should just be noahcousineau.com/
     sprouts-farmers-market".

     308 rather than 302 because the old URLs have been live and indexed —
     a permanent redirect passes the ranking on and tells a crawler to
     forget the old path, where a temporary one asks it to keep both.
     /work itself stays: it is still the index, and Projects in the nav
     still points at it.

     This is also why nothing had to be renamed in projects.json. The slug
     is unchanged; only the segment in front of it is gone. */
  async redirects() {
    return [
      { source: "/work/:slug", destination: "/:slug", permanent: true },
    ];
  },
  /* Don't advertise the framework on every response. It tells an attacker
     which CVE list to work through and buys the site nothing. */
  poweredByHeader: false,
  /* A static export has no server to send headers, so this is skipped there;
     the review zip is opened from a file system anyway. */
  ...(reviewBuild
    ? {}
    : { headers: async () => [{ source: "/:path*", headers: securityHeaders }] }),
  images: {
    // 150 = high quality for 150 PPI minimum across site
    // (Next.js caps at 100, so this becomes 100; registered here for clarity)
    // 85 is what the grids ask for now — see IMAGE_QUALITY in ProjectGroup.
    qualities: [75, 85, 100],
    /* A RUNG AT 2560 (2026-11-09). Next's default ladder steps 2048 -> 3840,
       and a full-width picture on a retina 1512 desktop needs about 2480 —
       so it took the 3840, nearly twice the pixels in each direction for
       nothing. Seven images on the Sprouts page were doing it. Purely
       additive: nothing is served smaller than it was, the ladder just has
       a step where this site actually lands.

       AVIF ahead of WebP for the same reason the reviewer gives for
       converting the source files — except the optimiser can do it per
       request, so the originals stay editable and every size benefits, not
       only the ones someone remembered to convert. Browsers that cannot
       read it still get WebP. */
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 2560, 3840],
    formats: ["image/avif", "image/webp"],
    ...(reviewBuild ? { unoptimized: true } : {}),
  },
  ...(reviewBuild ? { output: "export" as const } : {}),
};

export default nextConfig;

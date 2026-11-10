import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { GATE_ENABLED, readGate } from "@/lib/gate";

/**
 * Next.js 16 "Proxy" (formerly Middleware). Guards the projects area.
 * Runs before the request completes — no un-gated content ever renders.
 */
export function proxy(request: NextRequest) {
  /* Off by default now — see GATE_ENABLED in lib/gate. The matcher below is
     left alone deliberately: it is statically analysed at build time, so
     keeping it intact means re-enabling the gate is a one-line change here
     rather than a rebuild of how the proxy is wired. */
  if (!GATE_ENABLED) return NextResponse.next();
  const gate = readGate(request);
  if (!gate) {
    const url = new URL("/password", request.url);
    // remember where they were headed, for post-unlock redirect
    url.searchParams.set("from", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // gate /work and every project page; leave home/about password-free
  /* The case studies are at the root as of 2026-11-10, so there is no
     prefix left to match on. This gates /work plus every top-level path
     that is NOT one of the site's own pages or a static file — which is
     exactly the set of project slugs, without having to list them here and
     keep that list in step with projects.json.

     The `.+` matters: it makes the pattern need at least one character, so
     the home page is not caught by it. about, password, api and dev are
     named because they are real routes that must stay open; anything with
     a dot in it is a file (/favicon.ico, /opengraph-image.png, and the
     whole of /assets).

     Still inert while GATE_ENABLED is false — this keeps the switch honest
     rather than leaving it pointed at paths that no longer exist. */
  matcher: [
    "/work",
    "/((?!about|password|api|dev|_next|_vercel|assets|videos|images|fonts|.*\\.).+)",
  ],
};

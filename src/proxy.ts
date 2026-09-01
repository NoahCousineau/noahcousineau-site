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
  matcher: ["/work", "/work/:slug*"],
};

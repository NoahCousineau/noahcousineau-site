import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { readGate } from "@/lib/gate";

/**
 * Next.js 16 "Proxy" (formerly Middleware). Guards the projects area.
 * Runs before the request completes — no un-gated content ever renders.
 */
export function proxy(request: NextRequest) {
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

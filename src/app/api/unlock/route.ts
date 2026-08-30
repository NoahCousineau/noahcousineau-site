import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { issueGate } from "@/lib/gate";
import { clientKey, recordFailure, recordSuccess, retryAfter } from "@/lib/rateLimit";

/**
 * Compare in constant time regardless of length.
 *
 * timingSafeEqual throws on a length mismatch, and checking the length first
 * would leak it, so both sides are hashed to a fixed 32 bytes before the
 * comparison. The digest is not a security measure here — it is just a way to
 * make every candidate the same size.
 */
function sameSecret(candidate: string, actual: string): boolean {
  const a = createHash("sha256").update(candidate, "utf8").digest();
  const b = createHash("sha256").update(actual, "utf8").digest();
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const SITE_PASSWORD = process.env.SITE_PASSWORD;
  if (!SITE_PASSWORD) {
    return NextResponse.json(
      { ok: false, error: "Password not configured on server." },
      { status: 500 }
    );
  }

  const key = clientKey(request);
  const wait = retryAfter(key);
  if (wait > 0) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(wait) } }
    );
  }

  let pass = "";
  try {
    const body = await request.json();
    pass = String(body.pass || "");
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (!sameSecret(pass, SITE_PASSWORD)) {
    recordFailure(key);
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  recordSuccess(key);
  return issueGate(request);
}

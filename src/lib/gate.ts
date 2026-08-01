import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Cookie-based gate for the projects area.
 *
 * Security note: this is a portfolio gate, not a real authorization layer.
 * The cookie is signed (HMAC) so it can't be forged by editing the value,
 * and the proxy denies un-gateed requests server-side (no content flash).
 * It is still obscurity, not encryption — the image files in /public remain
 * reachable by direct URL. That's the normal, acceptable tradeoff for a
 * portfolio. See README "Password gate" for where the value lives.
 */

const COOKIE = "nc_gate";
const SECRET = process.env.GATE_SECRET || "dev-only-insecure-secret-change-me";

function sign(value: string): string {
  return createHmac("sha256", SECRET).update(value).digest("hex");
}

/** Returns the signed token if the cookie is present and valid. */
export function readGate(request: NextRequest): string | null {
  const raw = request.cookies.get(COOKIE)?.value;
  if (!raw) return null;
  const sep = raw.lastIndexOf(".");
  if (sep === -1) return null;
  const value = raw.slice(0, sep);
  const mac = raw.slice(sep + 1);
  const expected = sign(value);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return value;
}

/** Issue a signed cookie. */
export function issueGate(): NextResponse {
  const value = Date.now().toString();
  const token = `${value}.${sign(value)}`;
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}

export function clearGate(res: NextResponse) {
  res.cookies.set(COOKIE, "", { path: "/", maxAge: 0 });
}

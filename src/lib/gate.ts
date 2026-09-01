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

/*
 * THE GATE IS OFF (2026-09-01). Noah: "I no longer need a password for the
 * project pages. Please remove any password feature from the website,
 * everything should be easily accessible. Let's remember the password screen
 * in case I ever need it in the future."
 *
 * So this is one switch rather than a deletion. Every piece still exists and
 * still works — the hand, its animation, /password, /api/unlock, the cookie,
 * the rate limiter, the proxy — and flipping this back to `true` restores the
 * whole thing exactly as it was, with no code to write again.
 *
 * What reads it: src/proxy.ts stops redirecting, GateOverlay stops
 * intercepting project links, and robots.ts lets crawlers into /work, which
 * is the point of taking the gate off a portfolio.
 *
 * /password stays reachable on purpose. It is the screen Noah asked to keep,
 * it still accepts the password, and it is worth being able to look at.
 */
export const GATE_ENABLED = false;

const COOKIE = "nc_gate";
/** Readable by script, grants nothing — see issueGate. */
export const UI_HINT = "nc_gate_open";

/*
 * THE SIGNING SECRET, AND WHY PRODUCTION REFUSES THE FALLBACK (2026-08-29,
 * launch hardening).
 *
 * The fallback exists so `npm run dev` works out of the box on a fresh clone.
 * But it is a literal in a public repo: anyone who reads this file can mint a
 * cookie that `readGate` accepts, which turns the gate into a decoration. In
 * development that is a convenience; in production it is the whole control
 * failing open, silently, with no symptom anyone would notice.
 *
 * So production throws instead. A deploy that forgets GATE_SECRET fails at
 * the first gated request with a message naming the variable — loud, at
 * deploy time, rather than quiet forever.
 */
const DEV_SECRET = "dev-only-insecure-secret-change-me";
function secret(): string {
  const s = process.env.GATE_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "GATE_SECRET is not set. The password gate cannot sign cookies securely " +
        "without it — set it in the host's environment variables before deploying."
    );
  }
  return DEV_SECRET;
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("hex");
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
/** True when this request actually arrived over HTTPS — including behind a
 *  proxy or CDN, which terminates TLS and forwards the original scheme in
 *  `x-forwarded-proto`. Keyed on the CONNECTION rather than on NODE_ENV so
 *  that `next start` over http on a laptop still works (a Secure cookie is
 *  simply never stored there, and the gate would look broken), while a real
 *  deployment gets the flag without anyone having to remember to set it. */
function isHttps(request?: Pick<Request, "headers" | "url">): boolean {
  if (!request) return process.env.NODE_ENV === "production";
  const proto = request.headers.get("x-forwarded-proto");
  if (proto) return proto.split(",")[0].trim() === "https";
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return process.env.NODE_ENV === "production";
  }
}

export function issueGate(request?: Pick<Request, "headers" | "url">): NextResponse {
  const value = Date.now().toString();
  const token = `${value}.${sign(value)}`;
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    /* Without this the cookie is sent over plain HTTP too, so anyone sharing
       a network can read it off the wire and replay it. See isHttps above for
       why it follows the connection rather than NODE_ENV. */
    secure: isHttps(request),
    maxAge: 60 * 60 * 24 * 365,
  });
  /* A READABLE COMPANION, FOR THE INTERFACE ONLY (2026-08-30).
   *
   * The real cookie above is httpOnly, which is the whole point: script
   * cannot read it, so nothing on the page can leak it. But that also means
   * the page cannot tell whether the reader is already through the gate —
   * and it now needs to, because clicking a project no longer navigates to a
   * password screen, it raises the hand over wherever you are (see
   * GateOverlay). Something has to decide whether to raise it.
   *
   * So this carries no signature and grants nothing. Forging it lets you see
   * the hand you would have seen anyway; the actual check is still the signed
   * httpOnly cookie, verified in src/proxy.ts on the server, and a project
   * page will still refuse to render without it. This only answers "should
   * the interface bother asking?". */
  res.cookies.set(UI_HINT, "1", {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    secure: isHttps(request),
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}

export function clearGate(res: NextResponse) {
  res.cookies.set(UI_HINT, "", { path: "/", maxAge: 0 });
  res.cookies.set(COOKIE, "", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps(),
    maxAge: 0,
  });
}

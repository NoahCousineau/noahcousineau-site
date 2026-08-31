// A small in-memory attempt counter for the password gate.
//
// This is deliberately modest. On a serverless host the map lives per warm
// instance, so a determined attacker spread across instances gets more than
// MAX_ATTEMPTS tries — the point is not to be a wall, it is to make a script
// that walks the dictionary from one address stop being free.

/* 10 minutes/12 -> 5 minutes/30 (2026-08-30, launch day).
 *
 * The original numbers were picked against the attack and never against the
 * cost of a false positive, and on this site those are wildly unequal: what
 * is behind the gate is design work, while a locked-out visitor is a
 * prospective client who sees a password box quietly refusing a password
 * that is correct. Thirty tries is far past any human typo streak and still
 * makes a dictionary run pointless, and a five-minute window means a lockout
 * that does happen clears itself before anyone gives up. */
const WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 30;
const MAX_TRACKED = 5000; // bound memory against spoofed client addresses

/*
 * When no proxy header identifies the caller, every visitor lands in one
 * shared bucket — and then a dozen typos spread across a dozen people would
 * lock the gate for all of them. A real host (Vercel, Netlify, Cloudflare)
 * always sets x-forwarded-for, so this is mostly the bare `next start` case,
 * but getting it wrong means a site that refuses its own password on launch
 * day. The shared bucket therefore gets a much longer leash: still bounded,
 * far above anything a room full of guests would trip.
 */
const SHARED_KEY = "unknown";
const SHARED_MAX_ATTEMPTS = 240;

function capFor(key: string): number {
  return key === SHARED_KEY ? SHARED_MAX_ATTEMPTS : MAX_ATTEMPTS;
}

type Entry = { count: number; resetAt: number };
const attempts = new Map<string, Entry>();

/** First hop in x-forwarded-for, else the platform header, else a shared bucket. */
export function clientKey(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || SHARED_KEY;
}

function prune(now: number) {
  for (const [key, entry] of attempts) {
    if (entry.resetAt <= now) attempts.delete(key);
  }
  // Still oversized after pruning? Drop the oldest windows.
  if (attempts.size > MAX_TRACKED) {
    const byAge = [...attempts.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt);
    for (const [key] of byAge.slice(0, attempts.size - MAX_TRACKED)) {
      attempts.delete(key);
    }
  }
}

/** How many seconds the caller must wait, or 0 if it may try now. */
export function retryAfter(key: string): number {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) return 0;
  if (entry.count < capFor(key)) return 0;
  return Math.ceil((entry.resetAt - now) / 1000);
}

export function recordFailure(key: string): void {
  const now = Date.now();
  prune(now);
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  entry.count += 1;
}

/** A correct password clears the record, so a typo costs a guest nothing. */
export function recordSuccess(key: string): void {
  attempts.delete(key);
}

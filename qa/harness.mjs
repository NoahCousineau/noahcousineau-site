/** Shared QA harness: one Chrome, one place to change it. */
import { chromium } from "playwright-core";

/* Overridable, like every other check here (2026-08-31). It was pinned to
   3000, so running these against a production build on any other port sat
   silently retrying a dead address until it timed out — which looks exactly
   like a slow test rather than a misdirected one. */
export const BASE = process.env.QA_BASE || "http://localhost:3000";

/**
 * MAKE SURE BASE IS ACTUALLY THIS SITE (2026-09-04).
 *
 * The note above fixed a base that answered nothing. This one is the harder
 * version: a base that answers, but with something else. A stale server was
 * sitting on 3000 returning 200 for `/` and 404 for every project route, so
 * `qa:assets` walked six pages, found no <img> on any of them, and reported
 * "All 0 images decoded" — a pass, in the shape a total failure takes when
 * the count is the thing that broke. `qa:responsive` said the same pages were
 * clean at every breakpoint, which was true of the 404s it was measuring.
 *
 * So every check states a route it knows this site serves, and the run stops
 * if the answer is not a 200. A check pointed at the wrong server should look
 * like a failure, not a clean sheet.
 */
export async function assertServesSite(paths) {
  for (const path of paths) {
    let res;
    try {
      res = await fetch(`${BASE}${path}`, { redirect: "follow" });
    } catch (e) {
      console.error(`\nNothing answering at ${BASE}${path} — ${e.message}`);
      console.error("Start the server, or set QA_BASE to the right port.\n");
      process.exit(2);
    }
    if (!res.ok) {
      console.error(`\n${BASE}${path} returned ${res.status}.`);
      console.error(
        "Either QA_BASE points at the wrong server, or this route no longer " +
          "exists and the check is still asking for it.\n"
      );
      process.exit(2);
    }
  }
}

const EXECUTABLE =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

/** Runs `fn(browser)`, always closes the browser, exits non-zero on failures. */
export async function withBrowser(fn) {
  const browser = await chromium.launch({ executablePath: EXECUTABLE });
  try {
    const failures = await fn(browser);
    process.exit(failures ? 1 : 0);
  } finally {
    await browser.close();
  }
}

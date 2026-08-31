/** Shared QA harness: one Chrome, one place to change it. */
import { chromium } from "playwright-core";

/* Overridable, like every other check here (2026-08-31). It was pinned to
   3000, so running these against a production build on any other port sat
   silently retrying a dead address until it timed out — which looks exactly
   like a slow test rather than a misdirected one. */
export const BASE = process.env.QA_BASE || "http://localhost:3000";

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

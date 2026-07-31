/** Shared QA harness: one Chrome, one place to change it. */
import { chromium } from "playwright-core";

export const BASE = "http://localhost:3000";

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

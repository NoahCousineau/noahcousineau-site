/*
 * THE 404, AND THE CLOCK THAT MUST NOT COVER IT (2026-09-20)
 *
 * Noah: "On the 404 page, I would NOT like for the 'it's time to contact
 * Noah' page to come up over the 404 page if the user isn't interacting with
 * the site."
 *
 * The away screen has two triggers, idle and leaving, and both have to stay
 * down on this one page while still working everywhere else — so the same
 * two are run against the home page as a control. Without that, a check that
 * simply never sees the screen would pass on a site where it was broken.
 *
 * The idle wait is read from AwayOverlay's own source, so it keeps testing
 * the real threshold if that number moves again.
 */
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";

const B = process.env.QA_BASE || "http://localhost:3000";
const MISSING = "/this-page-does-not-exist-404-check";

{
  let res;
  try {
    res = await fetch(B + "/");
  } catch (e) {
    console.error(`\nNothing answering at ${B}/ — ${e.message}\n`);
    process.exit(2);
  }
  if (!res.ok) {
    console.error(`\n${B}/ returned ${res.status}. Is QA_BASE right?\n`);
    process.exit(2);
  }
  const missing = await fetch(B + MISSING);
  if (missing.status !== 404) {
    console.error(`\n${B}${MISSING} returned ${missing.status}, wanted 404.\n`);
    process.exit(2);
  }
}

const src = readFileSync(new URL("../src/components/AwayOverlay.tsx", import.meta.url), "utf8");
const num = (name) => {
  const m = src.match(new RegExp(`${name}\\s*=\\s*([\\d_]+)`));
  if (!m) {
    console.error(`\nCould not find ${name} in AwayOverlay.tsx.\n`);
    process.exit(2);
  }
  return Number(m[1].replace(/_/g, ""));
};
const IDLE_MS = num("IDLE_MS");
const LEAVE_DELAY_MS = num("LEAVE_DELAY_MS");

const browser = await chromium.launch({
  executablePath:
    process.env.QA_CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
let fails = 0;
const report = (ok, label, detail) => {
  if (!ok) fails++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label.padEnd(44)} ${detail}`);
};

const away = (page) =>
  page.evaluate(() => {
    const el = document.querySelector("[data-away-screen]");
    if (!el) return false;
    const cs = getComputedStyle(el);
    return cs.visibility === "visible" && parseFloat(cs.opacity) > 0.5;
  });

async function open(path) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(B + path, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page
    .waitForFunction(() => !document.querySelector("[data-page-loader]"), null, { timeout: 40000 })
    .catch(() => {});
  return { ctx, page, errs };
}

// What the page itself says.
{
  const { ctx, page, errs } = await open(MISSING);
  const seen = await page.evaluate(() => {
    const texts = [...document.querySelectorAll("[data-not-found] svg text")]
      .map((t) => t.textContent.trim())
      .filter(Boolean);
    const link = document.querySelector("[data-return-home]");
    const watch = document.querySelector("[data-not-found] img");
    return {
      arcs: [...new Set(texts)],
      link: link && { text: link.textContent.trim(), href: link.getAttribute("href") },
      hasWatch: !!watch,
      numeral: /(^|\s)404(\s|$)/.test(
        [...document.querySelectorAll("[data-not-found] p")].map((p) => p.textContent).join(" ")
      ),
    };
  });
  const top = seen.arcs.some((t) => /oops!\s*this is the/i.test(t));
  const bottom = seen.arcs.some((t) => /404 page!/i.test(t));
  report(
    top && bottom && !errs.length,
    "both phrases are arced on the clock",
    `arcs=${JSON.stringify(seen.arcs)}`
  );
  report(
    seen.link?.href === "/" && /return to safety/i.test(seen.link.text),
    "\"return to safety\" links home",
    `link=${JSON.stringify(seen.link)}`
  );
  report(seen.hasWatch && !seen.numeral, "the watch is there, the old numeral is not", `watch=${seen.hasWatch}`);

  // The shimmer has to be running, not just present.
  const moved = await page.evaluate(async () => {
    const glyph = document.querySelector("[data-not-found] g[aria-hidden] text");
    if (!glyph) return "no shimmer layer";
    const seen = new Set();
    for (let i = 0; i < 60; i++) {
      seen.add(glyph.getAttribute("transform"));
      await new Promise((r) => setTimeout(r, 200));
      if (seen.size > 1) return true;
    }
    return false;
  });
  report(moved === true, "the shimmer animates", `distinct transforms seen=${moved}`);

  // And clicking it really goes home.
  await page.click("[data-return-home]");
  // next/link navigates on the client, so there may be no load event to wait
  // for — watch the URL itself.
  await page
    .waitForFunction(() => location.pathname === "/", null, { timeout: 15000 })
    .catch(() => {});
  const path = new URL(page.url()).pathname;
  report(path === "/", "clicking it lands on the homepage", `url path=${path}`);
  await ctx.close();
}

/* The link sits below the clock, and the arcs reach past the disc — so the
   two can collide without anything looking wrong in the source. They did:
   measured at 1280x860, "RETURN TO SAFETY" overlapped the lowest letter of
   "404 PAGE!" by 5px before the arc's overhang was reserved. */
for (const [w, h] of [[1280, 860], [1512, 982], [390, 844]]) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    deviceScaleFactor: 2,
    isMobile: w < 768,
    hasTouch: w < 768,
  });
  const page = await ctx.newPage();
  await page.goto(B + MISSING, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page
    .waitForFunction(() => !document.querySelector("[data-page-loader]"), null, { timeout: 40000 })
    .catch(() => {});
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
  await page.waitForTimeout(800);
  const m = await page.evaluate(() => {
    const glyphs = [...document.querySelectorAll("[data-not-found] g[aria-hidden] text")].map((g) =>
      g.getBoundingClientRect()
    );
    const link = document.querySelector("[data-return-home]").getBoundingClientRect();
    return {
      gap: Math.round(link.top - Math.max(...glyphs.map((g) => g.bottom))),
      offTop: Math.round(Math.min(...glyphs.map((g) => g.top))),
      offBottom: Math.round(link.bottom - innerHeight),
    };
  });
  report(
    m.gap >= 8 && m.offTop >= 0 && m.offBottom <= 0,
    `${w}x${h}: link clears the arc, lockup on screen`,
    `gap=${m.gap}px topmost letter y=${m.offTop} link bottom vs screen=${m.offBottom}`
  );
  await ctx.close();
}

// The away screen: down here, alive elsewhere.
for (const [path, want] of [[MISSING, false], ["/", true]]) {
  const label = path === "/" ? "home (control)" : "404";
  const { ctx, page, errs } = await open(path);

  // Leaving: blur the window and wait out the debounce.
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.waitForTimeout(LEAVE_DELAY_MS + 2500);
  const onLeave = await away(page);
  report(onLeave === want, `${label}: away screen on leaving`, `shown=${onLeave} (want ${want})`);

  // Idle: touch nothing at all until the threshold is well past.
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.mouse.move(640, 430);
  await page.waitForTimeout(IDLE_MS + 6000);
  const onIdle = await away(page);
  report(
    onIdle === want && !errs.length,
    `${label}: away screen when idle ${(IDLE_MS / 1000) | 0}s+`,
    `shown=${onIdle} (want ${want})`
  );
  await ctx.close();
}

await browser.close();
console.log(fails ? `\n  ${fails} FAILED` : "\n  the 404 wears the clock, and nothing covers it");
process.exit(fails ? 1 : 0);

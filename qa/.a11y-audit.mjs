/* What a screen reader would actually meet: the DOM, not the HTML source.
   The RSC payload duplicates every string inside <script>, which inflates a
   source-level grep and is invisible to assistive tech. */
import { chromium } from "playwright-core";
import fs from "node:fs";
const BASE = process.env.QA_BASE || "https://noahcousineau.com";
const PW = (fs.readFileSync(".env.local", "utf8").match(/SITE_PASSWORD=(.*)/) || [])[1]?.trim();
const b = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const ctx = await b.newContext({ viewport: { width: 1512, height: 950 } });
const p = await ctx.newPage();
await p.goto(`${BASE}/password`, { waitUntil: "domcontentloaded", timeout: 90000 }); await p.waitForTimeout(500);
const i = await p.$("input"); if (i && PW) { await i.fill(PW); await i.press("Enter"); await p.waitForTimeout(1400); }

for (const path of ["/", "/about", "/work", "/sprouts-farmers-market"]) {
  await p.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.waitForFunction(() => !document.querySelector("[data-page-loader]"), null, { timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(2500);
  for (let k = 0; k < 20; k++) { await p.mouse.wheel(0, 900); await p.waitForTimeout(60); }
  await p.waitForTimeout(800);
  const r = await p.evaluate(() => {
    const hiddenFromAT = (el) => {
      for (let n = el; n; n = n.parentElement) {
        if (n.getAttribute && (n.getAttribute("aria-hidden") === "true" || n.hasAttribute("aria-hidden"))) return true;
        const cs = getComputedStyle(n);
        if (cs.display === "none" || cs.visibility === "hidden") return true;
      }
      return false;
    };
    const imgs = [...document.querySelectorAll("img")];
    const noAlt = imgs.filter(im => !im.hasAttribute("alt"));
    const emptyAlt = imgs.filter(im => im.getAttribute("alt") === "");
    const realAlt = imgs.filter(im => (im.getAttribute("alt") || "").trim().length > 0);
    // text a screen reader would hear twice
    const seen = new Map();
    for (const el of document.querySelectorAll("h1,h2,h3,p,span,li,a")) {
      if (el.children.length) continue;
      const t = (el.textContent || "").trim();
      if (t.length < 12) continue;
      if (hiddenFromAT(el)) continue;
      seen.set(t, (seen.get(t) || 0) + 1);
    }
    const dupes = [...seen.entries()].filter(([, n]) => n > 1).sort((a, z) => z[1] - a[1]).slice(0, 6);
    // focusables with no visible focus style
    const focusable = [...document.querySelectorAll("a[href],button,input,[tabindex]:not([tabindex='-1'])")]
      .filter(e => !hiddenFromAT(e));
    return {
      title: document.title,
      imgs: imgs.length, noAlt: noAlt.length, emptyAlt: emptyAlt.length, realAlt: realAlt.length,
      emptySample: emptyAlt.slice(0, 3).map(im => (im.currentSrc || im.src).split("/").pop().slice(0, 48)),
      dupes, focusable: focusable.length,
      h1: [...document.querySelectorAll("h1")].map(h => h.textContent.trim().slice(0, 40)),
      canonical: document.querySelector('link[rel="canonical"]')?.href || null,
      ogImage: document.querySelector('meta[property="og:image"]')?.content || null,
      desc: document.querySelector('meta[name="description"]')?.content || null,
    };
  });
  console.log(`\n  ${path}`);
  console.log(`     title: ${JSON.stringify(r.title)}`);
  console.log(`     images: ${r.imgs} — ${r.realAlt} described, ${r.emptyAlt} decorative, ${r.noAlt} with no alt attribute`);
  if (r.emptySample.length) console.log(`       e.g. ${r.emptySample.join(", ")}`);
  console.log(`     duplicate audible text: ${r.dupes.length ? r.dupes.map(([t, n]) => `${n}x ${JSON.stringify(t.slice(0, 40))}`).join("; ") : "none"}`);
  console.log(`     h1: ${JSON.stringify(r.h1)}`);
  console.log(`     canonical: ${r.canonical}`);
  console.log(`     og:image: ${r.ogImage}`);
  console.log(`     description: ${JSON.stringify((r.desc || "").slice(-60))}`);
}
await b.close();

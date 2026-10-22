import { chromium } from "playwright-core";
import fs from "node:fs";
const BASE = process.env.QA_BASE || "http://localhost:3000";
const PW = (fs.readFileSync(".env.local", "utf8").match(/SITE_PASSWORD=(.*)/) || [])[1]?.trim();
let bad = 0;
const ok = (c, w, d = "") => { if (!c) bad++; console.log(`  ${c ? "ok  " : "FAIL"} ${w.padEnd(54)} ${d}`); };
const b = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const ctx = await b.newContext({ viewport: { width: 1512, height: 950 } });
const p = await ctx.newPage();
const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 80)));
await p.goto(`${BASE}/password`, { waitUntil: "domcontentloaded", timeout: 90000 }); await p.waitForTimeout(500);
const i = await p.$("input"); if (i && PW) { await i.fill(PW); await i.press("Enter"); await p.waitForTimeout(1400); }

/* the new copy */
for (const [slug, must] of [
  ["sprouts-farmers-market", ["forager spirit", "from a chore to an adventure"]],
  ["corita-art-center", ["Honor Sister Kent", "Best Brochure", "lighter than you think"]],
  ["cultural-olympiad-poster", ["Canal Saint-Martin", "cheap souvenir"]],
  ["more-work", ["300-page book"]],
]) {
  await p.goto(`${BASE}/work/${slug}`, { waitUntil: "domcontentloaded", timeout: 90000 }); await p.waitForTimeout(1800);
  const text = await p.evaluate(() => document.body.innerText);
  for (const phrase of must) ok(text.includes(phrase), `${slug}: "${phrase.slice(0, 26)}…"`);
  if (slug === "corita-art-center") {
    const href = await p.evaluate(() => [...document.querySelectorAll("a")]
      .filter(a => a.textContent.trim() === "here").map(a => a.href)[0] || null);
    ok(!!href && href.includes("printmag.com"), "the PRINT awards link still works", href || "missing");
    ok(!/Carita/.test(text), "spelled Corita, not Carita");
  }
}

/* the More Work links scroll to their sections */
await p.goto(`${BASE}/work/more-work`, { waitUntil: "domcontentloaded", timeout: 90000 }); await p.waitForTimeout(2000);
const links = await p.evaluate(() => [...document.querySelectorAll('a[href^="#"]')]
  .map(a => ({ text: a.textContent.trim(), id: a.getAttribute("href").slice(1) })));
ok(links.length === 6, "six project links in the copy", links.map(l => l.text).join(", "));
const anchorsExist = await p.evaluate((ids) => ids.every(id => !!document.getElementById(id)), links.map(l => l.id));
ok(anchorsExist, "every link has a section to land on", links.map(l => "#" + l.id).join(" "));
for (const l of links) {
  /* NO RESET BETWEEN CLICKS. `window.scrollTo` is overridden by Lenis, so
     a reset that looks like it worked leaves its internal target somewhere
     else and the next jump starts from a confused state — one link landed
     884px short purely because of that. Clicking each in turn from wherever
     the page happens to be is both simpler and the harsher test. */
  await p.evaluate((id) => document.querySelector(`a[href="#${id}"]`).click(), l.id);
  await p.waitForTimeout(2600);
  const where = await p.evaluate((id) => {
    const mark = document.getElementById(id);
    const section = mark.nextElementSibling;
    const bar = section.querySelector(".proj-bar");
    const name = bar?.querySelector(".proj-bar-section")?.textContent.trim();
    return { barTop: Math.round(bar.getBoundingClientRect().top), name, y: Math.round(scrollY) };
  }, l.id);
  ok(Math.abs(where.barTop) <= 4 && where.y > 100, `"${l.text}" lands on its section`,
     `bar at y=${where.barTop}, showing "${where.name?.slice(0, 30)}"`);
}
ok(errs.length === 0, "no page errors", errs[0] || "");
await b.close();
console.log(bad ? `\n  ${bad} FAILED\n` : "\n  the copy reads and the links land\n");
process.exit(bad ? 1 : 0);

/*
 * THE PROJECT PAGE'S STICKY HEADER BAR (2026-10-19).
 *
 * Noah, with a marked-up screenshot: "I want the header to be just a bit
 * larger, roughly to where the red line is. Where the orange box is, I want
 * the section name to move there, flush right. Where the section title was,
 * I want the page title to go here... Where the green box is, I want the
 * corresponding page symbol... On mobile, I don't want the page name...
 * section name to be center aligned on the page... page icon on the left
 * side of the page, just to the right of the C logo. For both the mobile
 * and desktop, I would like the content to be aligned on a horizontal
 * centerline."
 *
 * The figures below are measured off that screenshot: the red line at y=83
 * of a 2000px-wide capture is 80 artboard units, and the green box at
 * x=110..150 is units 106..144.
 */
import { chromium } from "playwright-core";
import fs from "node:fs";
import { execSync } from "node:child_process";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = process.env.QA_BASE || "http://localhost:3000";
const OUT = process.env.OUT || ".";
const PW = (fs.readFileSync(".env.local", "utf8").match(/SITE_PASSWORD=(.*)/) || [])[1]?.trim();
if (BASE.includes("localhost")) {
  const id = fs.readFileSync(".next/BUILD_ID", "utf8").trim();
  if (!execSync(`curl -s ${BASE}/`, { encoding: "utf8" }).includes(id)) {
    console.error(`\n  ${BASE} is not serving build ${id} — refusing to measure it\n`); process.exit(2);
  }
}
let bad = 0;
const ok = (c, w, d = "") => { if (!c) bad++; console.log(`  ${c ? "ok  " : "FAIL"} ${w.padEnd(52)} ${d}`); };
const b = await chromium.launch({ executablePath: CHROME });

for (const [w, h, tag] of [[1902, 950, "desktop"], [390, 844, "phone"]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: w < 768, hasTouch: w < 768 });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/password`, { waitUntil: "domcontentloaded", timeout: 90000 }); await p.waitForTimeout(500);
  const i = await p.$("input"); if (i && PW) { await i.fill(PW); await i.press("Enter"); await p.waitForTimeout(1400); }
  await p.goto(`${BASE}/work/corita-art-center`, { waitUntil: "domcontentloaded", timeout: 90000 }); await p.waitForTimeout(2000);
  /* Stop the moment a header pins. Scrolling to the bottom first finds
     nothing: the phone page is 9534 tall and its four headers pin between
     2042 and 6807, so a long flick lands past all of them. */
  const isPinned = () => p.evaluate(() => [...document.querySelectorAll(".sticky.top-0")]
    .some(e => { const r = e.getBoundingClientRect(); return r.top > -3 && r.top < 5 && r.height > 10; }));
  for (let k = 0; k < 200 && !(await isPinned()); k++) { await p.mouse.wheel(0, 400); await p.waitForTimeout(50); }
  await p.waitForTimeout(600);
  const m = await p.evaluate(() => {
    const all = [...document.querySelectorAll(".sticky.top-0")].map(e => ({ e, r: e.getBoundingClientRect() }))
      .filter(o => o.r.top > -3 && o.r.top < 5 && o.r.height > 10);
    const hdr = all[all.length - 1]; if (!hdr) return null;
    const q = (sel) => { const e = hdr.e.querySelector(sel); if (!e) return null;
      const r = e.getBoundingClientRect();
      return { left: Math.round(r.left), right: Math.round(r.right), mid: Math.round(r.top + r.height / 2),
               shown: getComputedStyle(e).display !== "none", text: (e.textContent || "").trim() }; };
    const c = document.querySelector("a.fixed");
    const cr = c && c.getBoundingClientRect();
    return { vw: innerWidth, unit: innerWidth / 1920,
             bar: { bottom: Math.round(hdr.r.bottom), units: +(hdr.r.height / (innerWidth / 1920)).toFixed(1) },
             rule: (() => { const r = hdr.e.lastElementChild.getBoundingClientRect();
                            return { left: Math.round(r.left), right: Math.round(r.right) }; })(),
             chrome: cr ? { right: Math.round(cr.right), mid: Math.round(cr.top + cr.height / 2) } : null,
             symbol: q(".proj-bar-symbol"), title: q(".proj-bar-title"), section: q(".proj-bar-section") };
  });
  console.log(`\n  ${tag} ${w}px`);
  if (!m) { ok(false, "a section header pins to the top"); await ctx.close(); continue; }
  const u = m.unit;
  ok(Math.abs(m.rule.left) <= 1 && Math.abs(m.rule.right - m.vw) <= 1, "the rule spans the whole window", `${m.rule.left}..${m.rule.right} of ${m.vw}`);
  ok(!!m.symbol, "the page's own symbol is in the bar", m.symbol ? `x ${m.symbol.left}..${m.symbol.right}` : "missing");
  ok(!!m.section && m.section.shown, "the section name is in the bar", m.section?.text);

  const mids = [m.symbol, m.section].concat(tag === "desktop" ? [m.title] : []).filter(v => v && v.shown).map(v => v.mid);
  mids.push(m.chrome.mid);
  ok(Math.max(...mids) - Math.min(...mids) <= 2, "everything shares one centreline, the chrome included", mids.join(", "));

  if (tag === "desktop") {
    ok(Math.abs(m.bar.units - 80) <= 1.5, "the bar reaches the line Noah drew (80 units)", `${m.bar.units} units`);
    ok(m.title.shown && /CORITA/i.test(m.title.text), "the page title is there", m.title.text);
    ok(Math.abs(m.title.left - 178 * u) <= 2, "the page title is flush left at the grid margin", `x=${m.title.left}, margin ${Math.round(178 * u)}`);
    ok(Math.abs(m.section.right - (m.vw - 178 * u)) <= 2, "the section name is flush right", `ends ${m.section.right}, margin ${Math.round(m.vw - 178 * u)}`);
    ok(Math.abs(m.symbol.left - 106 * u) <= 3, "the symbol sits between the C mark and the title", `x=${m.symbol.left}, wanted ${Math.round(106 * u)}`);
    ok(m.symbol.left > m.chrome.right && m.symbol.right < m.title.left, "and clears both of them", `C ends ${m.chrome.right}, title starts ${m.title.left}`);
  } else {
    ok(!m.title.shown, "no page title — there is no room for it", m.title.text);
    const centre = Math.round((m.section.left + m.section.right) / 2);
    ok(Math.abs(centre - m.vw / 2) <= 2, "the section name is centred on the page", `centre ${centre} of ${m.vw}`);
    ok(m.symbol.left > m.chrome.right && m.symbol.left - m.chrome.right < 20, "the symbol is just right of the C mark", `C ends ${m.chrome.right}, symbol at ${m.symbol.left}`);
  }
  await p.screenshot({ path: `${OUT}/bar-${tag}.png`, clip: { x: 0, y: 0, width: w, height: Math.min(150, m.bar.bottom + 50) } });
  await ctx.close();
}
await b.close();
console.log(bad ? `\n  ${bad} FAILED\n` : "\n  the header bar reads the same on both tiers\n");
process.exit(bad ? 1 : 0);

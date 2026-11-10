/* Titles, descriptions, canonicals and share cards, read off the rendered
   <head> rather than the source. */
import { chromium } from "playwright-core";
import fs from "node:fs";
const BASE = process.env.QA_BASE || "http://localhost:3000";
const PW = (fs.readFileSync(".env.local", "utf8").match(/SITE_PASSWORD=(.*)/) || [])[1]?.trim();
let bad = 0;
const ok = (c, w, d = "") => { if (!c) bad++; console.log(`  ${c ? "ok  " : "FAIL"} ${w.padEnd(46)} ${d}`); };
const b = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const ctx = await b.newContext({ viewport: { width: 1512, height: 950 } });
const p = await ctx.newPage();
await p.goto(`${BASE}/password`, { waitUntil: "domcontentloaded", timeout: 90000 }); await p.waitForTimeout(500);
const i = await p.$("input"); if (i && PW) { await i.fill(PW); await i.press("Enter"); await p.waitForTimeout(1400); }

const pages = [
  ["/", "Noah Cousineau", "https://noahcousineau.com/"],
  ["/about", "About — Noah Cousineau", "https://noahcousineau.com/about"],
  ["/work", "Work — Noah Cousineau", "https://noahcousineau.com/work"],
  ["/sprouts-farmers-market", "Sprouts Farmers Market — Noah Cousineau", "https://noahcousineau.com/sprouts-farmers-market"],
  ["/socal-earth", "SoCal Earth — Noah Cousineau", "https://noahcousineau.com/socal-earth"],
  ["/more-work", "More Work — Noah Cousineau", "https://noahcousineau.com/more-work"],
];
const cards = new Set();
for (const [path, title, canon] of pages) {
  await p.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.waitForTimeout(700);
  const m = await p.evaluate(() => ({
    title: document.title,
    desc: document.querySelector('meta[name="description"]')?.content || "",
    canonical: document.querySelector('link[rel="canonical"]')?.href || null,
    og: document.querySelector('meta[property="og:image"]')?.content || null,
  }));
  ok(m.title === title, `${path}: title`, JSON.stringify(m.title));
  ok(m.canonical === canon.replace(/\/$/, path === "/" ? "/" : ""), `${path}: canonical`, m.canonical || "none");
  ok(!!m.canonical && !/www\./.test(m.canonical), `${path}: canonical is the apex`, m.canonical || "");
  ok(!!m.og && !/www\./.test(m.og), `${path}: share image on the apex`, (m.og || "").slice(0, 70));
  ok(m.desc.length > 40 && !/\b\w{1,3}$/.test(m.desc.replace(/[.…]$/, "")) , `${path}: description ends on a word`, JSON.stringify(m.desc.slice(-46)));
  if (m.og && path !== "/" && path !== "/about" && path !== "/work") cards.add(m.og.split("?")[0]);
}
/* Only the PROJECT pages were ever going to differ — home, about and the
   work index share the site card by design, and counting those made a
   correct result look like a failure. */
ok(cards.size === 3, "each project page has its own share image", `${cards.size} distinct cards across 3 project pages`);
await b.close();
console.log(bad ? `\n  ${bad} FAILED\n` : "\n  titles, canonicals and cards all read correctly\n");
process.exit(bad ? 1 : 0);

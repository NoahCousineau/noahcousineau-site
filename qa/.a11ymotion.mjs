import { chromium } from "playwright-core";
import fs from "node:fs";
const PW = (fs.readFileSync(".env.local","utf8").match(/SITE_PASSWORD=(.*)/)||[])[1]?.trim();
const b = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const ctx = await b.newContext({ viewport:{width:1512,height:950}, deviceScaleFactor:2, reducedMotion:"reduce" });
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", e => errs.push(String(e).slice(0,100)));
await p.goto("http://localhost:3000/password",{waitUntil:"domcontentloaded"}); await p.waitForTimeout(500);
const i = await p.$("input"); if (i && PW) { await i.fill(PW); await i.press("Enter"); await p.waitForTimeout(1500); }
console.log("=== prefers-reduced-motion: reduce ===");
for (const u of ["/","/about","/work","/work/sprouts-farmers-market"]) {
  await p.goto("http://localhost:3000"+u,{waitUntil:"domcontentloaded"});
  await p.waitForFunction(()=>!document.querySelector("[data-page-loader]"),null,{timeout:60000}).catch(()=>{});
  await p.waitForTimeout(2500);
  // content that is present in the DOM but invisible = an animation that never ran
  const hidden = await p.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll("h1,h2,h3,p,a,img,section,div")) {
      const t = (el.textContent||"").trim();
      if (!t && el.tagName !== "IMG") continue;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      const s = getComputedStyle(el);
      if (parseFloat(s.opacity) < 0.05 || s.visibility === "hidden")
        out.push(el.tagName + " " + (t.slice(0,42) || el.getAttribute("src")?.slice(-32) || ""));
    }
    return [...new Set(out)];
  });
  const scrollable = await p.evaluate(() => document.documentElement.scrollHeight > window.innerHeight + 50);
  console.log(`  ${u.padEnd(32)} invisible-but-present: ${hidden.length}, page scrollable: ${scrollable}`);
  for (const h of hidden.slice(0,4)) console.log("        ", h);
}
console.log("  page errors:", errs.length, errs.slice(0,3));
await b.close();

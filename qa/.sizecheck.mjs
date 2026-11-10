/* Images only, one page, same server — so the number means something. */
import { chromium } from "playwright-core";
import fs from "node:fs";
const PW = (fs.readFileSync(".env.local", "utf8").match(/SITE_PASSWORD=(.*)/) || [])[1]?.trim();
const b = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
for (const [w, h, tag] of [[390, 844, "phone"], [1512, 950, "desktop"]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: w < 768, hasTouch: w < 768, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const got = [];
  p.on("response", (res) => {
    const u = res.url();
    if (!/\/_next\/image|\.(png|jpe?g|webp|avif)(\?|$)/i.test(u)) return;
    got.push({ bytes: Number(res.headers()["content-length"] || 0), w: (/[?&]w=(\d+)/.exec(u) || [])[1], url: u });
  });
  await p.goto("http://localhost:3000/password", { waitUntil: "domcontentloaded" }); await p.waitForTimeout(400);
  const i = await p.$("input"); if (i && PW) { await i.fill(PW); await i.press("Enter"); await p.waitForTimeout(1200); }
  got.length = 0;
  await p.goto("http://localhost:3000/sprouts-farmers-market", { waitUntil: "domcontentloaded" });
  await p.waitForFunction(() => !document.querySelector("[data-page-loader]"), null, { timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(2500);
  for (let k = 0; k < 30; k++) { await p.mouse.wheel(0, 900); await p.waitForTimeout(70); }
  await p.waitForTimeout(2500);
  const total = got.reduce((a, g) => a + g.bytes, 0);
  const widths = {};
  for (const g of got) { const k = g.w || "raw"; widths[k] = (widths[k] || 0) + 1; }
  console.log(`  ${tag.padEnd(8)} ${got.length} images, ${(total / 1048576).toFixed(2)}MB   widths ${Object.entries(widths).sort((a,z)=>z[1]-a[1]).map(([k,n])=>`${k}:${n}`).join(" ")}`);
  const raw = got.filter(g => !g.w).sort((a, z) => z.bytes - a.bytes);
  console.log(`     ${raw.length} straight from /assets, ${(raw.reduce((a,g)=>a+g.bytes,0)/1048576).toFixed(2)}MB:`);
  for (const g of raw.slice(0, 8)) console.log(`       ${String((g.bytes/1024)|0).padStart(5)}KB  ${decodeURIComponent(g.url).replace(/^https?:\/\/[^/]+/, "")}`);
  await ctx.close();
}
await b.close();

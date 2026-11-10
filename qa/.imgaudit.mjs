/* What the browser actually downloads, per page, at phone and desktop. */
import { chromium } from "playwright-core";
import fs from "node:fs";
const BASE = process.env.QA_BASE || "https://noahcousineau.com";
const PW = (fs.readFileSync(".env.local", "utf8").match(/SITE_PASSWORD=(.*)/) || [])[1]?.trim();
const b = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
for (const [w, h, tag] of [[390, 844, "phone 390"], [1512, 950, "desktop 1512"]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: w < 768, hasTouch: w < 768, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const got = [];
  p.on("response", async (res) => {
    const u = res.url();
    if (!/\/_next\/image|\.(png|jpe?g|webp|avif|mp4)(\?|$)/i.test(u)) return;
    const len = Number(res.headers()["content-length"] || 0);
    const mw = /[?&]w=(\d+)/.exec(u);
    got.push({ w: mw ? +mw[1] : null, bytes: len, url: u });
  });
  await p.goto(`${BASE}/password`, { waitUntil: "domcontentloaded", timeout: 90000 }); await p.waitForTimeout(400);
  const i = await p.$("input"); if (i && PW) { await i.fill(PW); await i.press("Enter"); await p.waitForTimeout(1200); }
  for (const path of ["/", "/sprouts-farmers-market"]) {
    got.length = 0;
    await p.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await p.waitForFunction(() => !document.querySelector("[data-page-loader]"), null, { timeout: 60000 }).catch(() => {});
    await p.waitForTimeout(2500);
    for (let k = 0; k < 25; k++) { await p.mouse.wheel(0, 900); await p.waitForTimeout(70); }
    await p.waitForTimeout(1500);
    const isVid = (g) => /\.mp4(\?|$)/i.test(g.url);
    const imgs = got.filter(g => !isVid(g));
    const vids = got.filter(isVid);
    const total = got.reduce((a, g) => a + g.bytes, 0);
    const imgBytes = imgs.reduce((a, g) => a + g.bytes, 0);
    const vidBytes = vids.reduce((a, g) => a + g.bytes, 0);
    const byW = {};
    for (const g of got) { const k = g.w || "raw"; byW[k] = (byW[k] || 0) + 1; }
    const biggest = [...got].sort((a, z) => z.bytes - a.bytes).slice(0, 4)
      .map(g => `${(g.bytes / 1024 | 0)}KB ${decodeURIComponent(g.url).split("/").pop().slice(0, 44)}`);
    console.log(`\n  ${tag}  ${path}`);
    console.log(`     ${imgs.length} images ${(imgBytes / 1048576).toFixed(2)}MB   +   ${vids.length} videos ${(vidBytes / 1048576).toFixed(1)}MB   = ${(total / 1048576).toFixed(1)}MB`);
    console.log(`     widths requested: ${Object.entries(byW).sort((a, z) => z[1] - a[1]).map(([k, n]) => `${k}:${n}`).join("  ")}`);
    console.log(`     heaviest: ${biggest.join(" | ")}`);
  }
  await ctx.close();
}
await b.close();

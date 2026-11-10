import { chromium } from "playwright-core";
import fs from "node:fs";

const BASE = process.env.QA_BASE || "https://noahcousineau.com";
const PW = (fs.readFileSync(".env.local", "utf8").match(/SITE_PASSWORD=(.*)/) || [])[1]?.trim();
const b = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });

for (const [w, h, tag] of [[390, 844, "phone  "], [1512, 950, "desktop"]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, isMobile: w < 768, hasTouch: w < 768, deviceScaleFactor: 2 })).newPage();
  const bad = [];
  let imgBytes = 0, imgN = 0, ytN = 0, ytBytes = 0;
  p.on("response", async (r) => {
    const u = r.url();
    if (/youtube|ytimg|googlevideo/i.test(u)) {
      ytN++;
      let n = Number(r.headers()["content-length"] || 0);
      if (!n) { try { n = (await r.body()).length; } catch {} }
      ytBytes += n;
      return;
    }
    if (r.status() >= 400) bad.push(r.status() + " " + decodeURIComponent(u).replace(BASE, ""));
    if (!/\/_next\/image|\.(png|jpe?g|webp|avif|svg)(\?|$)/i.test(u)) return;
    let n = Number(r.headers()["content-length"] || 0);
    if (!n) { try { n = (await r.body()).length; } catch {} }
    imgBytes += n; imgN++;
  });

  await p.goto(BASE + "/password", { waitUntil: "domcontentloaded" }).catch(() => {});
  await p.waitForTimeout(600);
  const inp = await p.$("input");
  if (inp && PW) { await inp.fill(PW); await inp.press("Enter"); await p.waitForTimeout(1800); }

  console.log(`\n=== ${tag} @ ${BASE} ===`);
  for (const u of ["/", "/about", "/work", "/sprouts-farmers-market"]) {
    bad.length = 0; imgBytes = 0; imgN = 0; ytN = 0; ytBytes = 0;
    await p.goto(BASE + u, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => !document.querySelector("[data-page-loader]"), null, { timeout: 60000 }).catch(() => {});
    await p.waitForTimeout(2200);
    for (let s = 0; s < 40; s++) { await p.mouse.wheel(0, 1500); await p.waitForTimeout(165); }
    await p.waitForTimeout(3000);
    const broken = await p.$$eval("img", els => els.filter(e => e.complete && e.naturalWidth === 0 && e.currentSrc).length);
    const fmt = await p.evaluate(() => {
      const r = { avif: 0, other: 0 };
      for (const e of document.querySelectorAll("img"))
        if (/\.avif|f=avif/.test(e.currentSrc) || /_next\/image/.test(e.currentSrc)) r.avif++; else r.other++;
      return r;
    });
    console.log(`  ${u.padEnd(30)} ${String(imgN).padStart(3)} imgs ${(imgBytes/1048576).toFixed(2)}MB | yt ${ytN} req ${(ytBytes/1024).toFixed(0)}KB | ${bad.length} http>=400 | ${broken} broken`);
    for (const x of [...new Set(bad)].slice(0, 4)) console.log("        ", x.slice(0, 100));
  }

  if (w > 768) {
    // phone number gone?
    await p.goto(BASE + "/about", { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(2500);
    const tel = await p.evaluate(() => {
      const links = [...document.querySelectorAll('a[href^="tel:"]')].map(a => a.getAttribute("href"));
      const text = document.body.innerText;
      const digits = text.match(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g) || [];
      return { telLinks: links, phoneLike: [...new Set(digits)] };
    });
    console.log(`  phone: tel: links = ${JSON.stringify(tel.telLinks)}, phone-shaped text = ${JSON.stringify(tel.phoneLike)}`);
  }
}
await b.close();

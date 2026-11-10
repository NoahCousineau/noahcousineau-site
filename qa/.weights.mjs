import { chromium } from "playwright-core";
import fs from "node:fs";
const PW = (fs.readFileSync(".env.local","utf8").match(/SITE_PASSWORD=(.*)/)||[])[1]?.trim();
const b = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
for (const [w,h,tag] of [[390,844,"phone  "],[1512,950,"desktop"]]) {
  const p = await (await b.newContext({ viewport:{width:w,height:h}, isMobile:w<768, hasTouch:w<768, deviceScaleFactor:2 })).newPage();
  let bytes = 0, n = 0;
  p.on("response", async r => {
    const u = r.url();
    if (!/\/_next\/image|\.(png|jpe?g|webp|avif|svg)(\?|$)/i.test(u)) return;
    let len = Number(r.headers()["content-length"] || 0);
    if (!len) { try { len = (await r.body()).length; } catch {} }
    bytes += len; n++;
  });
  await p.goto("http://localhost:3000/password",{waitUntil:"domcontentloaded"}); await p.waitForTimeout(500);
  const i = await p.$("input"); if (i && PW) { await i.fill(PW); await i.press("Enter"); await p.waitForTimeout(1500); }
  console.log(`--- ${tag} ---`);
  for (const u of ["/","/about","/work","/work/sprouts-farmers-market"]) {
    bytes = 0; n = 0;
    await p.goto("http://localhost:3000"+u,{waitUntil:"domcontentloaded"});
    await p.waitForFunction(()=>!document.querySelector("[data-page-loader]"),null,{timeout:60000}).catch(()=>{});
    await p.waitForTimeout(2200);
    for (let s=0;s<40;s++){ await p.mouse.wheel(0,1500); await p.waitForTimeout(170); }
    await p.waitForTimeout(3000);
    console.log(`  ${u.padEnd(32)} ${String(n).padStart(3)} images  ${(bytes/1048576).toFixed(2)}MB`);
  }
}
await b.close();

import { chromium } from "playwright-core";
import fs from "node:fs";
const PW = (fs.readFileSync(".env.local","utf8").match(/SITE_PASSWORD=(.*)/)||[])[1]?.trim();
const b = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const p = await (await b.newContext({ viewport:{width:1512,height:950}, deviceScaleFactor:2 })).newPage();
const bad = [];
p.on("response", r => { if (r.status() >= 400 && !/youtube|ytimg|google/i.test(r.url())) bad.push(r.status()+" "+decodeURIComponent(r.url()).replace("http://localhost:3000","")); });
await p.goto("http://localhost:3000/password",{waitUntil:"domcontentloaded"}); await p.waitForTimeout(400);
const i = await p.$("input"); if (i && PW) { await i.fill(PW); await i.press("Enter"); await p.waitForTimeout(1200); }
const pages = ["/","/about","/work","/sprouts-farmers-market","/corita-art-center","/socal-earth","/cultural-olympiad-poster","/valley-strong-credit-union","/more-work"];
for (const u of pages) {
  bad.length = 0;
  await p.goto("http://localhost:3000"+u,{waitUntil:"domcontentloaded"});
  await p.waitForFunction(()=>!document.querySelector("[data-page-loader]"),null,{timeout:60000}).catch(()=>{});
  await p.waitForTimeout(1800);
  for (let s=0;s<45;s++){ await p.mouse.wheel(0,1600); await p.waitForTimeout(130); }
  await p.waitForTimeout(2500);
  // broken <img> that loaded nothing
  const broken = await p.$$eval("img", els => els.filter(e => e.complete && e.naturalWidth === 0 && e.currentSrc).map(e => decodeURIComponent(e.currentSrc).slice(-70)));
  console.log(`${u.padEnd(34)} ${bad.length} http>=400, ${broken.length} broken <img>`);
  for (const x of [...new Set(bad)].slice(0,5)) console.log("     ", x.slice(0,110));
  for (const x of broken.slice(0,5)) console.log("      IMG", x);
}
await b.close();

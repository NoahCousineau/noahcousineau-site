/* Every page, every tier: console errors, hydration mismatches, failed
 * requests. The things a visitor would hit that a layout audit cannot see. */
import { chromium } from "playwright-core";
const PW=process.env.SITE_PASSWORD, B="http://localhost:3100";
const PAGES=["/","/about","/work","/work/sprouts-farmers-market","/work/corita-art-center","/work/socal-earth","/work/cultural-olympiad-poster","/work/valley-strong-credit-union","/work/more-work","/no-such-page"];
const WIDTHS=[390,900,1512];
const b=await chromium.launch({executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"});
let jsErr=0, hyd=0, netFail=0, loads=0; const details=[];
for(const w of WIDTHS){
  const ctx=await b.newContext({viewport:{width:w,height:900},deviceScaleFactor:1});
  const p=await ctx.newPage();
  let where="(setup)";
  p.on("console", m=>{ const t=m.text();
    // The 404 page is SUPPOSED to 404, and the browser logs that as a console
    // error. Counting it made a healthy site report three errors.
    const expected404 = where === "/no-such-page" && /404|Not Found/i.test(t);
    if(m.type()==="error" && !expected404){ jsErr++; details.push(`[${w}] ${where} console: ${t.slice(0,110)}`); }
    if(/hydrat|did not match|Text content does not match/i.test(t)){ hyd++; details.push(`[${w}] hydration: ${t.slice(0,110)}`); } });
  p.on("pageerror", e=>{ jsErr++; details.push(`[${w}] pageerror: ${String(e).slice(0,110)}`); });
  /* Media requests abort constantly and harmlessly: a <video> that scrolls
   * out of view, or is removed, cancels its range request, and Playwright
   * reports that as "requestfailed". Counting those made a scroll-walk over
   * nine pages report 89 failures on a site where every one of those files
   * serves a clean 206. Only a request that failed for a reason OTHER than
   * being cancelled is worth reporting. */
  p.on("requestfailed", r=>{ const u=r.url();
    const why = r.failure()?.errorText || "";
    if(u.startsWith(B) && !/ABORTED|canceled|cancelled/i.test(why) && !/\.(mp4|webm|mov)(\?|$)/i.test(u)){
      netFail++; details.push(`[${w}] ${where} failed (${why}): ${u.slice(0,90)}`); } });
  p.on("response", r=>{ if(r.url().startsWith(B) && r.status()>=400 && r.status()!==404){ netFail++; details.push(`[${w}] ${where} ${r.status()}: ${r.url().slice(0,100)}`);} });
  await p.goto(B+"/password",{waitUntil:"domcontentloaded"}); await p.waitForTimeout(500);
  const i=await p.$("input"); if(i&&PW){await i.fill(PW); await i.press("Enter"); await p.waitForTimeout(1400);}
  for(const path of PAGES){
    where=path;
    await p.goto(B+path,{waitUntil:"domcontentloaded",timeout:60000});
    await p.waitForFunction(()=>{const o=[...document.querySelectorAll("div")].filter(d=>{const c=getComputedStyle(d);return c.position==="fixed"&&+c.zIndex>=9999;});return o.length===0||o.every(d=>getComputedStyle(d).opacity==="0");},null,{timeout:45000}).catch(()=>{});
    await p.evaluate(async()=>{const h=document.documentElement.scrollHeight;for(let i=0;i<25;i++){window.scrollTo(0,h*(i/25));await new Promise(r=>setTimeout(r,60));}});
    await p.waitForTimeout(600); loads++;
  }
  await ctx.close();
}
await b.close();
console.log(`page loads: ${loads}   js errors: ${jsErr}   hydration: ${hyd}   failed requests: ${netFail}`);
details.slice(0,12).forEach(d=>console.log("  "+d));

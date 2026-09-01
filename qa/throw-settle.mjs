/*
 * HOW LONG DOES A THROWN OBJECT TAKE TO STOP? (2026-09-01)
 *
 * Noah, with a screen recording of the cultural olympiad header: "when I throw
 * an objects, icons like the red wine glass or the yellow oscar statue will
 * jitter and not fully settle for some time."
 *
 * qa/header-jitter.mjs could not see this. It asks whether the pile REACHES
 * rest and whether it STAYS there, and by both of those measures these pages
 * were already clean — everything dead still four seconds after eight hard
 * throws. What Noah is describing is the seconds BEFORE that: an object that
 * has visibly landed and is still slowly turning.
 *
 * So this measures one thing per object: flick it with the mouse, then find
 * the last frame at which it moved at all. Desktop viewport and mouse input
 * deliberately — the recording is from Noah's Mac, where there is no tilt and
 * objects are thrown with a cursor.
 *
 * The threshold is what the eye can see: a quarter of a pixel of travel or a
 * sixth of a degree of turn between two frames. Below that an object is
 * stopped as far as anyone looking at it is concerned.
 */
import { chromium } from "playwright-core";
const BASE = process.env.QA_BASE || "http://localhost:3100";
const b = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const pages = (process.env.PAGES || "/work/cultural-olympiad-poster,/work/socal-earth,/work/corita-art-center").split(",");
const REPEATS = Number(process.env.REPEATS || 1);
const all = [];
for (let rep = 0; rep < REPEATS; rep++)
for (const path of pages) {
  const ctx = await b.newContext({ viewport: { width: 1512, height: 900 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.goto(BASE + path, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(15000);
  const names = await p.evaluate(() => [...document.querySelector("section > div.absolute.inset-x-0.top-0").children].map((k,i)=>{
    const im=k.querySelector("img"); const s=decodeURIComponent(im?(im.currentSrc||im.src):""); const m=s.match(/([^/]+)\.(webp|png)/); return m?m[1]:("obj"+i);}));
  const stops = [];
  for (let idx = 0; idx < names.length; idx++) {
    const t = await p.evaluate(i => { const k=[...document.querySelector("section > div.absolute.inset-x-0.top-0").children][i];
      const r=k.getBoundingClientRect(); return {x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2)}; }, idx);
    await p.mouse.move(t.x, t.y); await p.mouse.down();
    for (let j = 1; j <= 6; j++) { await p.mouse.move(t.x + j*38, t.y - j*20); await p.waitForTimeout(8); }
    await p.mouse.up();
    const tr = await p.evaluate(i => new Promise(res => {
      const k=[...document.querySelector("section > div.absolute.inset-x-0.top-0").children][i];
      const s=[]; const t0=performance.now();
      const tick=()=>{ const t=performance.now()-t0; const r=k.getBoundingClientRect();
        const m=new DOMMatrixReadOnly(getComputedStyle(k).transform);
        s.push([t, r.left, r.top, Math.atan2(m.b,m.a)*180/Math.PI]);
        if (t<7000) requestAnimationFrame(tick); else res(s); };
      requestAnimationFrame(tick); }), idx);
    let last = 0, lastMove = 0, lastTurn = 0;
    for (let j=1;j<tr.length;j++){
      const dp=Math.hypot(tr[j][1]-tr[j-1][1], tr[j][2]-tr[j-1][2]);
      let dr=Math.abs(tr[j][3]-tr[j-1][3]); if (dr>180) dr=360-dr;
      if (dp>0.25) lastMove = tr[j][0];
      if (dr>0.15) lastTurn = tr[j][0];
      if (dp>0.25 || dr>0.15) last = tr[j][0];
    }
    stops.push([names[idx], Math.round(last), Math.round(lastMove), Math.round(lastTurn)]);
    await p.waitForTimeout(300);
  }
  all.push(...stops.map(s=>s[1]));
  const vals = stops.map(s=>s[1]).sort((a,b)=>a-b);
  const worst = stops.slice().sort((a,b)=>b[1]-a[1]).slice(0,3);
  const turnLast = stops.filter(s=>s[3] > s[2] + 150).length;
  console.log(`  ${path.replace("/work/","").padEnd(26)} median ${String(vals[vals.length>>1]).padStart(4)}ms  max ${String(vals[vals.length-1]).padStart(4)}ms  turning-after-still ${turnLast}/${stops.length}`);
  worst.forEach(w=>console.log(`      ${w[0].padEnd(22)} stops ${String(w[1]).padStart(4)}ms   (last slide ${w[2]}ms, last turn ${w[3]}ms)`));
  await ctx.close();
}
const sorted = all.slice().sort((a,b)=>a-b);
const pct = (q)=>sorted[Math.min(sorted.length-1, Math.floor(sorted.length*q))];
console.log(`\n  OVERALL n=${sorted.length}  median ${pct(0.5)}ms  p90 ${pct(0.9)}ms  max ${sorted[sorted.length-1]}ms  mean ${Math.round(sorted.reduce((x,y)=>x+y,0)/sorted.length)}ms`);
await b.close();

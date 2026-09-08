import { chromium } from "playwright-core";
const EXE="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const b=await chromium.launch({executablePath:EXE});
const ORIGIN=process.env.QA_BASE||"http://localhost:3000";
const PRECHECK=["/","/about"];
const BASE=ORIGIN;
/* Fail loudly if BASE is not this site — a stale server on the wrong port
   answers 200 for `/` and 404 for everything else, and every count below
   then reads as a clean sheet. See assertServesSite in harness.mjs. */
for (const path of PRECHECK) {
  let res;
  try {
    res = await fetch(BASE + path);
  } catch (e) {
    console.error(`\nNothing answering at ${BASE}${path} — ${e.message}\n`);
    process.exit(2);
  }
  if (!res.ok) {
    console.error(
      `\n${BASE}${path} returned ${res.status}. Either QA_BASE points at ` +
        `the wrong server, or this route no longer exists.\n`
    );
    process.exit(2);
  }
}


const stub=(kind,remembered)=>`{ window.__asks=0;
  window.DeviceOrientationEvent=window.DeviceOrientationEvent||function(){};
  const K=${JSON.stringify(kind)};
  if(K==="android"){ delete window.DeviceOrientationEvent.requestPermission; }
  else { window.DeviceOrientationEvent.requestPermission=()=>{ window.__asks++;
    return Promise.resolve(K==="denied"?"denied":"granted"); }; }
  ${remembered?`try{localStorage.setItem("nc-tilt-answer",${JSON.stringify(remembered)});}catch(e){}`:""} }`;

const vis=async(p)=>p.evaluate(()=>{ const el=document.querySelector('[data-motion-prompt]');
  if(!el) return {present:false,shown:false};
  const cs=getComputedStyle(el), r=el.getBoundingClientRect();
  return {present:true, shown: cs.visibility==="visible" && parseFloat(cs.opacity)>0.5,
    rect:{t:Math.round(r.top),h:Math.round(r.height),w:Math.round(r.width)}, text:el.textContent.trim()}; });

const CASES=[
  ["iOS, never answered",      "ios",     null,      390, "SHOWN"],
  ["iOS, granted before",      "ios",     "granted", 390, "absent"],
  ["iOS, denied before",       "denied",  "denied",  390, "absent"],
  ["Android (no gate)",        "android", null,      390, "absent"],
  ["desktop 1440",             "ios",     null,     1440, "absent"],
];
let fails=0;
for (const [label,kind,mem,w,want] of CASES) {
  const ctx=await b.newContext({viewport:{width:w,height:w===1440?900:844},deviceScaleFactor:2,isMobile:w<768,hasTouch:w<768});
  await ctx.addInitScript(stub(kind,mem));
  const p=await ctx.newPage(); const errs=[]; p.on("pageerror",e=>errs.push(e.message));
  await p.goto(ORIGIN,{waitUntil:"domcontentloaded"});
  await p.waitForTimeout(7000);
  const v=await vis(p);
  const got=v.shown?"SHOWN":"absent";
  const ok=got===want && errs.length===0;
  if(!ok) fails++;
  console.log(`  ${ok?"ok  ":"FAIL"} ${label.padEnd(22)} ${got.padEnd(6)} (want ${want})${v.shown?"  "+JSON.stringify(v.rect)+" "+JSON.stringify(v.text):""}${errs.length?"  errs "+errs.length:""}`);
  await ctx.close();
}

// Tap it: does it ask, leave, and remember?
{
  const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await ctx.addInitScript(stub("ios",null));
  const p=await ctx.newPage();
  await p.goto(ORIGIN,{waitUntil:"domcontentloaded"});
  await p.waitForTimeout(7000);
  const v=await vis(p);
  await p.evaluate(()=>document.querySelector('[data-motion-prompt]').getBoundingClientRect());
  const r=await p.evaluate(()=>{const b=document.querySelector('[data-motion-prompt]').getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2};});
  await p.touchscreen.tap(r.x,r.y);
  await p.waitForTimeout(1200);
  const asks=await p.evaluate(()=>window.__asks);
  const remembered=await p.evaluate(()=>{try{return localStorage.getItem("nc-tilt-answer");}catch(e){return "ERR";}});
  const after=(await vis(p)).shown;
  const ok = v.shown && asks===1 && remembered==="granted" && !after;
  if(!ok) fails++;
  console.log(`  ${ok?"ok  ":"FAIL"} tapping it            asks ${asks}, remembered ${remembered}, still shown ${after}`);
  // Same visit, next page — and a whole new visit, now that it is remembered.
  await p.goto(ORIGIN+"/about",{waitUntil:"domcontentloaded"});
  await p.waitForTimeout(8000);
  const again=(await vis(p)).shown;
  if(again) fails++;
  console.log(`  ${again?"FAIL":"ok  "} next page same visit  ${again?"OFFERED AGAIN":"quiet"}`);
  await ctx.close();
}

// The window it lives in.
{
  const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await ctx.addInitScript(stub("ios",null));
  const p=await ctx.newPage();
  await p.goto(ORIGIN,{waitUntil:"domcontentloaded"});
  const life=[];
  for (let t=1;t<=20;t++){ await p.waitForTimeout(1000); life.push((await vis(p)).shown?"#":"."); }
  console.log(`  ---- 1s..20s after load: ${life.join("")}   (# = offered)`);
  await ctx.close();
}
// The arrow ScrollCue drops at the foot of the screen fifteen seconds in
// lands within ~20px of this. They must never be up together.
{
const stub=`{ window.DeviceOrientationEvent=window.DeviceOrientationEvent||function(){};
  window.DeviceOrientationEvent.requestPermission=()=>new Promise(()=>{}); }`; // never answers: worst case, prompt stays eligible
for (const [label,delay] of [["fast",0],["slow 3G-ish",900],["very slow",2600]]) {
  const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await ctx.addInitScript(stub);
  if (delay) await ctx.route("**/*.{webp,png,jpg,mp4,woff2}", async r=>{ await new Promise(s=>setTimeout(s,delay)); await r.continue(); });
  const p=await ctx.newPage();
  await p.goto(ORIGIN,{waitUntil:"domcontentloaded"});
  let worst=null;
  for (let t=0;t<=26;t+=0.5){
    await p.waitForTimeout(500);
    const s=await p.evaluate(()=>{
      const box=(el)=>{ if(!el) return null; const cs=getComputedStyle(el);
        if(cs.visibility!=="visible"||parseFloat(cs.opacity)<0.05) return null;
        const r=el.getBoundingClientRect(); return {t:r.top,b:r.bottom,l:r.left,r:r.right}; };
      return { prompt: box(document.querySelector('[data-motion-prompt]')),
               arrow: box(document.querySelector('[data-scroll-cue]')) };
    });
    if (s.prompt && s.arrow){
      const ov=Math.max(0,Math.min(s.prompt.b,s.arrow.b)-Math.max(s.prompt.t,s.arrow.t))
             * Math.max(0,Math.min(s.prompt.r,s.arrow.r)-Math.max(s.prompt.l,s.arrow.l));
      if (!worst||ov>worst.ov) worst={t,ov:Math.round(ov)};
    }
  }
  console.log(`  ${label.padEnd(12)} worst prompt/arrow overlap: ${worst?`${worst.ov}px² at ${worst.t}s`:"never both visible"}`);
  await ctx.close();
}
}

await b.close();
console.log(fails?`\n  ${fails} FAILED`:"\n  motion prompt behaves in every state");
process.exit(fails?1:0);

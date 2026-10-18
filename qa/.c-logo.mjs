import { chromium } from "playwright-core";
const B=process.env.QA_BASE||"http://localhost:3000";
const OUT="/private/tmp/claude-501/-Users-noahcousineau-Desktop-portfolio-noahcousineau-site/5a92aba5-9f87-47c5-91a0-843e0e91e314/scratchpad";
const b=await chromium.launch({executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"});
let fails=0;
const ok=(c,l,d="")=>{ if(!c) fails++; console.log(`  ${c?"ok  ":"FAIL"} ${l.padEnd(50)} ${d}`); };

const open=async(path,w,h)=>{
  const ctx=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:2,isMobile:w<768,hasTouch:w<768});
  const p=await ctx.newPage();
  const errs=[]; p.on("pageerror",e=>errs.push(e.message.slice(0,70)));
  await p.goto(B+path,{waitUntil:"domcontentloaded",timeout:120000});
  await p.waitForFunction(()=>!document.querySelector("[data-page-loader]"),null,{timeout:90000}).catch(()=>{});
  await p.waitForTimeout(1200);
  return {ctx,p,errs};
};
const toBottom=async(p)=>{
  for(let i=0;i<14;i++){ await p.evaluate(()=>window.scrollBy(0,window.innerHeight)); await p.waitForTimeout(260); }
  await p.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
  // The roll is a timed animation now: 0.45s delay + 2.6s. Wait it out.
  await p.waitForTimeout(4200);
};
const mark=(p)=>p.evaluate(()=>{
  const a=document.querySelector('footer a[aria-label="About me"] svg')?.closest("a");
  if(!a) return null;
  const r=a.getBoundingClientRect();
  const m=new DOMMatrixReadOnly(getComputedStyle(a).transform);
  return { x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2), w:Math.round(r.width),
    deg:+(Math.atan2(m.b,m.a)*180/Math.PI).toFixed(1),
    onScreen: r.right>0 && r.left<innerWidth && r.bottom>0 && r.top<innerHeight };
});

console.log("\n  desktop 1512x982");
{ const {ctx,p,errs}=await open("/",1512,982);
  const before=await mark(p);
  await toBottom(p);
  const after=await mark(p);
  ok(after!==null, "the C mark is in the footer", after?`centre ${after.x},${after.y} ${after.w}px`:"");
  // Right to left: it must start beyond the RIGHT edge and arrive leftward.
  ok(before && before.x > 1512 && after && after.onScreen && after.x < before.x,
     "rolls in from off the right edge, leftward",
     `${before?before.x:"?"} -> ${after?after.x:"?"} (viewport 1512)`);
  ok(after && after.w > 240, "bigger than before", `${after?after.w:"?"}px wide (was 280 at -12°)`);
  ok(after && Math.abs(after.deg-(-12))<2.5, "comes to rest at a slight angle", `${after?after.deg:"?"}°`);
  const head=await p.evaluate(()=>!!document.querySelector('footer img[alt*="head" i], footer [data-peeking-head]'));
  ok(!head, "the head is gone on desktop");
  ok(errs.length===0, "no page errors", errs.join("; "));
  await p.screenshot({path:`${OUT}/clogo-desktop.png`});
  await ctx.close(); }

console.log("\n  can it be thrown, and does it still link?");
{ const {ctx,p}=await open("/",1512,982);
  await toBottom(p);
  const start=await mark(p);
  await p.evaluate(()=>{ window.__nativeDrag=false;
    document.querySelector("footer a[aria-label=\"About me\"]")
      ?.addEventListener("dragstart",()=>{window.__nativeDrag=true;}); });
  await p.mouse.move(start.x,start.y);
  await p.mouse.down();
  for(let i=1;i<=12;i++){ await p.mouse.move(start.x-18*i, start.y-9*i); await p.waitForTimeout(16); }
  await p.mouse.up();
  await p.waitForTimeout(1800);
  const after=await mark(p);
  ok(after && (Math.abs(after.x-start.x)>40 || Math.abs(after.y-start.y)>20), "a throw moves it",
     `${start.x},${start.y} -> ${after?after.x+","+after.y:"?"}`);
  ok(p.url().endsWith("/"), "a throw does NOT navigate", p.url());
  ok((await p.evaluate(()=>window.__nativeDrag))===false,
     "the browser's own link-drag never starts");
  await ctx.close(); }
{ const {ctx,p}=await open("/",1512,982);
  await toBottom(p);
  const m=await mark(p);
  await p.mouse.click(m.x,m.y);
  await p.waitForTimeout(2500);
  ok(new URL(p.url()).pathname==="/about", "a click goes to the about page", new URL(p.url()).pathname);
  await ctx.close(); }

console.log("\n  phone 390x844 — unchanged");
{ const {ctx,p,errs}=await open("/",390,844);
  await toBottom(p);
  const c=await p.evaluate(()=>!!document.querySelector('footer a[aria-label="About me"] svg'));
  const head=await p.evaluate(()=>!!document.querySelector('footer a[aria-label="About me"] img, footer a[aria-label="About me"] canvas'));
  ok(!c, "no C mark on the phone");
  ok(head, "the head is still there on the phone");
  ok(errs.length===0, "no page errors", errs.join("; "));
  await p.screenshot({path:`${OUT}/clogo-phone.png`});
  await ctx.close(); }

console.log("\n  the finger still works on a desktop project page");
{ const {ctx,p,errs}=await open("/work/socal-earth",1512,982);
  await toBottom(p);
  const hand=await p.evaluate(()=>{
    const i=[...document.querySelectorAll("footer img")].find(x=>/hand|finger|pointing/i.test(x.src));
    if(!i) return null; const r=i.getBoundingClientRect();
    return {onScreen:r.bottom>0&&r.top<innerHeight, w:Math.round(r.width)};});
  ok(hand && hand.onScreen, "the fallen hand is still in the project footer", JSON.stringify(hand));
  const c=await p.evaluate(()=>!!document.querySelector('footer a[aria-label="About me"] svg'));
  ok(c, "and the C mark is there too");
  ok(errs.length===0, "no page errors", errs.join("; "));
  await p.screenshot({path:`${OUT}/clogo-project.png`});
  await ctx.close(); }

await b.close();
console.log(fails?`\n  ${fails} FAILED`:"\n  the C mark rolls in, throws, and links — desktop only");
process.exit(fails?1:0);

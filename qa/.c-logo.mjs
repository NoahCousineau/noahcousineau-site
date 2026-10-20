import { chromium } from "playwright-core";
const B=process.env.QA_BASE||"http://localhost:3000";
const OUT=process.env.OUT||".";
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

console.log("\n  phone 390x844 — the head is gone, the mark is loose");
{ const {ctx,p,errs}=await open("/",390,844);
  await toBottom(p);
  const c=await p.evaluate(()=>!!document.querySelector('footer a[aria-label="About me"] svg'));
  const head=await p.evaluate(()=>!!document.querySelector('footer a[aria-label="About me"] img, footer a[aria-label="About me"] canvas'));
  ok(c, "the C mark is in the phone footer");
  ok(!head, "the head is gone from the phone footer");
  // It must stay inside the footer, not the whole page.
  /* THE ARTWORK, NOT ITS TILTED BOUNDING BOX. The mark rests at an angle,
     and a rotated square's AABB reaches past the disc on every side — once
     the mark was moved down to sit ON the bottom of the window (2026-10-18,
     Noah: "Make sure it sits at the bottom of the browser window") that
     overhang alone failed this, with the disc itself exactly flush. */
  const bounds=await p.evaluate(()=>{
    const a=document.querySelector('footer a[aria-label="About me"]');
    const f=document.querySelector("footer");
    const host=a.offsetParent, hr=host.getBoundingClientRect(), fr=f.getBoundingClientRect();
    const left=hr.left+a.offsetLeft, top=hr.top+a.offsetTop;
    const right=left+a.offsetWidth, bottom=top+a.offsetHeight;
    return { inside: left>=fr.left-1 && right<=fr.right+1 && bottom<=fr.bottom+1,
             w:a.offsetWidth, gapBelow: Math.round(fr.bottom-bottom) };});
  ok(bounds.inside, "it sits inside the footer", `${bounds.w}px wide, ${bounds.gapBelow}px below it`);
  ok(bounds.gapBelow===0, "and on the very bottom of the window", `${bounds.gapBelow}px gap`);
  await p.screenshot({path:`${OUT}/clogo-phone.png`});
  // Dragging with a finger moves it.
  const before=await p.evaluate(()=>{const r=document.querySelector('footer a[aria-label="About me"]').getBoundingClientRect();
    return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)};});
  // NO TAP FIRST: tapping the mark navigates to the about page, and the drag
  // then happened on a different page with the footer far off screen — which
  // is how this check once "passed" with the mark 3200px below the footer.
  const cdp=await p.context().newCDPSession(p);
  await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:before.x,y:before.y}]});
  for(let i=1;i<=10;i++) await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:before.x-9*i,y:before.y-5*i}]});
  await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
  await p.waitForTimeout(1500);
  const after=await p.evaluate(()=>{const r=document.querySelector('footer a[aria-label="About me"]').getBoundingClientRect();
    return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)};});
  ok(Math.abs(after.x-before.x)>12||Math.abs(after.y-before.y)>12, "a finger drag moves it",
     `${before.x},${before.y} -> ${after.x},${after.y}`);
  const stillHome = new URL(p.url()).pathname === "/";
  ok(stillHome, "a drag does not navigate", new URL(p.url()).pathname);
  /* MEASURE THE CIRCLE, NOT ITS TILTED BOX. getBoundingClientRect on a
     rotated square returns the axis-aligned box around it, which at this
     angle is 19% wider than the element — so the mark read as 15px below the
     footer while its circle was resting exactly on the floor. The artwork is
     a disc that fills its square, so centre ± half the unrotated width is
     the real extent. */
  const penned=await p.evaluate(()=>{
    const a=document.querySelector('footer a[aria-label="About me"]');
    const f=document.querySelector("footer");
    const ar=a.getBoundingClientRect(), fr=f.getBoundingClientRect();
    const cx=ar.left+ar.width/2, cy=ar.top+ar.height/2, r=a.offsetWidth/2;
    return { ok: cx-r>=fr.left-2 && cx+r<=fr.right+2 && cy-r>=fr.top-2 && cy+r<=fr.bottom+2,
      mark:`centre ${Math.round(cx)},${Math.round(cy)} r${Math.round(r)}`,
      footer:`${Math.round(fr.width)}x${Math.round(fr.height)}` };});
  ok(penned.ok, "after the drag it is still inside the footer", `${penned.mark} in ${penned.footer}`);
  ok(errs.length===0, "no page errors", errs.join("; "));
  await ctx.close(); }

{ // Tilting the phone must move it too, like the home grid's objects.
  const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await ctx.addInitScript(`{ window.DeviceOrientationEvent=window.DeviceOrientationEvent||function(){};
    window.DeviceOrientationEvent.requestPermission=()=>Promise.resolve("granted"); }`);
  const p=await ctx.newPage();
  await p.goto(B+"/",{waitUntil:"domcontentloaded",timeout:120000});
  await p.waitForFunction(()=>!document.querySelector("[data-page-loader]"),null,{timeout:90000}).catch(()=>{});
  await p.waitForTimeout(1000);
  await p.touchscreen.tap(30,700);          // the first touch is what grants motion
  for(let i=0;i<14;i++){ await p.evaluate(()=>window.scrollBy(0,window.innerHeight)); await p.waitForTimeout(240); }
  await p.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
  await p.waitForTimeout(1500);
  const at=()=>p.evaluate(()=>{const a=document.querySelector('footer a[aria-label="About me"]');
    if(!a) return null; const r=a.getBoundingClientRect(); return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)};});
  const start=await at();
  for (const [beta,gamma] of [[40,-55],[40,55],[30,0]]) {
    await p.evaluate(([bb,gg])=>{ const D=window.DeviceOrientationEvent;
      for(let i=0;i<24;i++) setTimeout(()=>window.dispatchEvent(new D("deviceorientation",{beta:bb,gamma:gg})), i*40); },[beta,gamma]);
    await p.waitForTimeout(1400);
  }
  const end=await at();
  ok(start&&end&&(Math.abs(end.x-start.x)>8||Math.abs(end.y-start.y)>8), "tilting the phone moves it",
     `${start?start.x+","+start.y:"?"} -> ${end?end.x+","+end.y:"?"}`);
  await ctx.close(); }

{ // A project page footer has the finger and no mark.
  const {ctx,p}=await open("/work/socal-earth",390,844);
  await toBottom(p);
  const c=await p.evaluate(()=>!!document.querySelector('footer a[aria-label="About me"] svg'));
  const hand=await p.evaluate(()=>[...document.querySelectorAll("footer img")].some(i=>/hand|finger|pointing/i.test(i.src)));
  ok(!c, "no C mark where the finger is");
  ok(hand, "the finger is still there");
  await ctx.close(); }

/* REACHED BY CLICKING, NEVER BY LOADING (2026-10-18).
 *
 * This is the blind spot that hid "it's still preloaded and I can't drag
 * it" through five rounds of fixes. The footer lives in the root layout, so
 * a link click swaps the page beneath it and remounts nothing: the mark
 * kept the position and the settled state it was left in, forever. Every
 * check here loaded its page fresh, which is the one way the bug cannot
 * show. Noah, on the fifth round: "It is still 'preloaded' and I can't drag
 * the C logo on desktop."
 *
 * And it is judged on how far the mark GOT, not where it stopped. Thrown
 * hard it tumbles, hits a wall and can come to rest 23px from where it
 * started having crossed 1100px on the way — end position cannot tell that
 * from a mark that never moved, which cost three rounds of chasing a bug
 * that was not there. */
console.log("\n  three desktop pages in a row, each reached by clicking a link");
{ const {ctx,p,errs}=await open("/",1512,982);
  const peakThrow=async(from)=>{
    let peak=0;
    await p.mouse.move(from.x,from.y); await p.mouse.down();
    for(let k=1;k<=10;k++){ await p.mouse.move(from.x-k*70,from.y-k*6); await p.waitForTimeout(12);
      const s=await mark(p); if(s) peak=Math.max(peak,Math.abs(s.x-from.x)); }
    await p.mouse.up();
    for(let k=0;k<15;k++){ const s=await mark(p); if(s) peak=Math.max(peak,Math.abs(s.x-from.x)); await p.waitForTimeout(100); }
    return Math.round(peak);
  };
  await toBottom(p);
  const first=await mark(p);
  ok(first!==null, "page 1: the mark is there", first?`x=${first.x}`:"");
  ok(await peakThrow(first) > 150, "page 1: it throws");
  for(const step of [2,3]){
    /* NOT THE HAND. Since 2026-10-19 the pointing finger is itself a link
       to the next project, it comes first in the DOM, and it is driven by
       useThrowable rather than by the browser — so a synthetic .click() on
       it is correctly prevented and nothing navigates. This check then
       measured the SAME page twice and read a settling thrown mark as "it
       was already rolled in on arrival". Click the words, with a real
       mouse, and skip anything aria-hidden. */
    const href=await p.evaluate(()=>{ const a=[...document.querySelectorAll('a[href^="/work/"]:not([aria-hidden])')].find(a=>a.getBoundingClientRect().width>0); return a&&a.getAttribute("href"); });
    if(!href){ ok(false, `page ${step}: no project link to click`); break; }
    /* Dispatched on the element rather than aimed at its coordinates: the
       mark has just been thrown and can be lying on top of the link, and a
       real click would land on the mark instead. */
    await p.evaluate(h=>{ [...document.querySelectorAll(`a[href="${h}"]:not([aria-hidden])`)].find(a=>a.getBoundingClientRect().width>0).click(); }, href);
    await p.waitForTimeout(2600);
    ok(new URL(p.url()).pathname===href, `page ${step}: the click actually navigated`, new URL(p.url()).pathname);
    const arrival=await mark(p);
    ok(arrival && arrival.x > 1512-60, `page ${step}: parked off the right edge on arrival`, `${href}, x=${arrival?.x}`);
    await toBottom(p);
    const rested=await mark(p);
    ok(rested && rested.x < 1512-100, `page ${step}: it rolls in, same as a fresh load`, `${arrival?.x} -> ${rested?.x}`);
    ok(await peakThrow(rested) > 150, `page ${step}: and it is still draggable`);
  }
  ok(errs.length===0, "no page errors", errs[0]||"");
  await ctx.close();
}

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
  /* THROWABLE, DESKTOP ONLY (2026-10-18). Noah: "I would like the pointing
     finger to be throwable. I love how it shows up currently so please
     don't change this." So: it still arrives on the footer's bottom edge
     at its rest angle, and it can now be picked up once it has landed. */
  const handBox=()=>p.evaluate(()=>{
    const i=[...document.querySelectorAll("footer img")].find(x=>/hand|finger|pointing/i.test(x.src));
    if(!i) return null; const h=i.parentElement, r=h.getBoundingClientRect();
    const host=h.offsetParent, hb=host.getBoundingClientRect();
    const f=document.querySelector("footer").getBoundingClientRect();
    return { x:Math.round(r.left+r.width/2), y:Math.round(r.top+40),
             layoutBottom:Math.round(hb.top+h.offsetTop+h.offsetHeight), footerBottom:Math.round(f.bottom),
             deg:+(Math.atan2(new DOMMatrixReadOnly(getComputedStyle(h).transform).b, new DOMMatrixReadOnly(getComputedStyle(h).transform).a)*180/Math.PI).toFixed(1) };});
  const h0=await handBox();
  ok(h0 && Math.abs(h0.layoutBottom-h0.footerBottom)<=2, "the hand still rests on the footer's bottom edge", `${h0?.layoutBottom} vs ${h0?.footerBottom}`);
  ok(h0 && Math.abs(h0.deg-(-6))<0.5, "still at its rest angle", `${h0?.deg} degrees`);
  let hpeak=0;
  await p.mouse.move(h0.x,h0.y); await p.mouse.down();
  for(let k=1;k<=10;k++){ await p.mouse.move(h0.x+k*60,h0.y-k*10); await p.waitForTimeout(12);
    const s=await handBox(); if(s) hpeak=Math.max(hpeak,Math.abs(s.x-h0.x)); }
  await p.mouse.up();
  for(let k=0;k<15;k++){ const s=await handBox(); if(s) hpeak=Math.max(hpeak,Math.abs(s.x-h0.x)); await p.waitForTimeout(100); }
  ok(hpeak>150, "and it can be thrown", `peak ${Math.round(hpeak)}px away`);
  ok(new URL(p.url()).pathname==="/work/socal-earth", "throwing it does not follow the link", new URL(p.url()).pathname);
  ok(errs.length===0, "no page errors", errs.join("; "));
  await p.screenshot({path:`${OUT}/clogo-project.png`});
  await ctx.close(); }

/* THE FOOTER INTRODUCES ITSELF EVERY TIME (2026-10-19). Noah: "everytime
 * we see the footer, it should reset to it's default state with the C
 * rolling in and the finger pointing to the 'next project' link." Both used
 * to be one-shot: the hand fell the first time and never again, and the
 * mark stopped obeying the scroll the moment it was picked up. */
console.log("\n  leaving the footer and coming back");
{ const {ctx,p,errs}=await open("/work/socal-earth",1512,982);
  const hand=()=>p.evaluate(()=>{ const im=document.querySelector('footer [aria-hidden] img[src*="pointing-hand"]');
    if(!im) return null; const e=im.parentElement, r=e.getBoundingClientRect();
    const m=new DOMMatrixReadOnly(getComputedStyle(e).transform);
    let d=Math.atan2(m.b,m.a)*180/Math.PI; d=((d%360)+360)%360;
    return { x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2), deg:+d.toFixed(1),
             href:e.getAttribute("href") }; });
  const away=async()=>{ for(let i=0;i<16;i++){ await p.evaluate(()=>window.scrollBy(0,-window.innerHeight)); await p.waitForTimeout(160);} await p.waitForTimeout(1200); };
  await toBottom(p);
  const h0=await hand(), m0=await mark(p);
  ok(h0 && /^\/work\//.test(h0.href||""), "the hand is a link to the next project", h0?.href);
  ok(h0 && Math.abs(h0.deg-354)<1, "it points at the words, as it always has", `${h0?.deg} degrees`);
  // throw them both well out of place
  await p.mouse.move(h0.x,h0.y); await p.mouse.down();
  for(let k=1;k<=10;k++){ await p.mouse.move(h0.x+k*60,h0.y-k*10); await p.waitForTimeout(12);} await p.mouse.up();
  await p.mouse.move(m0.x,m0.y); await p.mouse.down();
  for(let k=1;k<=10;k++){ await p.mouse.move(m0.x-k*70,m0.y-k*6); await p.waitForTimeout(12);} await p.mouse.up();
  await p.waitForTimeout(2600);
  const hT=await hand(), mT=await mark(p);
  ok(Math.abs(hT.x-h0.x)>20||Math.abs(hT.deg-h0.deg)>5, "both can be thrown out of place", `hand ${hT.x}/${hT.deg}deg, mark ${mT.x}`);
  await away();
  const mAway=await mark(p);
  ok(mAway && mAway.x>1512-60, "scrolling away rolls the mark back off the edge", `x=${mAway?.x}`);
  await toBottom(p);
  const h1=await hand(), m1=await mark(p);
  ok(h1 && Math.abs(h1.x-h0.x)<=2 && Math.abs(h1.deg-354)<1, "coming back, the hand is pointing again", `x=${h1?.x} (was ${h0.x}), ${h1?.deg} degrees`);
  ok(m1 && Math.abs(m1.x-m0.x)<=3, "and the mark has rolled in again", `x=${m1?.x} (was ${m0.x})`);
  ok(errs.length===0, "no page errors", errs[0]||"");
  await ctx.close(); }

/* IT FALLS OVER (2026-10-19). Noah: "sometimes it will get stuck upright
 * which feels unrealistic." Nothing used to make it: gravity was applied at
 * the centre of mass only, so any pose it landed in was an equilibrium.
 * Measured on the build before the toppling torque, four throws came to
 * rest at 93, 75, 280 and 122 degrees — standing on an end every time. */
console.log("\n  thrown hard, does it come to rest like a thing that fell?");
{ const {ctx,p}=await open("/work/socal-earth",1512,982);
  const hand=()=>p.evaluate(()=>{ const im=document.querySelector('footer [aria-hidden] img[src*="pointing-hand"]');
    const e=im.parentElement, r=e.getBoundingClientRect();
    const m=new DOMMatrixReadOnly(getComputedStyle(e).transform);
    let d=Math.atan2(m.b,m.a)*180/Math.PI; d=((d%360)+360)%360;
    return { x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2), deg:+d.toFixed(1) }; });
  await toBottom(p);
  const poses=[];
  for(let n=0;n<4;n++){
    const g=await hand();
    await p.mouse.move(g.x,g.y); await p.mouse.down();
    for(let k=1;k<=10;k++){ await p.mouse.move(g.x+(n%2?-1:1)*k*60,g.y-k*10); await p.waitForTimeout(12);} await p.mouse.up();
    await p.waitForTimeout(9000);
    const c=await hand();
    const flat=((c.deg%180)+180)%180;              // 0 = on its side, 90 = on an end
    poses.push({ deg:Math.round(c.deg), tilt:Math.round(90-Math.abs(90-flat)) });
  }
  const standing=poses.filter(x=>x.tilt>55).length;
  ok(standing===0, "it never comes to rest standing on an end", poses.map(x=>`${x.deg}deg`).join(", "));
  await ctx.close(); }

/* CATCHABLE THE WHOLE WAY IN (2026-10-19). Noah: "I would like for the C
 * logo to be draggable and throwable at any point when it is on screen. I
 * noticed that it currently can only be thrown when it finishes rolling."
 * Watched DURING the scroll, because the roll fires part way down and takes
 * about three seconds — scrolling to the footer first and only then looking
 * finds a mark that has already arrived, which is what this used to do. */
console.log("\n  catching the C mark mid-roll");
{ const {ctx,p,errs}=await open("/",1512,982);
  let caught=null;
  for(let k=0;k<60 && !caught;k++){
    await p.mouse.wheel(0,900);
    const a=await mark(p); await p.waitForTimeout(70); const c=await mark(p);
    if(a&&c&&Math.abs(c.x-a.x)>6&&c.x<1512&&c.x>100) caught=c;
  }
  ok(!!caught, "caught it while it was still travelling", caught?`x=${caught.x}`:"never saw it move");
  if(caught){
    let peak=0;
    await p.mouse.move(caught.x,caught.y); await p.mouse.down(); await p.waitForTimeout(60);
    const held=await mark(p);
    for(let k=1;k<=10;k++){ await p.mouse.move(caught.x-k*55,caught.y+k*4); await p.waitForTimeout(14);
      const sx=await mark(p); if(sx) peak=Math.max(peak,Math.abs(sx.x-held.x)); }
    await p.mouse.up(); await p.waitForTimeout(1200);
    ok(peak>150, "it follows the hand from where it was caught", `${Math.round(peak)}px`);
    ok(new URL(p.url()).pathname==="/", "and catching it does not navigate", new URL(p.url()).pathname);
  }
  ok(errs.length===0, "no page errors", errs[0]||"");
  await ctx.close(); }

/* ONE LINE WEIGHT IN THE FOOTER (2026-10-19). Noah: "make sure all the
 * horizontal rules that are being used have the same line thickness.
 * Please also make the rule under 'next project' move up to resemble the
 * other rules." The odd one out was a flat 2px border where the rest are
 * 2 artboard units — and it could not be fixed by changing the number,
 * because a border cannot hold a fractional width: Chrome rounded 1.57px
 * down to 1. It is a div now, like the others. */
console.log("\n  the footer's rules, on desktop");
{ const {ctx,p}=await open("/work/socal-earth",1512,982);
  await toBottom(p);
  const d=await p.evaluate(()=>{
    const hs=[];
    for(const el of document.querySelectorAll("footer div, footer span")){ const r=el.getBoundingClientRect();
      if(r.height>0.3&&r.height<6&&r.width>80&&getComputedStyle(el).backgroundColor!=="rgba(0, 0, 0, 0)") hs.push(+r.height.toFixed(2)); }
    const np=[...document.querySelectorAll("footer a")].find(a=>a.textContent.trim()==="next project");
    const rule=np?.querySelector("span"); const about=[...document.querySelectorAll("footer a")].find(a=>/about me/i.test(a.textContent));
    const ar=about.getBoundingClientRect();
    const theirs=[...document.querySelectorAll("footer div")].map(e=>e.getBoundingClientRect())
      .filter(r2=>r2.height>0.3&&r2.height<6&&Math.abs(r2.left-ar.left)<4&&r2.top>ar.bottom-2&&r2.top<ar.bottom+20)[0];
    const rr=rule?.getBoundingClientRect();
    const txt=np.getBoundingClientRect();
    return { thicknesses:[...new Set(hs)], theirGap: theirs?+(theirs.top-ar.bottom).toFixed(2):null,
             ourGap: rr?+(rr.top-(txt.top+ (txt.height-rr.height-(rr.top-txt.top)) )).toFixed(2):null,
             ruleTop: rr?Math.round(rr.top):null };});
  ok(d.thicknesses.length===1, "every rule in the footer is the same thickness", JSON.stringify(d.thicknesses));
  ok(!!d.ruleTop, "the next-project rule is a rule, not a border");
  await ctx.close(); }

/* THE ABOUT PAGE'S HEAD FALLS IN (2026-10-19). Noah: "the head currently is
 * 'preloaded' on the page. Instead, I would like for the head to fall down
 * just like the other icons on the pages." It is held above the red band,
 * hidden, until the loader lifts and the same beat the project icons wait
 * out has passed. Its resting bounding box dips past the band on any build
 * — the head lies at an angle, and a rotated box's AABB always reaches
 * further than the artwork — so the test is that it lands IN the band. */
console.log("\n  the about page head");
{ const ctx=await b.newContext({viewport:{width:1512,height:982},deviceScaleFactor:2});
  const p=await ctx.newPage();
  const errs=[]; p.on("pageerror",e=>errs.push(e.message.slice(0,70)));
  await p.goto(B+"/about",{waitUntil:"domcontentloaded",timeout:120000});
  const head=()=>p.evaluate(()=>{ const img=document.querySelector("main img[src*=head], section img[src*=head]");
    const w=img?.closest("div.absolute"); if(!w) return null;
    const r=w.getBoundingClientRect(); const band=w.offsetParent.getBoundingClientRect();
    return { bottom:Math.round(r.bottom), band:Math.round(band.bottom), bandTop:Math.round(band.top),
             vis:getComputedStyle(w).visibility }; });
  await p.waitForFunction(()=>!document.querySelector("[data-page-loader]"),null,{timeout:90000}).catch(()=>{});
  const early=await head();
  ok(early && early.vis==="hidden", "it is not on the page to begin with", `visibility: ${early?.vis}`);
  /* IT FALLS IN, IT DOES NOT APPEAR (2026-10-19). Noah: "the head sorta
     'pops' in, rather than fall in." It did: the band's ceiling — there so
     a thrown head bounces off the top rather than leaving — caught the
     lifted head on its first frame and parked it on the top edge, so it
     was painted already half on screen. Measured before the fix: lifted to
     a bottom of -373, painted at 376. The first frame anyone sees must be
     ABOVE the band. */
  let firstSeen=null;
  for(let k=0;k<80 && !firstSeen;k++){ const h=await head(); if(h&&h.vis==="visible") firstSeen=h; await p.waitForTimeout(50); }
  ok(firstSeen && firstSeen.bottom<=0, "the first frame of it is above the band, off screen",
     firstSeen?`bottom ${firstSeen.bottom}`:"never appeared");
  let top=1e9, low=-1e9;
  for(let k=0;k<70;k++){ const h=await head();
    if(h&&h.vis==="visible"){ top=Math.min(top,h.bottom); low=Math.max(low,h.bottom); }
    await p.waitForTimeout(100); }
  ok(low>top+80, "it falls a long way down", `${top} -> ${low}`);
  const a=await head(); await p.waitForTimeout(2500); const c=await head();
  ok(a&&c&&Math.abs(c.bottom-a.bottom)<=2, "and comes to rest", `${a?.bottom} -> ${c?.bottom}`);
  ok(c && c.bottom>c.band && c.bottom-c.band<70, "landing in the red band", `head ${c?.bottom}, band ${c?.band}`);
  ok(errs.length===0, "no page errors", errs[0]||"");
  await ctx.close(); }

await b.close();
console.log(fails?`\n  ${fails} FAILED`:"\n  the C mark rolls in, throws, and links — desktop only");
process.exit(fails?1:0);

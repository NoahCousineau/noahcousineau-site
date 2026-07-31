
const {chromium} = require('playwright-core');
(async()=>{
  const b = await chromium.launch({executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"});
  const sizes={mobile:[390,844],tablet:[834,1112],desktop:[1512,900]};
  const pages=["/","/about","/work","/work/socal-earth","/work/nobody-cares"];
  let bad=0;
  for(const [n,[w,h]] of Object.entries(sizes)){
    const ctx=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:2});
    const p=await ctx.newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    for(const u of pages){
      await p.goto("http://localhost:3000"+u,{waitUntil:"networkidle",timeout:60000}).catch(()=>{});
      const r=await p.evaluate(()=>({sw:document.documentElement.scrollWidth,iw:innerWidth,
        h1:getComputedStyle(document.querySelector('h1')||document.body).fontSize}));
      const ov=r.sw>r.iw+1; if(ov)bad++;
      console.log(`${n.padEnd(8)} ${u.padEnd(24)} w=${r.sw}/${r.iw} h1=${r.h1} ${ov?"OVERFLOW":"ok"}`);
    }
    if(errs.length) console.log("  JS ERRORS:",errs.slice(0,3));
    await ctx.close();
  }
  await b.close();
  console.log(bad?`\n${bad} OVERFLOW ISSUES`:"\nNo horizontal overflow at any breakpoint.");
})();

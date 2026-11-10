import { chromium } from "playwright-core";
import fs from "node:fs";

const BASE = process.env.QA_BASE || "http://localhost:3000";
const ROUTE = process.env.ROUTE || "/about";
const WIDTHS = (process.env.WIDTHS || "390,430,599,600,640,768,900,1023,1024,1199,1200,1512,1920")
  .split(",").map(Number);
const PW = (fs.readFileSync(".env.local", "utf8").match(/SITE_PASSWORD=(.*)/) || [])[1]?.trim();
const b = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });

for (const w of WIDTHS) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 }, isMobile: w < 768, hasTouch: w < 768 });
  const p = await ctx.newPage();
  await p.goto(BASE + "/password", { waitUntil: "domcontentloaded" }).catch(() => {});
  await p.waitForTimeout(350);
  const i = await p.$("input");
  if (i && PW) { await i.fill(PW); await i.press("Enter"); await p.waitForTimeout(1000); }
  await p.goto(BASE + ROUTE, { waitUntil: "domcontentloaded" });
  await p.waitForFunction(() => !document.querySelector("[data-page-loader]"), null, { timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(1200);
  for (let s = 0; s < 70; s++) { await p.mouse.wheel(0, 1600); await p.waitForTimeout(70); }
  await p.waitForTimeout(2500);

  const r = await p.evaluate(() => {
    const names = ["Work", "More Info", "Social", "Contact"];
    const foot = document.querySelector("footer");
    if (!foot) return { err: "no footer" };
    const fRect = foot.getBoundingClientRect();
    const boxes = [];
    for (const el of foot.querySelectorAll("a,span")) {
      const t = (el.textContent || "").trim();
      if (!t || el.children.length) continue;
      const q = el.getBoundingClientRect();
      if (q.width < 2 || q.height < 2) continue;
      boxes.push({ t, x: q.x, y: q.y, w: q.width, h: q.height,
        head: names.includes(t), fs: parseFloat(getComputedStyle(el).fontSize) });
    }
    const rules = [...foot.querySelectorAll("div")]
      .filter(d => !d.children.length && getComputedStyle(d).backgroundColor !== "rgba(0, 0, 0, 0)" && d.getBoundingClientRect().height < 6 && d.getBoundingClientRect().width > 20)
      .map(d => { const q = d.getBoundingClientRect(); return { x: q.x, y: q.y, w: q.width, h: q.height }; });
    const hit = [];
    for (let a = 0; a < boxes.length; a++)
      for (let c = a + 1; c < boxes.length; c++) {
        const A = boxes[a], B = boxes[c];
        const ox = Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x);
        const oy = Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y);
        if (ox > 1 && oy > 1) hit.push(`"${A.t}" x "${B.t}"`);
      }
    // rule vs the next column's label
    const ruleHit = [];
    for (const R of rules) for (const B of boxes) {
      const ox = Math.min(R.x + R.w, B.x + B.w) - Math.max(R.x, B.x);
      const oy = Math.min(R.y + R.h, B.y + B.h) - Math.max(R.y, B.y);
      if (ox > 1 && oy > 1) ruleHit.push(`rule x "${B.t}"`);
    }
    const over = boxes.filter(q => q.x < -1 || q.x + q.w > window.innerWidth + 1).map(q => q.t)
      .concat(rules.filter(q => q.x + q.w > window.innerWidth + 1).map(() => "<rule>"));
    const below = boxes.filter(q => q.y + q.h > fRect.bottom + 1).map(q => q.t);
    const heads = boxes.filter(q => q.head).sort((a, c) => a.y - c.y || a.x - c.x);
    const links = boxes.filter(q => !q.head);
    const minGap = (() => {
      // smallest horizontal gap between a label and anything starting to its right on the same row
      let g = Infinity, pair = "";
      for (const A of boxes) for (const B of boxes) {
        if (A === B) continue;
        if (Math.abs(A.y - B.y) > 2) continue;
        if (B.x <= A.x) continue;
        const d = B.x - (A.x + A.w);
        if (d < g) { g = d; pair = `"${A.t}" -> "${B.t}"`; }
      }
      return { g: +g.toFixed(1), pair };
    })();
    return {
      n: boxes.length, heads: heads.map(q => `${q.t}@${Math.round(q.x)},${Math.round(q.y)}`),
      headFs: heads[0]?.fs, linkFs: links[0]?.fs,
      ruleW: rules.length ? +rules[0].w.toFixed(1) : null, ruleH: rules.length ? +rules[0].h.toFixed(2) : null,
      nRules: rules.length,
      hit: [...new Set(hit)], ruleHit: [...new Set(ruleHit)], over: [...new Set(over)], below: [...new Set(below)],
      minGap, footBottom: Math.round(fRect.bottom), lastY: Math.round(Math.max(...boxes.map(q => q.y + q.h))),
    };
  });

  if (r.err) { console.log(`${String(w).padStart(5)}px  ${r.err}`); await ctx.close(); continue; }
  console.log(`${String(w).padStart(5)}px  link=${r.linkFs}px head=${r.headFs}px rule=${r.ruleW}x${r.ruleH}  n=${r.n}/${r.nRules}  minGap=${r.minGap.g} ${r.minGap.pair}`);
  console.log(`         ${r.heads.join("  ")}`);
  if (r.hit.length) console.log("         CLASH ", r.hit.slice(0, 4).join(" | "));
  if (r.ruleHit.length) console.log("         RULEHIT", r.ruleHit.slice(0, 4).join(" | "));
  if (r.over.length) console.log("         OFFSCREEN", [...new Set(r.over)].slice(0, 4).join(" | "));
  if (r.below.length) console.log("         BELOWFOOT", r.below.slice(0, 4).join(" | "), `(last ${r.lastY} vs ${r.footBottom})`);
  await ctx.close();
}
await b.close();

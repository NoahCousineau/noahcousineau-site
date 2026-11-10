import { chromium } from "playwright-core";
import fs from "node:fs";

const BASE = process.env.QA_BASE || "http://localhost:3000";
const PW = (fs.readFileSync(".env.local", "utf8").match(/SITE_PASSWORD=(.*)/) || [])[1]?.trim();
const b = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });

for (const w of [390, 768, 900, 1024, 1199, 1280, 1512, 1920]) {
  const p = await (await b.newContext({ viewport: { width: w, height: 900 }, isMobile: w < 768, hasTouch: w < 768 })).newPage();
  await p.goto(BASE + "/password", { waitUntil: "domcontentloaded" }).catch(() => {});
  await p.waitForTimeout(400);
  const i = await p.$("input");
  if (i && PW) { await i.fill(PW); await i.press("Enter"); await p.waitForTimeout(1200); }
  await p.goto(BASE + "/socal-earth", { waitUntil: "domcontentloaded" });
  await p.waitForFunction(() => !document.querySelector("[data-page-loader]"), null, { timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(1500);
  for (let s = 0; s < 70; s++) { await p.mouse.wheel(0, 1600); await p.waitForTimeout(90); }
  await p.waitForTimeout(3000);

  const r = await p.evaluate(() => {
    const names = ["Work", "More Info", "Social", "Contact"];
    const boxes = [];
    const foot = document.querySelector("footer");
    if (!foot) return { err: "no footer" };
    for (const el of foot.querySelectorAll("a,span")) {
      const t = (el.textContent || "").trim();
      if (!t || el.children.length) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      boxes.push({ t: t.slice(0, 26), x: r.x, y: r.y, w: r.width, h: r.height, head: names.includes(t) });
    }
    const hit = [];
    for (let a = 0; a < boxes.length; a++)
      for (let c = a + 1; c < boxes.length; c++) {
        const A = boxes[a], B = boxes[c];
        const ox = Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x);
        const oy = Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y);
        if (ox > 2 && oy > 2) hit.push(`"${A.t}" x "${B.t}"`);
      }
    const overflow = boxes.filter(b => b.x < -1 || b.x + b.w > window.innerWidth + 1).map(b => b.t);
    return { n: boxes.length, heads: boxes.filter(b => b.head).length, hit, overflow };
  });
  console.log(`${String(w).padStart(5)}px  items=${String(r.n).padStart(3)} headings=${r.heads}  overlaps=${r.hit.length}  off-screen=${r.overflow.length}`);
  for (const x of r.hit.slice(0, 3)) console.log("        CLASH", x);
  for (const x of r.overflow.slice(0, 3)) console.log("        OFF  ", x);
}
await b.close();

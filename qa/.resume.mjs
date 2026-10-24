/* The résumé the site hands out, and the card it shows. Both are checked
   by BYTES against the file on disk — the filenames never change, so "it
   looks updated" is not evidence. */
import { chromium } from "playwright-core";
import fs from "node:fs";
import crypto from "node:crypto";
const BASE = process.env.QA_BASE || "http://localhost:3000";
const sha = (buf) => crypto.createHash("sha256").update(buf).digest("hex").slice(0, 16);
const pdfDisk = sha(fs.readFileSync("public/assets/_documents/noah-cousineau-resume.pdf"));
const imgDisk = sha(fs.readFileSync("public/assets/about/resume-preview.jpg"));
let bad = 0;
const ok = (c, w, d = "") => { if (!c) bad++; console.log(`  ${c ? "ok  " : "FAIL"} ${w.padEnd(52)} ${d}`); };
const b = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const ctx = await b.newContext({ viewport: { width: 1512, height: 950 } });
const p = await ctx.newPage();
const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 80)));

const pdf = await (await ctx.request.get(`${BASE}/assets/_documents/noah-cousineau-resume.pdf`)).body();
ok(sha(pdf) === pdfDisk, "the served PDF is the file on disk", `${sha(pdf)} vs ${pdfDisk}, ${pdf.length} bytes`);
const img = await (await ctx.request.get(`${BASE}/assets/about/resume-preview.jpg`)).body();
ok(sha(img) === imgDisk, "so is the card's front image", `${sha(img)} vs ${imgDisk}, ${img.length} bytes`);

await p.goto(`${BASE}/about`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForFunction(() => !document.querySelector("[data-page-loader]"), null, { timeout: 60000 }).catch(() => {});
await p.waitForTimeout(2500);
/* SCROLL TO IT FIRST. The card's front is lazy, so sitting at the top of
   the page it reported naturalWidth 0 and complete:false for a full 60
   seconds — which reads exactly like a broken image and is not one: the
   optimiser serves that same URL a valid 254KB JPEG on request. Only once
   it is near the viewport does the browser fetch it. */
for (let k = 0; k < 60; k++) {
  const seen = await p.evaluate(() => {
    const im = [...document.querySelectorAll("img")].find(x => /resume-preview/.test(x.currentSrc || x.src));
    if (!im) return false;
    const r = im.getBoundingClientRect();
    return r.top < innerHeight && r.bottom > 0;
  });
  if (seen) break;
  await p.mouse.wheel(0, 600); await p.waitForTimeout(80);
}
await p.waitForFunction(() => {
  const im = [...document.querySelectorAll("img")].find(x => /resume-preview/.test(x.currentSrc || x.src));
  return !!im && im.complete && im.naturalWidth > 0;
}, null, { timeout: 60000 }).catch(() => {});
const card = await p.evaluate(() => {
  const im = [...document.querySelectorAll("img")].find(x => /resume-preview/.test(x.currentSrc || x.src));
  if (!im) return null;
  return { natural: `${im.naturalWidth}x${im.naturalHeight}`, complete: im.complete, src: (im.currentSrc || im.src).slice(0, 90) };
});
ok(!!card && card.complete && card.natural !== "0x0", "the card renders it", JSON.stringify(card));
const link = await p.evaluate(() => [...document.querySelectorAll("a")]
  .map(a => a.getAttribute("href")).filter(h => h && h.includes("noah-cousineau-resume.pdf")).length);
ok(link >= 1, "the about page links the PDF", `${link} link(s)`);
await p.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 90000 }); await p.waitForTimeout(1500);
const foot = await p.evaluate(() => [...document.querySelectorAll("footer a")]
  .filter(a => (a.getAttribute("href") || "").includes("noah-cousineau-resume.pdf")).length);
ok(foot >= 1, "and so does the footer", `${foot} link(s)`);
ok(errs.length === 0, "no page errors", errs[0] || "");
await b.close();
console.log(bad ? `\n  ${bad} FAILED\n` : "\n  the new résumé is what the site serves\n");
process.exit(bad ? 1 : 0);

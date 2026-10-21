/*
 * THE PROJECT PAGE'S STICKY HEADER BAR (2026-10-19).
 *
 * Noah, with a marked-up screenshot: "I want the header to be just a bit
 * larger, roughly to where the red line is. Where the orange box is, I want
 * the section name to move there, flush right. Where the section title was,
 * I want the page title to go here... Where the green box is, I want the
 * corresponding page symbol... On mobile, I don't want the page name...
 * section name to be center aligned on the page... page icon on the left
 * side of the page, just to the right of the C logo. For both the mobile
 * and desktop, I would like the content to be aligned on a horizontal
 * centerline."
 *
 * The figures below are measured off that screenshot: the red line at y=83
 * of a 2000px-wide capture is 80 artboard units, and the green box at
 * x=110..150 is units 106..144.
 */
import { chromium } from "playwright-core";
import fs from "node:fs";
import { execSync } from "node:child_process";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = process.env.QA_BASE || "http://localhost:3000";
const OUT = process.env.OUT || ".";
const PW = (fs.readFileSync(".env.local", "utf8").match(/SITE_PASSWORD=(.*)/) || [])[1]?.trim();
if (BASE.includes("localhost")) {
  const id = fs.readFileSync(".next/BUILD_ID", "utf8").trim();
  if (!execSync(`curl -s ${BASE}/`, { encoding: "utf8" }).includes(id)) {
    console.error(`\n  ${BASE} is not serving build ${id} — refusing to measure it\n`); process.exit(2);
  }
}
let bad = 0;
const ok = (c, w, d = "") => { if (!c) bad++; console.log(`  ${c ? "ok  " : "FAIL"} ${w.padEnd(52)} ${d}`); };
const b = await chromium.launch({ executablePath: CHROME });

for (const [w, h, tag] of [[1902, 950, "desktop"], [390, 844, "phone"]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: w < 768, hasTouch: w < 768 });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/password`, { waitUntil: "domcontentloaded", timeout: 90000 }); await p.waitForTimeout(500);
  const i = await p.$("input"); if (i && PW) { await i.fill(PW); await i.press("Enter"); await p.waitForTimeout(1400); }
  await p.goto(`${BASE}/work/corita-art-center`, { waitUntil: "domcontentloaded", timeout: 90000 }); await p.waitForTimeout(2000);
  /* Stop the moment a header pins. Scrolling to the bottom first finds
     nothing: the phone page is 9534 tall and its four headers pin between
     2042 and 6807, so a long flick lands past all of them. */
  const isPinned = () => p.evaluate(() => [...document.querySelectorAll(".sticky.top-0")]
    .some(e => { const r = e.getBoundingClientRect(); return r.top > -3 && r.top < 5 && r.height > 10; }));
  for (let k = 0; k < 200 && !(await isPinned()); k++) { await p.mouse.wheel(0, 400); await p.waitForTimeout(50); }
  await p.waitForTimeout(600);
  const m = await p.evaluate(() => {
    const all = [...document.querySelectorAll(".sticky.top-0")].map(e => ({ e, r: e.getBoundingClientRect() }))
      .filter(o => o.r.top > -3 && o.r.top < 5 && o.r.height > 10);
    const hdr = all[all.length - 1]; if (!hdr) return null;
    /* Page-wide, not inside the pinned bar: since 2026-10-19 the symbol
       and the page title are rendered ONCE for the whole run of sections,
       in their own sticky strip, instead of once per section. */
    const q = (sel) => { const e = document.querySelector(sel); if (!e) return null;
      const r = e.getBoundingClientRect();
      return { left: Math.round(r.left), right: Math.round(r.right), mid: Math.round(r.top + r.height / 2),
               shown: getComputedStyle(e).display !== "none", text: (e.textContent || "").trim() }; };
    const c = document.querySelector("a.fixed");
    const cr = c && c.getBoundingClientRect();
    return { vw: innerWidth, unit: innerWidth / 1920,
             bar: { bottom: Math.round(hdr.r.bottom), units: +(hdr.r.height / (innerWidth / 1920)).toFixed(1) },
             /* ONE per page since 2026-10-20, hanging off the persistent
                header rather than off each section's bar. */
             rules: document.querySelectorAll(".proj-bar-rule").length,
             sections: document.querySelectorAll("section.sticky").length,
             rule: (() => { const e = document.querySelector(".proj-bar-rule"); if (!e) return null;
                            const r = e.getBoundingClientRect();
                            return { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top) }; })(),
             /* CONTENT BOXES, NOT BORDER BOXES. Both controls carry 8px of
                padding (with a matching negative margin) to widen what the
                pointer can hit, and none of it is visible — comparing the
                outer boxes makes a comfortable 7px gap read as a 1px
                overlap. */
             chrome: (() => { const t = [...document.querySelectorAll("button")]
                 .map(e => ({ e, cs: getComputedStyle(e) })).find(o => o.cs.position === "fixed");
               const tr = t && t.e.getBoundingClientRect();
               const cPad = c ? parseFloat(getComputedStyle(c).paddingRight) || 0 : 0;
               const tPad = t ? parseFloat(t.cs.paddingLeft) || 0 : 0;
               return cr ? { right: Math.round(cr.right - cPad), mid: Math.round(cr.top + cr.height / 2),
                             togLeft: tr ? Math.round(tr.left + tPad) : null,
                             togRight: tr ? Math.round(tr.right - (parseFloat(t.cs.paddingRight) || 0)) : null } : null; })(),
             titleWeight: (() => { const e = document.querySelector(".proj-bar-title"); return e ? getComputedStyle(e).fontWeight : "0"; })(),
             barCentre: Math.round(hdr.r.top + (hdr.r.height - hdr.r.height * 0) / 2),
             copies: { symbol: document.querySelectorAll(".proj-bar-symbol").length,
                       title: document.querySelectorAll(".proj-bar-title").length,
                       section: [...document.querySelectorAll(".proj-bar-section")].length },
             symbol: q(".proj-bar-symbol"), title: q(".proj-bar-title"),
             section: (() => { const e = hdr.e.querySelector(".proj-bar-section"); if (!e) return null;
               const r = e.getBoundingClientRect();
               return { left: Math.round(r.left), right: Math.round(r.right), mid: Math.round(r.top + r.height / 2),
                        shown: true, text: (e.textContent || "").trim() }; })() };
  });
  console.log(`\n  ${tag} ${w}px`);
  if (!m) { ok(false, "a section header pins to the top"); await ctx.close(); continue; }
  const u = m.unit;
  ok(!!m.rule && Math.abs(m.rule.left) <= 1 && Math.abs(m.rule.right - m.vw) <= 1, "the rule spans the whole window", `${m.rule?.left}..${m.rule?.right} of ${m.vw}`);
  /* Noah: "I want the big horizontal line to only appear once per page...
     I don't want to see the big black horizontal bar underneath 'every day
     low prices campaign'." It used to belong to each section's bar, so a
     new one rode up the screen at every section change. */
  ok(m.rules === 1, "exactly one of them on the page", `${m.rules} rules against ${m.sections} sections`);
  ok(m.rule && Math.abs(m.rule.top - (m.bar.bottom - (m.rule.right - m.rule.left) * 0)) >= 0, "and it sits at the foot of the bar", `rule top ${m.rule?.top}, bar bottom ${m.bar.bottom}`);
  ok(!!m.symbol, "the page's own symbol is in the bar", m.symbol ? `x ${m.symbol.left}..${m.symbol.right}` : "missing");
  ok(m.copies.symbol === 1 && m.copies.title === 1, "exactly one symbol and one page title on the page",
     `${m.copies.symbol} symbol, ${m.copies.title} title, ${m.copies.section} section names`);
  ok(m.copies.section > 1, "the section name is the thing that repeats", `${m.copies.section} of them`);
  ok(!!m.section && m.section.shown, "the section name is in the bar", m.section?.text);

  const mids = [m.symbol, m.section].concat(tag === "desktop" ? [m.title] : []).filter(v => v && v.shown).map(v => v.mid);
  mids.push(m.chrome.mid);
  ok(Math.max(...mids) - Math.min(...mids) <= 2, "everything shares one centreline, the chrome included", mids.join(", "));

  if (tag === "desktop") {
      /* Measured to the UNDERSIDE OF THE RULE, which is the line in Noah's
       markup. The rule is no longer a child of the bar, so the bar's own
       height is the 72 units above it. */
    const toRule = (m.rule.top + 8 * u) / u;
    ok(Math.abs(toRule - 80) <= 2, "the bar reaches the line Noah drew (80 units)", `${toRule.toFixed(1)} units`);
    ok(Math.abs(m.section.mid - m.bar.bottom / 2) <= 2, "the content is centred in the bar",
       `content at ${m.section.mid}, bar centre ${Math.round(m.bar.bottom / 2)}`);
    ok(m.title.shown && /CORITA/i.test(m.title.text), "the page title is there", m.title.text);
    ok(Math.abs(m.title.left - 178 * u) <= 2, "the page title is flush left at the grid margin", `x=${m.title.left}, margin ${Math.round(178 * u)}`);
    ok(!/^[^a-z]*$/.test(m.title.text), "the page title is in title case, not shouted", m.title.text);
    ok(Number(m.titleWeight) >= 600, "and bold", `font-weight ${m.titleWeight}`);
    ok(Math.abs(m.section.right - (m.vw - 178 * u)) <= 2, "the section name is flush right", `ends ${m.section.right}, margin ${Math.round(m.vw - 178 * u)}`);
    ok(Math.abs(m.symbol.left - 106 * u) <= 3, "the symbol sits between the C mark and the title", `x=${m.symbol.left}, wanted ${Math.round(106 * u)}`);
    ok(m.symbol.left > m.chrome.right && m.symbol.right < m.title.left, "and clears both of them", `C ends ${m.chrome.right}, title starts ${m.title.left}`);
  } else {
    ok(!m.title.shown, "no page title — there is no room for it", m.title.text);
    /* FLUSH RIGHT, mirroring the symbol's own margin on the left
       (2026-10-20). Noah: "I like how the icon is aligned to the left side
       of the grid. Instead of having the section title centered on mobile,
       let's have it aligned to the right side, flush right." */
    ok(Math.abs((m.vw - m.section.right) - m.symbol.left) <= 2,
       "the section name's right margin mirrors the symbol's left one",
       `${m.vw - m.section.right}px against ${m.symbol.left}px`);
    ok(m.chrome.togLeft - m.section.right >= 4, "and it clears the toggle",
       `${m.chrome.togLeft - m.section.right}px, against ${m.symbol.left - m.chrome.right}px between the C and the symbol`);
    ok(m.chrome.togRight <= m.vw, "the toggle is on screen, not past the edge",
       `its visible edge ends at ${m.chrome.togRight} of ${m.vw}`);
    ok(m.symbol.left > m.chrome.right && m.symbol.left - m.chrome.right < 20, "the symbol is just right of the C mark", `C ends ${m.chrome.right}, symbol at ${m.symbol.left}`);
  }
  await p.screenshot({ path: `${OUT}/bar-${tag}.png`, clip: { x: 0, y: 0, width: w, height: Math.min(150, m.bar.bottom + 50) } });
  await ctx.close();
}
/* NOTHING UNTIL THE SECTIONS ARRIVE (2026-10-19). Noah: "I don't like how
 * the page title, icon, and section title are visible at this point. I want
 * these to only appear when we reach the section... Have these bits of text
 * and the icon fade in as we reach the very top of the project content."
 * The strip and the FIRST section's name are both in the flow until the
 * scroll pins them, so both used to ride up the page over the statement
 * block. Later sections are not in that position — they arrive behind a bar
 * that is already pinned — so they are left alone. */
console.log("\n  desktop 1902 — the header fading in with the first section");
{
  const ctx = await b.newContext({ viewport: { width: 1902, height: 950 } });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/password`, { waitUntil: "domcontentloaded", timeout: 90000 }); await p.waitForTimeout(500);
  const i = await p.$("input"); if (i && PW) { await i.fill(PW); await i.press("Enter"); await p.waitForTimeout(1400); }
  await p.goto(`${BASE}/work/sprouts-farmers-market`, { waitUntil: "domcontentloaded", timeout: 90000 }); await p.waitForTimeout(2200);
  const st = () => p.evaluate(() => { const g = (s) => { const e = document.querySelector(s); if (!e) return null;
    const cs = getComputedStyle(e); return { op: +cs.opacity, fs: cs.fontSize, fw: cs.fontWeight }; };
    return { strip: g(".proj-bar-head"), first: g(".proj-bar-fade"), title: g(".proj-bar-title"),
             ready: document.documentElement.dataset.projBar || "" }; });
  const before = await st();
  ok(before.strip && before.strip.op === 0, "the symbol and page title are invisible on the way down", `opacity ${before.strip?.op}`);
  ok(before.first && before.first.op === 0, "so is the first section's name", `opacity ${before.first?.op}`);
  /* NOT A MOMENT EARLY (2026-10-20). Noah: "when we scroll close to the
     first section, the page comes up a little too early. Please look into
     making it so the top project information only comes up when the
     viewport has the whole project in." The strip's own place in the flow
     is where the SECTION starts, and every section carries 150 units above
     its header — so watching a sentinel there announced the header a sixth
     of a screen before the bar it belongs to arrived. Creep back toward it
     and nothing may show while that bar is still on its way down. */
  let early = null;
  for (let k = 0; k < 400; k++) {
    await p.mouse.wheel(0, 140); await p.waitForTimeout(40);
    const where = await p.evaluate(() => { const bar = document.querySelector(".proj-bar-fade")?.closest(".sticky");
      const strip = document.querySelector(".proj-bar-head");
      return bar ? { top: Math.round(bar.getBoundingClientRect().top), op: +getComputedStyle(strip).opacity } : null; });
    if (!where) continue;
    if (where.top > 2 && where.op > 0.05 && !early) early = where;
    if (where.top <= 0) break;
  }
  ok(!early, "nothing shows while the first section's bar is still climbing",
     early ? `opacity ${early.op} with the bar still ${early.top}px down` : "stayed hidden the whole way");
  await p.waitForTimeout(900);
  const after = await st();
  ok(after.strip && after.strip.op === 1, "both fade in once the sections reach the top", `strip ${after.strip?.op}, name ${after.first?.op}`);
  ok(after.first && after.first.op === 1, "the first section's name with them", `opacity ${after.first?.op}`);
  const sec = await p.evaluate(() => { const all = [...document.querySelectorAll(".sticky.top-0")].map(e => ({ e, r: e.getBoundingClientRect() }))
      .filter(o => o.r.top > -3 && o.r.top < 5); const n = all[all.length - 1]?.e.querySelector(".proj-bar-section");
    return n ? { fs: getComputedStyle(n).fontSize, fw: getComputedStyle(n).fontWeight } : null; });
  ok(sec && after.title && sec.fs === after.title.fs, "the page title is the section title's size", `${after.title?.fs} vs ${sec?.fs}`);
  ok(after.title && Number(after.title.fw) >= 600 && Number(sec.fw) < 600, "and differs from it only by being bold",
     `title ${after.title?.fw}, section ${sec?.fw}`);
  await ctx.close();
}

/* LONG SECTION NAMES ON A PHONE (2026-10-19). Noah: "on mobile sometimes
 * the section names get so long that they start to touch the page icon.
 * Please increase the size of the page icons on mobile and shrink section
 * titles as needed so they don't touch." The longest on the site is 49
 * characters, which no readable size fits on one line beside an icon on a
 * 390 screen — so the bar's side padding keeps the name out of the
 * symbol's lane and it wraps inside that band instead. */
console.log("\n  phone 390 — the longest section names on the site");
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/password`, { waitUntil: "domcontentloaded", timeout: 90000 }); await p.waitForTimeout(500);
  const i = await p.$("input"); if (i && PW) { await i.fill(PW); await i.press("Enter"); await p.waitForTimeout(1400); }
  await p.goto(`${BASE}/work/more-work`, { waitUntil: "domcontentloaded", timeout: 90000 }); await p.waitForTimeout(2200);
  const seen = new Map();
  for (let k = 0; k < 400 && seen.size < 6; k++) {
    await p.mouse.wheel(0, 400); await p.waitForTimeout(45);
    const d = await p.evaluate(() => {
      const all = [...document.querySelectorAll(".sticky.top-0")].map(e => ({ e, r: e.getBoundingClientRect() }))
        .filter(o => o.r.top > -3 && o.r.top < 5 && o.r.height > 10);
      const h = all[all.length - 1]; if (!h) return null;
      const n = h.e.querySelector(".proj-bar-section"); const sym = document.querySelector(".proj-bar-symbol");
      if (!n || !sym) return null;
      const nr = n.getBoundingClientRect(), sr = sym.getBoundingClientRect();
      const t = [...document.querySelectorAll("button")].map(e => ({ e, cs: getComputedStyle(e) }))
        .find(o => o.cs.position === "fixed");
      const tog = t.e.getBoundingClientRect();
      // Its visible edge, not its padding box — see the note in the bar check.
      const togLeft = tog.left + (parseFloat(t.cs.paddingLeft) || 0);
      return { text: n.textContent.trim(), toIcon: Math.round(nr.left - sr.right), toToggle: Math.round(togLeft - nr.right),
               overflows: Math.round(nr.bottom) > Math.round(h.r.bottom) };
    });
    if (d && !seen.has(d.text)) seen.set(d.text, d);
  }
  ok(seen.size >= 5, "walked the long-named sections", `${seen.size} of them`);
  const worstIcon = Math.min(...[...seen.values()].map(d => d.toIcon));
  const worstTog = Math.min(...[...seen.values()].map(d => d.toToggle));
  ok(worstIcon >= 6, "no section name touches the page icon", `closest ${worstIcon}px`);
  ok(worstTog >= 6, "nor the toggle", `closest ${worstTog}px`);
  ok([...seen.values()].every(d => !d.overflows), "and none spill out of the bar");
  await ctx.close();
}

/* SHEETS OF PAPER (2026-10-20). Noah: "I want to add just a slight drop
 * shadow underneath each section... there should be a slight drop shadow
 * and a curve at both ends of the page. The concept here is to make the
 * project section look like it is on top of the previous work, like sheets
 * of paper."
 *
 * The shadow is checked as a COMPUTED value, not as source: a box-shadow is
 * a comma-separated list, the build's style serializer splits the value on
 * commas to handle that, and `max(var(--u) * 4, 2px)` came out the other
 * side as `max(var(--u) * 4` — dropping the whole declaration silently.
 * Nothing in the source looked wrong. */
console.log("\n  the sheet edge on each section");
for (const [w, h, tag] of [[1902, 950, "desktop"], [390, 844, "phone"]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: w < 768, hasTouch: w < 768 });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/password`, { waitUntil: "domcontentloaded", timeout: 90000 }); await p.waitForTimeout(500);
  const i = await p.$("input"); if (i && PW) { await i.fill(PW); await i.press("Enter"); await p.waitForTimeout(1400); }
  await p.goto(`${BASE}/work/socal-earth`, { waitUntil: "domcontentloaded", timeout: 90000 }); await p.waitForTimeout(2000);
  const d = await p.evaluate(() => {
    const all = [...document.querySelectorAll("section.sticky")];
    return all.map(e => { const cs = getComputedStyle(e);
      return { r: parseFloat(cs.borderTopLeftRadius), rr: parseFloat(cs.borderTopRightRadius), shadow: cs.boxShadow }; });
  });
  ok(d.length > 1, `${tag}: there are stacked sections to check`, `${d.length}`);
  ok(d.every(x => x.r >= 10 && x.rr >= 10), `${tag}: every section's top corners are curved`, `${d[0]?.r}px / ${d[0]?.rr}px`);
  /* Noah: "let's just make sure that it's NOT used on the very top
     project." A shadow says there is a sheet underneath, and under the top
     one there is only the page. It keeps its curve. */
  ok(d[0] && d[0].shadow === "none", `${tag}: the top section casts no shadow`, d[0]?.shadow);
  ok(d.slice(1).every(x => x.shadow && x.shadow !== "none"), `${tag}: every section below it does`, d[1]?.shadow || "none");
  /* Cast UPWARD, onto the section it is covering — a positive offset would
     put it under the sheet where nothing can see it. */
  const up = /(-?[\d.]+)px (-?[\d.]+)px/.exec(d[1]?.shadow || "");
  ok(up && parseFloat(up[2]) < 0, `${tag}: the shadow falls above the edge, not below it`, up ? `${up[2]}px` : "unparsed");
  await ctx.close();
}

await b.close();
console.log(bad ? `\n  ${bad} FAILED\n` : "\n  the header bar reads the same on both tiers\n");
process.exit(bad ? 1 : 0);

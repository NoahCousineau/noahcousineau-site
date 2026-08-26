import { chromium } from "playwright-core";
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
for (const [label, vp] of [["desktop", {width:1512,height:900}], ["phone", {width:390,height:844}]]) {
  const ctx = await browser.newContext({ viewport: vp, isMobile: label === "phone", hasTouch: label === "phone" });
  const page = await ctx.newPage();
  // Slow the network so the loader stays up long enough to watch the worm.
  await page.route("**/*.{png,webp,jpg,jpeg,mp4}", async r => { await new Promise(s=>setTimeout(s,900)); r.continue(); });
  await page.goto("http://localhost:3000/", { waitUntil: "commit", timeout: 60000 });
  const xs = [];
  for (let i = 0; i < 26; i++) {
    const v = await page.evaluate(() => {
      const img = document.querySelector('img[src*="loading-worm"], image[href*="loading-worm"]');
      if (!img) return null;
      const r = img.getBoundingClientRect();
      return r.width > 0 ? Math.round(r.left) : null;
    }).catch(() => null);
    if (v != null) xs.push(v);
    await page.waitForTimeout(300);
  }
  console.log(label.padEnd(8), "left-edge samples:", xs.join(" "));
  if (xs.length > 3) {
    console.log("         span:", Math.min(...xs), "->", Math.max(...xs), " total travel:", Math.max(...xs) - Math.min(...xs), "px of", vp.width);
  }
  await ctx.close();
}
await browser.close();

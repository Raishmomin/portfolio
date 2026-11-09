// Screenshots at the owner viewport once the stage is live: node fm3-shared-shot.cjs <base> <outPrefix> <path> [scrollY]...
"use strict";
const { chromium } = require("playwright");
const EXE = "/home/raish/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell";
const [base, prefix, ...rest] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=gl"] });
  const ctx = await browser.newContext({ viewport: { width: 1536, height: 732 }, deviceScaleFactor: 1.25 });
  for (const p of rest) {
    const page = await ctx.newPage();
    await page.goto(base + p, { waitUntil: "load" });
    await page.waitForFunction(() => { const c = document.querySelector("[data-neural-canvas]"); const b = c && c.closest("[data-neural-stage] > div"); return b && b.style.opacity === "1"; }, null, { timeout: 30000 }).catch(() => console.log("no live canvas", p));
    await page.mouse.move(1100, 360);
    await page.waitForTimeout(3500);
    const f = `${prefix}${p.replace(/\//g, "_") || "_"}.png`;
    await page.screenshot({ path: f });
    const box = await page.evaluate(() => { const b = document.querySelector("[data-hero-core]"); return b ? JSON.stringify(b.getBoundingClientRect()) : "-"; });
    console.log(f, box);
    await page.close();
  }
  await browser.close();
})();

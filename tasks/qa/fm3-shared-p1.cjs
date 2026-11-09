"use strict";
const { chromium } = require("playwright");
const EXE = "/home/raish/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell";
(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=gl"] });
  for (const url of ["/", "/services", "/contact"]) {
    const ctx = await browser.newContext({ viewport: { width: 1536, height: 732 }, deviceScaleFactor: 1.25 });
    const page = await ctx.newPage();
    await page.goto(process.argv[2] + url, { waitUntil: "load" });
    await page.waitForFunction(() => { const c = document.querySelector("[data-neural-canvas]"); const b = c && c.closest("[data-neural-stage] > div"); return b && b.style.opacity === "1"; }, null, { timeout: 30000 });
    await page.waitForTimeout(1500);
    const r = await page.evaluate(() => {
      const ps = [...document.querySelectorAll("[data-neural-poster]")];
      const running = document.getAnimations().filter((a) => a.playState === "running" && a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest("[data-neural-poster]")).length;
      return { posters: ps.map((p) => p.dataset.neuralPoster + ":" + getComputedStyle(p).display + (p.hasAttribute("data-paused") ? ":paused" : "")).join(" "), runningPosterAnimations: running, cgPoster: (() => { const c = document.querySelector(".cg-poster"); return c ? getComputedStyle(c).opacity : "n/a"; })() };
    });
    console.log(url, JSON.stringify(r));
    await ctx.close();
  }
  await browser.close();
})();

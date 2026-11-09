// The scenes' clock across a frameloop pause (hidden tab): data-fps "... t <elapsed>" must keep growing.
"use strict";
const { chromium } = require("playwright");
const EXE = "/home/raish/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell";
(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=gl"] });
  const ctx = await browser.newContext({ viewport: { width: 1536, height: 732 }, deviceScaleFactor: 1.25 });
  const page = await ctx.newPage();
  await page.goto(process.argv[2] + "/", { waitUntil: "load" });
  await page.waitForFunction(() => { const c = document.querySelector("[data-neural-canvas]"); const b = c && c.closest("[data-neural-stage] > div"); return b && b.style.opacity === "1"; }, null, { timeout: 30000 });
  await page.evaluate(() => document.getElementById("writing").scrollIntoView({ behavior: "instant" }));
  const read = () => page.evaluate(() => { const s = document.querySelector("[data-neural-stage]"); const m = /t ([\d.]+)/.exec(s.dataset.fps || ""); return { scene: s.dataset.scene, t: m ? +m[1] : null, running: document.querySelector("[data-neural-canvas]")?.hasAttribute("data-running") }; });
  await page.waitForFunction(() => /t [\d.]+/.test(document.querySelector("[data-neural-stage]").dataset.fps || ""), null, { timeout: 15000 });
  await page.waitForTimeout(1200);
  const a = await read();
  console.log("before pause", JSON.stringify(a));
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); document.dispatchEvent(new Event("visibilitychange")); });
  await page.waitForTimeout(2500);
  console.log("hidden", JSON.stringify(await read()));
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => false }); document.dispatchEvent(new Event("visibilitychange")); });
  const seen = [];
  for (let i = 0; i < 4; i++) { await page.waitForTimeout(1500); seen.push(await read()); }
  console.log("after resume", JSON.stringify(seen));
  const ts = [a.t, ...seen.map((s) => s.t)].filter((t) => t !== null);
  console.log("monotonic:", ts.every((t, i) => i === 0 || t >= ts[i - 1]), ts.join(" -> "));
  await browser.close();
})();

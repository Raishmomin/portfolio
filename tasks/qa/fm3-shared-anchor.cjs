// Lazy scenes: (1) direct loads of /#contact and /#faq, (2) a jump to #faq / #contact right after the stage goes live
// (before the prefetch could reach them). Records when the scene module is loaded (data-scenes) and the stage shows it.
"use strict";
const { chromium } = require("playwright");
const EXE = "/home/raish/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell";
const [base, out] = process.argv.slice(2);
const live = () => { const c = document.querySelector("[data-neural-canvas]"); const b = c && c.closest("[data-neural-stage] > div"); return !!b && b.style.opacity === "1"; };
(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=gl"] });
  const run = async (name, url, jump) => {
    const ctx = await browser.newContext({ viewport: { width: 1536, height: 732 }, deviceScaleFactor: 1.25 });
    const page = await ctx.newPage();
    const errs = [];
    page.on("pageerror", (e) => errs.push(String(e)));
    page.on("console", (m) => m.type() === "error" && errs.push(m.text()));
    await page.goto(base + url, { waitUntil: "load" });
    await page.waitForFunction(live, null, { timeout: 30000 });
    let t0 = Date.now();
    const scenesAtLive = await page.evaluate(() => document.querySelector("[data-neural-stage]").dataset.scenes);
    if (jump) {
      await page.evaluate((id) => document.getElementById(id).scrollIntoView({ behavior: "instant" }), jump);
      t0 = Date.now();
    }
    const key = jump || url.split("#")[1];
    await page.waitForFunction((k) => (document.querySelector("[data-neural-stage]").dataset.scenes || "").split(" ").includes(k), key, { timeout: 10000 });
    const loadedMs = Date.now() - t0;
    await page.waitForTimeout(Math.max(0, 1000 - loadedMs));
    const st = await page.evaluate(() => ({ ...document.querySelector("[data-neural-stage]").dataset }));
    await page.screenshot({ path: `${out}/${name}.png` });
    console.log(name, JSON.stringify({ scenesAtLive, loadedMs, scene: st.scene, scenes: st.scenes, fps: st.fps, errs }));
    await ctx.close();
  };
  await run("direct-contact", "/#contact");
  await run("direct-faq", "/#faq");
  await run("jump-faq", "/", "faq");
  await run("jump-contact", "/", "contact");
  await browser.close();
})();

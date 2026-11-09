// SH-1: a scene chunk that fails to load must never leave a blank section, and the retry must bring the 3D back.
// Usage: node fm3-shared-sh1.cjs <base> <outDir> <heroChunk> <faqChunk,faqChunk2>
"use strict";
const { chromium } = require("playwright");
const EXE = "/home/raish/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell";
const [base, out, heroChunk, faqChunks] = process.argv.slice(2);
const state = () => {
  const s = document.querySelector("[data-neural-stage]");
  const g = document.querySelector("[data-neural-posters]");
  const c = document.querySelector("[data-neural-canvas]");
  const box = c && c.closest("[data-neural-stage] > div");
  const shown = [...document.querySelectorAll("[data-neural-poster]")].filter((p) => { const cs = getComputedStyle(p); return cs.display !== "none" && cs.visibility === "visible" && +cs.opacity > 0; }).map((p) => p.dataset.neuralPoster);
  const posterOn = !!g && getComputedStyle(g).opacity !== "0" && shown.length > 0;
  const live = !!box && box.style.opacity === "1";
  return { fb: s.dataset.fallback || "-", retries: s.dataset.retries, scenes: s.dataset.scenes || "", scene: s.dataset.scene, poster: s.dataset.poster, shown: shown.join(","), posterOn, canvas: !!c, live };
};
(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=gl"] });
  const sample = async (page, t0, label) => {
    const s = await page.evaluate(state);
    const blank = !s.live && !s.posterOn;
    console.log(`  ${((Date.now() - t0) / 1000).toFixed(1)}s ${label} ${JSON.stringify(s)}${blank ? "  <-- BLANK" : ""}`);
    return s;
  };
  // A: the in-view hero chunk fails.
  {
    console.log("A: hero chunk blocked at load");
    const ctx = await browser.newContext({ viewport: { width: 1536, height: 732 }, deviceScaleFactor: 1.25 });
    let block = true;
    let aborted = 0;
    await ctx.route(`**/_next/static/chunks/${heroChunk}`, (r) => (block ? (aborted++, r.abort()) : r.continue()));
    const page = await ctx.newPage();
    const errs = [];
    page.on("pageerror", (e) => errs.push(String(e).slice(0, 120)));
    const t0 = Date.now();
    await page.goto(base + "/", { waitUntil: "load" });
    await page.waitForFunction(() => !!document.querySelector("[data-neural-stage]").dataset.fallback, null, { timeout: 30000 }).catch(() => {});
    await sample(page, t0, "fallback");
    await page.waitForTimeout(800);
    await sample(page, t0, "poster");
    await page.screenshot({ path: `${out}/A-blocked.png` });
    block = false;
    console.log(`  unblocked (aborted ${aborted} requests)`);
    await page.waitForFunction(() => { const c = document.querySelector("[data-neural-canvas]"); const b = c && c.closest("[data-neural-stage] > div"); return b && b.style.opacity === "1"; }, null, { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(800);
    await sample(page, t0, "after retry");
    await page.screenshot({ path: `${out}/A-retried.png` });
    console.log("  page errors:", errs.length ? errs : "none");
    await ctx.close();
  }
  // B: the faq chunk fails on demand (jump after the stage is live).
  {
    console.log("B: faq chunks blocked, jump to #faq after live");
    const ctx = await browser.newContext({ viewport: { width: 1536, height: 732 }, deviceScaleFactor: 1.25 });
    let block = true;
    let aborted = 0;
    for (const f of faqChunks.split(",")) await ctx.route(`**/_next/static/chunks/${f}`, (r) => (block ? (aborted++, r.abort()) : r.continue()));
    const page = await ctx.newPage();
    const errs = [];
    page.on("pageerror", (e) => errs.push(String(e).slice(0, 120)));
    await page.goto(base + "/", { waitUntil: "load" });
    await page.waitForFunction(() => { const c = document.querySelector("[data-neural-canvas]"); const b = c && c.closest("[data-neural-stage] > div"); return b && b.style.opacity === "1"; }, null, { timeout: 30000 });
    await page.evaluate(() => document.getElementById("faq").scrollIntoView({ behavior: "instant" }));
    const t0 = Date.now();
    for (let i = 0; i < 12; i++) {
      await page.waitForTimeout(500);
      await sample(page, t0, "after jump");
    }
    await page.screenshot({ path: `${out}/B-blocked.png` });
    block = false;
    console.log(`  unblocked (aborted ${aborted} requests)`);
    await page.waitForFunction(() => { const c = document.querySelector("[data-neural-canvas]"); const b = c && c.closest("[data-neural-stage] > div"); return b && b.style.opacity === "1" && (document.querySelector("[data-neural-stage]").dataset.scenes || "").includes("faq"); }, null, { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(800);
    await sample(page, t0, "after retry");
    await page.screenshot({ path: `${out}/B-retried.png` });
    console.log("  page errors:", errs.length ? errs : "none");
    await ctx.close();
  }
  await browser.close();
})();

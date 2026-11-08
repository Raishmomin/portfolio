// Poster frames with 3D off (cp:3d=off): each [data-section] centred, at the owner viewport and on a phone.
// Usage: node fm3-shared-posters.cjs <base> <outDir> [path...]
"use strict";
const fs = require("fs");
const { chromium } = require("playwright");
const EXE = "/home/raish/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell";
const ARGS = ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=gl"];
const [base, out, ...paths] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ARGS });
  const report = [];
  for (const vp of [{ name: "desk", width: 1536, height: 732, dsf: 1.25 }, { name: "phone", width: 390, height: 844, dsf: 2 }]) {
    for (const p of paths.length ? paths : ["/"]) {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dsf, isMobile: vp.name === "phone", hasTouch: vp.name === "phone" });
      await ctx.addInitScript(() => { try { localStorage.setItem("cp:3d", "off"); } catch {} });
      const page = await ctx.newPage();
      const errs = [];
      page.on("pageerror", (e) => errs.push(String(e)));
      page.on("console", (m) => m.type() === "error" && errs.push(m.text()));
      await page.goto(base + p, { waitUntil: "load" });
      await page.waitForTimeout(1200);
      const n = await page.evaluate(() => document.querySelectorAll("[data-section]").length);
      for (let i = 0; i < n; i++) {
        const info = await page.evaluate((i) => {
          const el = document.querySelectorAll("[data-section]")[i];
          const r = el.getBoundingClientRect();
          const y = window.scrollY + r.top + Math.min(r.height, innerHeight) / 2 - innerHeight / 2 + (r.height > innerHeight ? innerHeight * 0.25 : 0);
          window.scrollTo({ top: y, behavior: "instant" });
          return { section: el.dataset.section, scene: el.dataset.scene || null, stage: el.dataset.stage || null };
        }, i);
        await page.waitForTimeout(900);
        const st = await page.evaluate(() => {
          const s = document.querySelector("[data-neural-stage]");
          const vis = [...document.querySelectorAll("[data-neural-poster]")].filter((p) => getComputedStyle(p).visibility === "visible" && getComputedStyle(p).display !== "none" && +getComputedStyle(p).opacity > 0).map((p) => p.dataset.neuralPoster);
          return { poster: s?.dataset.poster, posterStage: s?.dataset.posterStage, visible: vis, canvas: document.querySelectorAll("canvas").length };
        });
        const f = `${out}/${vp.name}${p.replace(/\//g, "_") || "_"}-${String(i).padStart(2, "0")}-${info.section}.png`;
        await page.screenshot({ path: f });
        report.push({ vp: vp.name, path: p, i, ...info, ...st, file: f });
      }
      report.push({ vp: vp.name, path: p, errs });
      await ctx.close();
    }
  }
  await browser.close();
  fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 1));
  for (const r of report) console.log(JSON.stringify(r).slice(0, 220));
})();

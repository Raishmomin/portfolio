// Measures poster -> canvas crossfade start (island box opacity 1) after navigation, per page.
// Usage: node fm3-shared-xfade.cjs <base> <runs> [path...]   env CHUNKS=<.next/static/chunks dir> sums gzip of the JS fetched after load before live
"use strict";
const fs = require("fs");
const zlib = require("zlib");
const CH = process.env.CHUNKS;
const gz = (f) => { try { return zlib.gzipSync(fs.readFileSync(CH + "/" + f), { level: 6 }).length; } catch { return 0; } };
const { chromium } = require("playwright");
const EXE = "/home/raish/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell";
const ARGS = ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=gl"];
const [base, runsArg, ...paths] = process.argv.slice(2);
const runs = Number(runsArg || 3);
const INIT = `(() => {
  const t = (window.__xf = { load: 0, canvas: 0, live: 0, chunks: [] });
  addEventListener("load", () => (t.load = performance.now()));
  const tick = () => {
    const c = document.querySelector("[data-neural-canvas]");
    if (c && !t.canvas) t.canvas = performance.now();
    const box = c && c.closest("[data-neural-stage] > div");
    if (box && box.style.opacity === "1" && !t.live) t.live = performance.now();
    if (!t.live) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})();`;
(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ARGS });
  const out = {};
  for (const p of paths.length ? paths : ["/"]) {
    out[p] = [];
    for (let i = 0; i < runs; i++) {
      const ctx = await browser.newContext({ viewport: { width: 1536, height: 732 }, deviceScaleFactor: 1.25 });
      const page = await ctx.newPage();
      const js = [];
      page.on("request", (r) => { const u = r.url(); if (u.includes("/_next/static/chunks/") && u.endsWith(".js")) js.push(u.split("/").pop()); });
      let loadIdx = 0, liveIdx = 0;
      page.on("load", () => (loadIdx = js.length));
      const errs = [];
      page.on("pageerror", (e) => errs.push(String(e)));
      page.on("console", (m) => m.type() === "error" && errs.push(m.text()));
      await page.addInitScript(INIT);
      await page.goto(base + p, { waitUntil: "load" });
      try { await page.waitForFunction(() => window.__xf.live > 0, null, { timeout: 20000 }); } catch {}
      const r = await page.evaluate(() => window.__xf);
      liveIdx = js.length;
      await page.waitForTimeout(Number(process.env.SETTLE || 0));
      const entry = js.slice(loadIdx, liveIdx);
      const later = js.slice(liveIdx);
      if (CH && i === 0) console.log(p, "entry", entry.map((f) => f + ":" + gz(f)).join(" "), "SUM", entry.reduce((a, f) => a + gz(f), 0), "| later", later.map((f) => f + ":" + gz(f)).join(" "));
      out[p].push({ load: Math.round(r.load), canvas: Math.round(r.canvas), live: Math.round(r.live), afterLoad: Math.round(r.live - r.load), nJs: js.length, errs });
      await ctx.close();
    }
  }
  await browser.close();
  for (const [p, rows] of Object.entries(out)) {
    const v = rows.map((r) => r.live).filter(Boolean).sort((a, b) => a - b);
    console.log(p, JSON.stringify(rows.map((r) => [r.load, r.canvas, r.live, r.afterLoad, r.errs.length])), "median live", v[v.length >> 1]);
  }
})();

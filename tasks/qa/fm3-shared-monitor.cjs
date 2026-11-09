// Frame-monitor behaviour under CPU throttling (CDP) at the owner viewport.
// Usage: node fm3-shared-monitor.cjs <base> <scenario: stress|transient|scroll> [runs]
"use strict";
const { chromium } = require("playwright");
const EXE = "/home/raish/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell";
const ARGS = ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=gl"];
const [base, scenario = "stress", runsArg = "1"] = process.argv.slice(2);
const state = () => {
  const s = document.querySelector("[data-neural-stage]");
  const c = document.querySelector("[data-neural-canvas]");
  const box = c && c.closest("[data-neural-stage] > div");
  return { fps: s?.dataset.fps || "-", q: s?.dataset.quality || "-", fb: s?.dataset.fallback || "", rt: s?.dataset.retries || "0", canvas: !!c, live: !!box && box.style.opacity === "1", scene: s?.dataset.scene, y: Math.round(scrollY) };
};
(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ARGS });
  for (let run = 0; run < Number(runsArg); run++) {
    const ctx = await browser.newContext({ viewport: { width: 1536, height: 732 }, deviceScaleFactor: 1.25 });
    const page = await ctx.newPage();
    const errs = [];
    page.on("pageerror", (e) => errs.push(String(e)));
    page.on("console", (m) => m.type() === "error" && errs.push(m.text()));
    const cdp = await ctx.newCDPSession(page);
    await page.goto(base + "/", { waitUntil: "load" });
    await page.waitForFunction(() => { const c = document.querySelector("[data-neural-canvas]"); const b = c && c.closest("[data-neural-stage] > div"); return b && b.style.opacity === "1"; }, null, { timeout: 30000 });
    const t0 = Date.now();
    const log = [];
    let last = "";
    let lastT = 0;
    const snap = async (note = "") => {
      const s = await page.evaluate(state);
      const k = `${s.q}|${s.fb}|${s.rt}|${s.canvas}|${s.live}`;
      if (k !== last || note || Date.now() - lastT > 5000) { lastT = Date.now(); log.push(`${((Date.now() - t0) / 1000).toFixed(1)}s ${note} fps=${s.fps} q=${s.q} fb=${s.fb || "-"} retries=${s.rt} canvas=${s.canvas} live=${s.live} scene=${s.scene} y=${s.y}`); last = k; }
    };
    const watch = async (ms) => { const end = Date.now() + ms; while (Date.now() < end) { await snap(); await page.waitForTimeout(250); } };
    if (scenario === "stress" || scenario === "transient") {
      await page.mouse.move(700, 400);
      await watch(3000);
      const dur = scenario === "stress" ? 30000 : 3000;
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 10 });
      await snap(`THROTTLE x10 for ${dur / 1000}s`);
      // keep input flowing so the idle pause never kicks in
      const end = Date.now() + dur;
      while (Date.now() < end) { await page.mouse.move(600 + Math.random() * 200, 300 + Math.random() * 200); await snap(); await page.waitForTimeout(250); }
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
      await snap("UNTHROTTLE");
      const end2 = Date.now() + (scenario === "stress" ? 75000 : 25000);
      while (Date.now() < end2) { await page.mouse.move(600 + Math.random() * 200, 300 + Math.random() * 200); await snap(); await page.waitForTimeout(500); }
    } else {
      // scroll the whole home page in half-viewport steps
      const H = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < H; y += 366) {
        await page.mouse.wheel(0, 366);
        await page.waitForTimeout(1300);
        await snap();
      }
      await snap("END");
    }
    console.log(`run ${run + 1} ${scenario}:\n  ` + log.join("\n  ") + (errs.length ? `\n  ERRORS ${errs.join(" | ")}` : ""));
    await ctx.close();
  }
  await browser.close();
})();

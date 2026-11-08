#!/usr/bin/env node
/* fm3-owner.cjs: round-3 owner-view capture tour (AI, Services, Writing, FAQ, Contact scenes).
 * Read-only: loads pages, scrolls with the mouse wheel, hovers, opens FAQ items, types into
 * the contact form. Every non-GET request to the site is answered locally by page.route (the
 * /api/contact POST gets the success JSON contact-form.tsx expects; anything else, e.g. the
 * /api/info visit beacon or a future server action, gets an empty 204 and is listed in run.json),
 * so nothing ever reaches the live production DB and no real message is sent.
 *
 * Usage:  node fm3-owner.cjs <baseUrl> <outDir> [--wide] [--light] [--phone] [--parallel] [--sheets-only]
 *   default      the owner's screen: 1536x732 @1.25, dark
 *   --wide       1920x915 @1
 *   --light      light theme
 *   --phone      390x844 @2, isMobile + hasTouch (no hover steps; the deck is a plain list there)
 *   --parallel   run the home and the subpage tours at the same time (faster, but two live
 *                WebGL pages on a loaded box can push the stage to data-quality=low)
 *   --sheets-only rebuild sheet-*.png from <outDir>/index.json (no site needed)
 * Env:    FM3_SETTLE=<ms>   settle wait before each capture (default 1400)
 *         FM3_MAX_MS=<ms>   capture budget (default 330000). The home tour may use the first 62 % of it, so
 *                           every subpage is still captured on a loaded box; the subpage tour runs until the
 *                           budget. Past it the run stops, writes what it has and builds the sheets (exit 3).
 *                           A step hung past the budget hits a hard stop at budget+20 s (+ up to 20 s of
 *                           sheets), so one mode never takes more than ~6 min. When the home tour's pace
 *                           projects past its share (a loaded box: slow frames, 3D drops), it goes lean:
 *                           transitions keep the 50 % frame only, ai mid / services scroll / contact mid are
 *                           skipped, and on the subpages /services keeps its first and last list step and only
 *                           the first service page its CTA (run.json "lean" says when), so the contact
 *                           interactions and every subpage still fit.
 *         FM3_RELOADS=<n> page reloads per run to win the 3D back after a drop to the poster (default 6)
 *         FM3_ONLY=a,b      steps: ai,services,writing,faq,contact,transitions,projects,services-page,service-pages,contact-page,about
 *
 * Captures (wheel scroll, ~1.4 s settle per frame):
 *   home     AI top / each deck card on top / mid; services entry, each card hovered, scroll steps;
 *            writing entry, each post card hovered (ai/writing "end" frames only without transitions:
 *            the t-*-25 frames show the same spot); FAQ idle, first hovered, each opened
 *            in turn; contact entry, mid, each channel hovered, name focused, typing, copy-email
 *            (clipboard read back), submit (held "Sending", flight, "Message sent."); transitions
 *            25/50/75 % ai>work, work>services, services>writing, writing>faq, faq>contact, contact>footer
 *   pages    /projects first/last deck card (+ AI top on phones) + CTA; /services top, engagement list steps, CTA;
 *            every /services/<slug> (from /services links) top, first FAQ open, CTA; /contact top +
 *            name focused; /about FAQ idle + first open + "Keep exploring" ([data-section=related])
 *   Hooks only: [data-section], [data-neural-stage], [data-deck]/[data-card]/data-deck-*, [data-arch-item],
 *   data-focus-id (service:, faq:, contact:, post:), details[data-faq-item], #contact-*,
 *   button[data-focus-id="contact:email"], [role=status]; writing cards fall back to the section's
 *   post links (a[href^="/blog/"]) until the writing lane adds data-focus-id="post:<slug>".
 *
 * Output in <outDir>:
 *   <nn>-<page>-<state>.png   one per capture
 *   index.json   [{file, group, url, page, state, scene, layout, focus, quality, section, y,
 *                  project?, aiProject?, aiStage?, service?, faq?, arch?, deck?, intended?, intendedOf?, match?,
 *                  canvasDropped?, recovered?, copied?, clipboard?, intercepted?, sentState?, error?}]
 *                (aiProject/aiStage = the card + stage chip the AI scene lights: [data-ai-lit]/[data-ai-done])
 *                (intended = the item the step aimed at; match = index[intendedOf] === intended)  (scene/layout/focus/quality
 *                  = [data-neural-stage] data-scene / data-stage-layout / data-focus / data-quality)
 *   errors.json  {console: [pageerror/console.error/crash with page + state], tool: [failed steps]}
 *   run.json     timings, lean (false, or when the run fell behind schedule), canvasDrops (3D fell back to the poster mid-tour: recorded, then the page is
 *                reloaded and the scroll restored, max FM3_RELOADS (6) per run), intercepted contact POSTs, blocked API
 *                writes, missing DOM hooks
 *   sheet-home.png, sheet-pages.png (+ .html)  labelled thumbnail grids
 * Exit: 0 done, 1 some capture/step failed, 2 usage/unreachable, 3 time budget hit (partial output).
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { chromium } = require("playwright");

const EXE = "/home/raish/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell";
const GPU_ARGS = ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=gl"];

// ------------------------------------------------------------------ in-page probes
// Plain functions, serialised by page.evaluate (no closures over Node state).

/** Stage attributes + what the page currently shows (deck top card, active service, open FAQ). */
function pgInfo() {
  const st = document.querySelector("[data-neural-stage]");
  const a = (n) => (st ? st.getAttribute(n) : null);
  const vh = innerHeight;
  const inView = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < vh;
  };
  const fid = (el) => (el ? el.getAttribute("data-focus-id") || (el.querySelector("[data-focus-id]") || {}).dataset?.focusId || null : null);
  let section = null;
  for (const el of document.querySelectorAll("[data-section]")) {
    const b = el.getBoundingClientRect();
    if (b.top <= vh / 2 && b.bottom >= vh / 2) section = el.getAttribute("data-section");
  }
  const deckEl = [...document.querySelectorAll("[data-deck-live]")].find(inView);
  const deck = deckEl
    ? { index: Number(deckEl.getAttribute("data-deck-index")), id: fid([...deckEl.children].find((c) => c.hasAttribute("data-deck-top")) || null) }
    : null;
  const arch = [...document.querySelectorAll("[data-arch-item][data-arch-active]")].find(inView);
  const lit = [...document.querySelectorAll("[data-ai-lit]")].find(inView);
  // The AI scene lights the chips of the card whose project it draws (also where the deck is a plain list).
  const drawn = [...document.querySelectorAll("[data-ai-lit], [data-ai-done]")].find(inView);
  const open = [...document.querySelectorAll("details[open]")].filter(inView);
  const faqOpen = open.map((d) => d.getAttribute("data-focus-id") || ((d.querySelector("summary") || {}).textContent || "").replace(/\s+/g, " ").trim().slice(0, 60));
  return {
    scene: a("data-scene"),
    layout: a("data-stage-layout"),
    focus: a("data-focus"),
    quality: a("data-quality"),
    canvases: document.querySelectorAll("canvas").length,
    hasStage: !!st,
    section,
    y: Math.round(scrollY),
    deck,
    service: arch && /^service:/.test(arch.getAttribute("data-focus-id") || "") ? arch.getAttribute("data-focus-id") : null,
    arch: arch && !/^service:/.test(arch.getAttribute("data-focus-id") || "") ? arch.getAttribute("data-focus-id") : null,
    faq: faqOpen.length ? faqOpen.join(" + ") : null,
    aiStage: lit ? `${fid(lit.closest("[data-focus-id]"))}: ${lit.getAttribute("data-ai-stage")}` : null,
    aiProject: drawn ? fid(drawn.closest("[data-focus-id]")) : null,
  };
}

/** Absolute geometry of the first element matching sel, or null. */
function pgGeo(sel) {
  const el = document.querySelector(sel);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top + scrollY, bottom: r.bottom + scrollY, h: r.height, vh: innerHeight, vw: innerWidth, max: document.documentElement.scrollHeight - innerHeight };
}

/** Absolute geometry of the i-th element matching sel (null if absent or not rendered). */
function pgGeoAll(sel) {
  return [...document.querySelectorAll(sel)].map((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 ? { top: r.top + scrollY, h: r.height, id: el.getAttribute("data-focus-id"), tag: el.tagName.toLowerCase() } : null;
  });
}

/**
 * Scroll targets that put each card of a [data-deck] on top. Live deck (desktop, motion
 * cards.ts): card i is "top" until card i+1 covers it halfway; that switch happens at
 * scrollY = deckTop + offset[i+1] - (vh + 88 + (i+1)*14)/2 (the midpoint of card i's
 * ScrollTrigger). Not live (phones / motion off): the target centres each card.
 */
function pgDeck(sel) {
  const deck = document.querySelector(sel);
  if (!deck) return null;
  const cards = [...deck.children].filter((c) => c.hasAttribute("data-card"));
  const vh = innerHeight;
  const top = deck.getBoundingClientRect().top + scrollY;
  const ids = cards.map((c) => c.getAttribute("data-focus-id") || (c.querySelector("[data-focus-id]") || {}).dataset?.focusId || null);
  const live = deck.hasAttribute("data-deck-live") && cards.length > 1;
  if (!live) {
    return { live, ids, ys: cards.map((c) => { const r = c.getBoundingClientRect(); return Math.round(r.top + scrollY + Math.min(r.height, vh) / 2 - vh / 2); }) };
  }
  const gap = parseFloat(getComputedStyle(deck).rowGap) || 0;
  let y = 0;
  const off = cards.map((c) => { const t = y; y += c.offsetHeight + gap; return t; });
  const sw = cards.slice(0, -1).map((_, i) => top + off[i + 1] - (vh + 88 + (i + 1) * 14) / 2);
  const n = cards.length;
  const ys = cards.map((_, k) => Math.round(k === 0 ? sw[0] - 120 : k === n - 1 ? sw[n - 2] + 160 : (sw[k - 1] + sw[k]) / 2));
  return { live, ids, ys };
}

/** A pointer spot near the centre that is not over interactive/focusable content. */
function pgNeutral() {
  const W = innerWidth, H = innerHeight, cx = W / 2, cy = H / 2;
  const bad = "a,button,summary,input,textarea,select,label,details,[data-focus-id],[data-card],[data-spotlight],[data-tilt],[data-magnetic],header,nav,footer";
  const pts = [];
  for (let gx = 0.04; gx < 1; gx += 0.06) for (let gy = 0.15; gy < 0.95; gy += 0.08) pts.push([gx * W, gy * H]);
  pts.sort((p, q) => Math.hypot(p[0] - cx, p[1] - cy) - Math.hypot(q[0] - cx, q[1] - cy));
  for (const [x, y] of pts) {
    const el = document.elementFromPoint(x, y);
    if (!el || !el.closest(bad)) return [Math.round(x), Math.round(y)];
  }
  return [W - 3, Math.round(cy)];
}

/** Item counts of the home sections, for the frame plan behind the lean check (see lean()). */
function pgHomeCounts() {
  const n = (sel) => document.querySelectorAll(sel).length;
  const posts = n('[data-section="writing"] [data-focus-id^="post:"]') || n('[data-section="writing"] li a[href^="/blog/"]');
  const chans = new Set([...document.querySelectorAll('[data-section="contact"] [data-focus-id^="contact:"]')].map((e) => e.getAttribute("data-focus-id"))).size;
  return { deck: n('[data-section="ai"] [data-deck] > [data-card]'), services: n('[data-section="services"] [data-arch-item]'), posts, faq: n('[data-section="faq"] details'), chans };
}

/** True once the stage canvas is live (poster paused or the island faded to opacity 1); true without a stage. */
function pgLive() {
  const st = document.querySelector("[data-neural-stage]");
  if (!st) return true;
  const c = st.querySelector("canvas");
  if (!c) return false;
  if (st.querySelector("[data-neural-poster][data-paused]")) return true;
  for (let e = c.parentElement; e && e !== st; e = e.parentElement) if (e.style && e.style.opacity === "1") return true;
  return false;
}

// ------------------------------------------------------------------ contact sheet
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function buildSheetHtml(title, items, { cols, thumbW, baseQ = "high" }) {
  const cells = items.map((r) => {
    const bits = [`scene <b>${esc(r.scene ?? "-")}</b> · ${esc(r.layout ?? "-")}`];
    if (r.focus) bits.push(`focus ${esc(r.focus)}`);
    for (const k of ["project", "service", "faq"]) if (r[k]) bits.push(`${k} ${esc(r[k])}`);
    if (r.aiStage) bits.push(`ai stage ${esc(r.aiStage)}`);
    if (r.intended && r.match === false) bits.push(`<span class="warn">wanted ${esc(r.intendedOf)} ${esc(r.intended)}</span>`);
    if (r.quality && r.quality !== baseQ) bits.push(`<span class="warn">q=${esc(r.quality)}</span>`);
    if (r.hasStage && r.canvases === 0) bits.push(`<span class="bad">3D DROPPED: poster only (scene attr is stale)</span>`);
    if (r.recovered) bits.push(`<span class="warn">3D dropped: page reloaded before this frame</span>`);
    if (r.error) bits.push(`<span class="bad">${esc(r.error)}</span>`);
    const img = r.shot ? `<img src="${esc(encodeURI(r.file))}" loading="eager">` : `<div class="miss">no screenshot</div>`;
    return `<figure class="${r.error ? "err" : ""}">${img}<figcaption><b>${esc(String(r.file || "").replace(/\.png$/, ""))}</b><br>${bits.join("<br>")}</figcaption></figure>`;
  });
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
body{margin:0;padding:16px;background:#0f1012;color:#d6d6d6;font:12px/1.4 system-ui,-apple-system,Segoe UI,sans-serif}
h1{font-size:15px;font-weight:600;margin:0 0 12px}
.g{display:grid;grid-template-columns:repeat(${cols},${thumbW}px);gap:12px;align-items:start}
figure{margin:0;background:#18191c;border:1px solid #2c2d31;border-radius:6px;overflow:hidden}
figure.err{border-color:#d9534f}
img{display:block;width:100%;height:auto;background:#000}
figcaption{padding:6px 8px;word-break:break-word}
.warn{color:#f0ad4e}.bad{color:#ff6b6b}
.miss{display:grid;place-items:center;height:${Math.round(thumbW * 0.48)}px;color:#ff6b6b}
</style></head><body><h1>${esc(title)}</h1><div class="g">${cells.join("")}</div></body></html>`;
}

module.exports = { pgInfo, pgGeo, pgGeoAll, pgDeck, pgNeutral, pgLive, buildSheetHtml };

// ------------------------------------------------------------------ run state
const S = {
  base: "", out: "", mode: "owner", phone: false, wide: false, light: false, parallel: false,
  settle: 1400, budget: 330000, reloads: 6, deadline: Infinity, only: null, t0: Date.now(), seq: 0,
  index: [], errors: [], tool: [], missing: [], intercepted: [], blocked: [], drops: [], state: {}, browser: null, timedOut: false,
  lean: false, // set (with when/why) once the home tour falls behind schedule: see lean()
  contactGate: null, // a pending promise holds the intercepted /api/contact response (see newCtx)
};
const log = (...a) => console.log(`[${String(Math.round((Date.now() - S.t0) / 1000)).padStart(3)}s]`, ...a);
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
const msg = (e) => String((e && e.message) || e).split("\n")[0].slice(0, 300);
const want = (step) => !S.only || S.only.includes(step);
class Abort extends Error {}
class Retry extends Error {} // the 3D dropped and the page was reloaded before the step's first frame
const HOME_SHARE = 0.62; // of the budget, for the home tour when the subpage tour runs after it
const checkTime = () => {
  if (Date.now() > S.deadline) { S.timedOut = true; throw new Abort(`time budget exhausted (${Math.round((S.deadline - S.t0) / 1000)} s)`); }
};
/**
 * Behind schedule on a loaded box (slow frames, 3D drops and reloads): when the home tour's pace
 * projects past its deadline, the rest of the run goes lean (sticky): transitions keep only their
 * 50 % frame and the optional frames (ai mid, services scroll steps, contact mid) are skipped, so the
 * interaction states at the end of the page still fit. run.json "lean" records when and why.
 */
function lean(R) {
  if (S.lean) return true;
  if (!R.plan) return false;
  const done = S.index.filter((r) => r.group === R.group).length;
  if (done < 6) return false;
  const el = Date.now() - R.t0;
  const end = R.t0 + (el / done) * R.plan;
  if (end <= S.deadline) return false;
  S.lean = { at: Math.round((Date.now() - S.t0) / 1000), page: R.path, framesDone: done, framesPlanned: R.plan, projectedEnd: Math.round((end - S.t0) / 1000), deadline: Math.round((S.deadline - S.t0) / 1000) };
  log(`  behind schedule (${done}/${R.plan} frames in ${Math.round(el / 1000)} s, projected end ${S.lean.projectedEnd} s > ${S.lean.deadline} s): lean from here (transitions 50 % only, optional frames skipped)`);
  return true;
}
const pathOf = (page) => { try { return new URL(page.url()).pathname; } catch { return page.url(); } };
const safeJson = (s) => { try { return JSON.parse(s); } catch { return s; } };
const missing = (R, sel, what) => {
  const key = `${R.path} ${sel}`;
  if (!S.missing.some((m) => m.key === key)) S.missing.push({ key, page: R.path, selector: sel, what });
  log(`  missing on ${R.path}: ${sel} (${what})`);
};

/** Runs one step; a failure is recorded and the tour goes on (an Abort stops the run). */
async function attempt(R, label, fn) {
  for (let pass = 0; pass < 2; pass++) {
    try {
      checkTime();
      S.state[R.run] = label;
      R.stepStart = S.index.length;
      R.retried = pass > 0;
      if (!label.startsWith("load ")) await ensureLive(R, label);
      await fn();
      return;
    } catch (e) {
      if (e instanceof Abort) throw e;
      if (e instanceof Retry && pass === 0) { log(`  re-running "${label}" on the reloaded page`); continue; }
      S.tool.push({ run: R.run, page: R.path, step: label, error: msg(e) });
      log(`  step failed: ${label}: ${msg(e)}`);
      return;
    }
  }
}

/** The stage fell back to the poster (stage.tsx onFallback: sustained <30 fps at low quality). */
function noteDrop(R, at, inf) {
  if (R.dropNoted) return;
  R.dropNoted = true;
  S.drops.push({ run: R.run, page: R.path, at, section: inf.section, quality: inf.quality, y: inf.y, recovered: false });
  log(`  3D canvas gone on ${R.path} at ${at} (section ${inf.section}, data-quality=${inf.quality}): recorded`);
}

/**
 * Before each step: if the canvas dropped, record it and reload + restore the scroll position
 * (at most 3 times per run), so the remaining frames still show the 3D.
 */
async function ensureLive(R, label) {
  if (!R.loaded || !R.live) return;
  const inf = await R.page.evaluate(pgInfo);
  if (!inf.hasStage || inf.canvases > 0) return;
  noteDrop(R, `before ${label}`, inf);
  await recover(R, inf.y);
}

/** Reloads the page and restores scroll y and the pointer (max S.reloads per run). True if the 3D is live again. */
async function recover(R, y) {
  if ((R.reloads = (R.reloads || 0) + 1) > S.reloads) return false;
  await R.page.reload({ waitUntil: "load", timeout: 60000 });
  try { await R.page.waitForFunction(pgLive, null, { timeout: 20000, polling: 250 }); } catch (e) {}
  await R.page.waitForTimeout(1000);
  await R.page.evaluate((v) => window.scrollTo({ top: v, behavior: "instant" }), y);
  await settleScroll(R.page);
  await R.page.waitForTimeout(800);
  const m = R.page.__mouse;
  if (m && !S.phone) await R.page.mouse.move(m[0], m[1] + 1, { steps: 2 }); // re-hover what was hovered
  const ok = await R.page.evaluate(pgLive);
  const d = S.drops[S.drops.length - 1];
  if (d && d.run === R.run) d.recovered = ok;
  R.dropNoted = false;
  log(`  reloaded ${R.path} (reload ${R.reloads}/${S.reloads}), 3D ${ok ? "live again" : "still not live"}`);
  return ok;
}

// ------------------------------------------------------------------ browser helpers
async function newCtx(run) {
  const view = S.phone
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
    : S.wide
      ? { viewport: { width: 1920, height: 915 }, deviceScaleFactor: 1 }
      : { viewport: { width: 1536, height: 732 }, deviceScaleFactor: 1.25 };
  const theme = S.light ? "light" : "dark";
  const ctx = await S.browser.newContext({ ...view, colorScheme: theme, reducedMotion: "no-preference", serviceWorkers: "block" });
  ctx.setDefaultTimeout(15000);
  ctx.setDefaultNavigationTimeout(60000);
  // Motion + 3D are on for every visitor; make sure the hidden QA switch is not set.
  await ctx.addInitScript((t) => {
    try { localStorage.setItem("theme", t); localStorage.removeItem("cp:3d"); } catch (e) {}
  }, theme);
  try {
    await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(S.base).origin });
  } catch (e) {
    S.tool.push({ run, step: "grantPermissions", error: msg(e) });
  }
  // Read-only guarantee (MongoDB is the live production DB): no write reaches the app, at any
  // path (the API routes and any server action POST alike). Reads pass through untouched.
  const origin = new URL(S.base).origin;
  await ctx.route((u) => u.origin === origin, async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname;
    if (p === "/api/contact" || p.startsWith("/api/contact/")) {
      S.intercepted.push({ run, page: S.state[run] || null, method: req.method(), path: p, body: safeJson(req.postData()), at: Date.now() - S.t0 });
      // Held until the tour has captured the "Sending" frame (S.contactGate), else a 700 ms round trip;
      // never longer than 10 s.
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      await Promise.race([S.contactGate || sleep(700), sleep(10000)]);
      // The page may have been reloaded meanwhile (3D drop recovery): the request is then gone.
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, insertedId: "fm3-owner-intercepted" }) }).catch(() => {});
    }
    if (req.method() !== "GET" && req.method() !== "HEAD") {
      S.blocked.push({ run, method: req.method(), path: p });
      return route.fulfill({ status: 204, body: "" }).catch(() => {});
    }
    return route.continue().catch(() => {});
  });
  return ctx;
}

function watch(page, run) {
  const rec = (kind, text) => {
    if (/THREE\.Clock/.test(text)) return;
    S.errors.push({ run, page: pathOf(page), state: S.state[run] || null, kind, text: String(text).slice(0, 600) });
  };
  page.on("pageerror", (e) => rec("pageerror", (e && e.message) || String(e)));
  page.on("console", (m) => { if (m.type() === "error") rec("console.error", m.text()); });
  page.on("crash", () => rec("crash", "page crashed"));
}

async function settleScroll(page, maxMs = 2500, need = 3) {
  const t0 = Date.now();
  let last = null, same = 0;
  while (Date.now() - t0 < maxMs) {
    const y = await page.evaluate(() => scrollY);
    if (last !== null && Math.abs(y - last) < 0.5) { if (++same >= need) return y; } else same = 0;
    last = y;
    await page.waitForTimeout(50);
  }
  return last;
}

async function neutral(page) {
  if (S.phone) return;
  const [x, y] = await page.evaluate(pgNeutral);
  page.__mouse = [x, y];
  await page.mouse.move(x, y, { steps: 2 });
}

/** Scrolls to absolute y with the mouse wheel (phones: instant scrollTo), pointer parked on a neutral spot. */
async function scrollTo(page, target) {
  checkTime();
  if (S.phone) {
    await page.evaluate((v) => window.scrollTo({ top: v, behavior: "instant" }), Math.max(0, Math.round(target)));
    await settleScroll(page);
    return;
  }
  await neutral(page);
  let last = null, stall = 0;
  for (let i = 0; i < 60; i++) {
    const s = await page.evaluate(() => ({ y: scrollY, max: document.documentElement.scrollHeight - innerHeight }));
    const goal = Math.round(Math.max(0, Math.min(s.max, target)));
    const d = goal - s.y;
    if (Math.abs(d) < 2) break;
    if (last !== null && Math.abs(s.y - last) < 1) {
      if (++stall >= 3) { // wheel swallowed (pinned/locked): fall back to a programmatic scroll
        await page.evaluate((v) => window.scrollTo({ top: v, behavior: "instant" }), goal);
        break;
      }
    } else stall = 0;
    last = s.y;
    const step = Math.abs(d) > 2400 ? 1400 : 800; // long trips in bigger notches (still wheel events)
    await page.mouse.wheel(0, Math.max(-step, Math.min(step, d)));
    await settleScroll(page, 700, 2);
  }
  await settleScroll(page);
  await neutral(page);
}

async function hoverBox(page, box) {
  const x = box.x + box.width / 2;
  const y = box.y + Math.min(box.height / 2, 48);
  page.__mouse = [x, y];
  await page.mouse.move(x, y, { steps: 6 });
}

async function open(R, p) {
  checkTime();
  S.state[R.run] = `load ${p}`;
  R.path = p;
  R.loaded = null;
  const t = Date.now();
  const resp = await R.page.goto(S.base + p, { waitUntil: "load", timeout: 60000 });
  const status = resp ? resp.status() : null;
  R.loaded = p;
  try { await R.page.waitForFunction(pgLive, null, { timeout: 20000, polling: 250 }); } catch (e) {}
  R.live = await R.page.evaluate(pgLive);
  await R.page.waitForTimeout(700); // warm-up; each capture adds its own settle
  await neutral(R.page);
  log(`${R.run}: ${p} HTTP ${status}, 3D ${R.live ? "live" : "NOT live (poster)"} in ${Date.now() - t} ms`);
  if (!R.live) S.tool.push({ run: R.run, page: p, step: "load", error: "stage canvas not live within 20 s" });
  if (status && status >= 400) S.tool.push({ run: R.run, page: p, step: "load", error: `HTTP ${status}` });
  return status;
}

/**
 * One capture: settle, read the stage, screenshot, record. keep = the scroll-target function the
 * step aimed with: after the settle the layout can have moved (late ScrollTrigger refresh, a pin
 * spacer, an item opening), so a drift over 40 px is re-aimed (rec.drift = px) before the shot.
 */
async function cap(R, pageKey, state, meta = {}, settle = S.settle, keep = null) {
  checkTime();
  const nn = String(++S.seq).padStart(2, "0");
  const file = `${nn}-${slug(pageKey)}-${slug(state)}.png`;
  const rec = { file, group: R.group, url: null, page: pageKey, state, ...meta, shot: false };
  S.state[R.run] = `${pageKey}:${state}`;
  try {
    if (settle) await R.page.waitForTimeout(settle);
    if (keep) {
      const t = await keep();
      const s = await R.page.evaluate(() => ({ y: scrollY, max: document.documentElement.scrollHeight - innerHeight }));
      const d = t == null ? 0 : Math.round(Math.max(0, Math.min(s.max, t)) - s.y);
      if (Math.abs(d) > 40) {
        rec.drift = d;
        log(`  layout drifted ${d} px before ${pageKey}:${state}; re-aiming`);
        await goTo(R, keep);
        await R.page.waitForTimeout(600);
      }
    }
    rec.url = R.page.url();
    let inf = await R.page.evaluate(pgInfo);
    if (inf.hasStage && inf.canvases === 0 && R.live) {
      // The stage fell back to the poster: record it, reload + restore scroll/pointer, re-read.
      // The frame then shows the 3D again but may have lost focus / typed text / an open FAQ
      // (rec.recovered says so; match turns false where the intended item is gone).
      rec.canvasDropped = true;
      noteDrop(R, `${pageKey}:${state}`, inf);
      const ok = await recover(R, inf.y);
      if (ok && S.index.length === R.stepStart && !R.retried) {
        S.seq--; // this frame is re-taken by the re-run step under the same number
        throw new Retry("3D dropped; step re-run after reload");
      }
      if (ok) {
        rec.recovered = true;
        await R.page.waitForTimeout(settle || 600);
        inf = await R.page.evaluate(pgInfo);
      }
    }
    Object.assign(rec, {
      scene: inf.scene, layout: inf.layout, focus: inf.focus, quality: inf.quality, canvases: inf.canvases,
      hasStage: inf.hasStage, section: inf.section, y: inf.y,
    });
    if (inf.deck) rec.deck = inf.deck;
    // project = the deck's top card (live deck), else the card the AI scene is drawing (phones / plain list).
    if (rec.project === undefined && ((inf.deck && inf.deck.id) || inf.aiProject)) rec.project = (inf.deck && inf.deck.id) || inf.aiProject;
    if (inf.aiProject) rec.aiProject = inf.aiProject;
    if (inf.service && rec.service === undefined) rec.service = inf.service;
    if (inf.arch) rec.arch = inf.arch;
    if (inf.faq && rec.faq === undefined) rec.faq = inf.faq;
    if (inf.aiStage) rec.aiStage = inf.aiStage;
    if (rec.intended && rec.intendedOf) rec.match = rec[rec.intendedOf] === rec.intended;
    await R.page.screenshot({ path: path.join(S.out, file), timeout: 25000 });
    rec.shot = true;
  } catch (e) {
    if (e instanceof Abort || e instanceof Retry) throw e;
    rec.error = msg(e);
  }
  S.index.push(rec);
  const extra = ["project", "service", "faq"].filter((k) => rec[k]).map((k) => `${k}=${rec[k]}`).join(" ");
  log(`  ${file}  scene=${rec.scene} layout=${rec.layout}${rec.focus ? ` focus=${rec.focus}` : ""}${extra ? ` ${extra}` : ""}${rec.quality && rec.quality !== "high" ? ` q=${rec.quality}` : ""}${rec.error ? `  ERROR ${rec.error}` : ""}`);
  return rec;
}

const geo = (R, sel) => R.page.evaluate(pgGeo, sel);

/**
 * Scrolls to the y that compute() returns, then re-measures and corrects (up to 3 passes):
 * content above can grow while scrolling (pin spacers, entrance layouts), so a target
 * measured before the trip is not trusted.
 */
async function goTo(R, compute) {
  for (let pass = 0; pass < 3; pass++) {
    const t = await compute();
    if (t == null || Number.isNaN(t)) throw new Error("scroll target not found");
    await scrollTo(R.page, t);
    const t2 = await compute();
    const s = await R.page.evaluate(() => ({ y: scrollY, max: document.documentElement.scrollHeight - innerHeight }));
    if (t2 == null || Math.abs(Math.max(0, Math.min(s.max, t2)) - s.y) <= 24) return;
  }
}
/** y that puts the i-th match of sel at frac of the viewport height (top edge). */
const elY = (R, sel, i, frac) => async () => {
  const all = await R.page.evaluate(pgGeoAll, sel);
  if (!all[i]) return null;
  return all[i].top - R.page.viewportSize().height * frac;
};
/** y that centres the i-th match of sel (or its top part if taller than the viewport). */
const elCentreY = (R, sel, i) => async () => {
  const all = await R.page.evaluate(pgGeoAll, sel);
  if (!all[i]) return null;
  const vh = R.page.viewportSize().height;
  return all[i].top + Math.min(all[i].h, vh) / 2 - vh / 2;
};
/** y from the section's geometry: f(g) with g = pgGeo(sel). */
const secY = (R, sel, f) => async () => {
  const g = await geo(R, sel);
  return g ? f(g) : null;
};

// ------------------------------------------------------------------ shared steps
/** Puts each deck card on top (desktop) or centres it (phones) and captures it. */
async function deckCards(R, pageKey, sectionSel, which) {
  const sel = `${sectionSel} [data-deck]`;
  const d = await R.page.evaluate(pgDeck, sel);
  if (!d || !d.ids.length) return missing(R, sel, "AI deck");
  if (!d.live && !S.phone) log(`  ${R.path}: deck not live (no [data-deck-live]); centring each card instead`);
  const ks = which === "ends" ? [...new Set([0, d.ids.length - 1])] : d.ids.map((_, k) => k);
  for (const k of ks) {
    await attempt(R, `${pageKey} deck card ${k + 1}`, async () => {
      await goTo(R, async () => { const now = await R.page.evaluate(pgDeck, sel); return now ? now.ys[k] : null; });
      if (d.live && !S.phone) {
        for (let n = 0; n < 6; n++) { // nudge until data-deck-index says card k is on top
          const idx = await R.page.evaluate((s) => Number(document.querySelector(s).getAttribute("data-deck-index")), sel);
          if (idx === k || Number.isNaN(idx)) break;
          await R.page.mouse.wheel(0, idx < k ? 90 : -90);
          await settleScroll(R.page, 700, 2);
        }
      }
      const id = d.ids[k];
      await cap(R, pageKey, `${d.live ? "ai-deck" : "ai-card"}-${k + 1}${id ? `-${id}` : ""}`, { intended: id || undefined, intendedOf: "project" }, S.settle + 400);
    });
  }
}

const openIdxOf = (R, sel) => R.page.evaluate((s) => [...document.querySelectorAll(s)].map((d, k) => (d.open ? k : -1)).filter((k) => k >= 0), sel);
const press = (loc) => (S.phone ? loc.tap({ timeout: 5000 }) : loc.click({ timeout: 5000 }));

/** Idle (section top) + optionally hover the first item + open items in turn (closing the previous). */
async function faqSteps(R, pageKey, { idle = true, hover = false, openAll = true, sectionSel = '[data-section="faq"]' } = {}) {
  if (!(await geo(R, sectionSel))) return missing(R, sectionSel, "FAQ section");
  let itemSel = `${sectionSel} details[data-faq-item]`;
  let items = await R.page.evaluate(pgGeoAll, itemSel);
  if (!items.length) {
    missing(R, itemSel, "faq lane item markup; falling back to plain <details>");
    itemSel = `${sectionSel} details`;
    items = await R.page.evaluate(pgGeoAll, itemSel);
    if (!items.length) return missing(R, itemSel, "FAQ items");
  }
  if (idle) await attempt(R, `${pageKey} faq idle`, async () => { const k = secY(R, sectionSel, (g) => g.top); await goTo(R, k); await cap(R, pageKey, "faq-idle", {}, S.settle, k); });
  if (hover && !S.phone) {
    await attempt(R, `${pageKey} faq hover`, async () => {
      await goTo(R, elY(R, itemSel, 0, 0.4));
      const box = await R.page.locator(itemSel).nth(0).locator("summary").boundingBox();
      if (!box) throw new Error("first FAQ summary has no box");
      await hoverBox(R.page, box);
      await cap(R, pageKey, "faq-hover", { intended: items[0] ? items[0].id || undefined : undefined, intendedOf: "focus" });
    });
  }
  const n = openAll ? items.length : 1;
  for (let i = 0; i < n; i++) {
    await attempt(R, `${pageKey} faq open ${i + 1}`, async () => {
      // Close whatever is open first (the lists are exclusive via name=, but be explicit).
      for (const k of await openIdxOf(R, itemSel)) {
        if (k === i) continue;
        await press(R.page.locator(itemSel).nth(k).locator("summary"));
        await R.page.waitForTimeout(250);
      }
      const k = elY(R, itemSel, i, 0.28);
      await goTo(R, k);
      const item = R.page.locator(itemSel).nth(i);
      if (!(await item.evaluate((d) => d.open))) await press(item.locator("summary"));
      const id = await item.getAttribute("data-focus-id");
      await cap(R, pageKey, `faq-open-${i + 1}`, { intended: id || undefined, intendedOf: "faq" }, S.settle + 300, k);
    });
  }
  // Leave the list closed and unfocused for the next steps (a tapped/clicked summary keeps focus,
  // and the stage would keep showing its data-focus in the next section's frames).
  await attempt(R, `${pageKey} faq close`, async () => {
    for (const k of await openIdxOf(R, itemSel)) await R.page.locator(itemSel).nth(k).evaluate((d) => { d.open = false; });
    await R.page.evaluate(() => { if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); });
  });
}

/** Frames at 25/50/75 % of the boundary sweep from A's bottom at the viewport bottom to B's top at the viewport top. */
async function transition(R, a, b) {
  const selA = `[data-section="${a}"]`;
  // The site footer (role contentinfo): a <footer> outside <main>, never one inside a card.
  const selB = b === "footer" ? "body footer:not(main footer)" : `[data-section="${b}"]`;
  if (!(await geo(R, selA))) return missing(R, selA, "transition start section");
  if (!(await geo(R, selB))) return missing(R, selB, "transition end section");
  for (const f of lean(R) ? [0.5] : [0.25, 0.5, 0.75]) {
    await attempt(R, `transition ${a}->${b} ${Math.round(f * 100)}%`, async () => {
      await goTo(R, async () => {
        const A = await geo(R, selA), B = await geo(R, selB);
        if (!A || !B) return null;
        const y0 = A.bottom - A.vh, y1 = Math.min(B.top, B.max);
        return y0 + (y1 - y0) * f;
      });
      await cap(R, "home", `t-${a}-${b}-${Math.round(f * 100)}`, {}, 1200);
    });
  }
}

// ------------------------------------------------------------------ home tour
async function homeTour(R) {
  await open(R, "/");
  const vh = R.page.viewportSize().height;
  R.t0 = Date.now();
  try {
    const c = await R.page.evaluate(pgHomeCounts), hov = S.phone ? 0 : 1;
    R.plan = (want("ai") ? 2 + c.deck : 0) + (want("transitions") ? 18 : 0) + (want("services") ? 3 + c.services * hov : 0) +
      (want("writing") ? 1 + c.posts * hov : 0) + (want("faq") ? 1 + hov + c.faq : 0) + (want("contact") ? 9 + c.chans * hov : 0);
  } catch (e) {}

  if (want("ai")) {
    const sec = '[data-section="ai"]';
    if (!(await geo(R, sec))) missing(R, sec, "home AI section");
    else {
      await attempt(R, "ai top", async () => { const k = secY(R, sec, (g) => g.top); await goTo(R, k); await cap(R, "home", "ai-top", {}, S.settle, k); });
      await deckCards(R, "home", sec, "all");
      if (!lean(R)) await attempt(R, "ai mid", async () => { const k = secY(R, sec, (g) => g.top + (g.h - g.vh) / 2); await goTo(R, k); await cap(R, "home", "ai-mid", {}, S.settle, k); });
      if (!want("transitions")) await attempt(R, "ai end", async () => { const k = secY(R, sec, (g) => g.bottom - g.vh); await goTo(R, k); await cap(R, "home", "ai-end", {}, S.settle, k); });
    }
  }

  if (want("transitions")) {
    await transition(R, "ai", "work");
    await transition(R, "work", "services");
  }

  if (want("services")) {
    const sec = '[data-section="services"]';
    if (!(await geo(R, sec))) missing(R, sec, "home services section");
    else {
      await attempt(R, "services entry", async () => { const k = secY(R, sec, (g) => g.top); await goTo(R, k); await cap(R, "home", "services-entry", {}, S.settle, k); });
      const itemSel = `${sec} [data-arch-item]`;
      const items = await R.page.evaluate(pgGeoAll, itemSel);
      if (!items.length) missing(R, itemSel, "service cards");
      if (!S.phone) {
        for (let i = 0; i < items.length; i++) {
          await attempt(R, `services hover ${i + 1}`, async () => {
            await goTo(R, elCentreY(R, itemSel, i));
            const loc = R.page.locator(itemSel).nth(i);
            const box = await loc.boundingBox();
            if (!box) throw new Error(`service card ${i + 1} has no box`);
            await hoverBox(R.page, box);
            const id = await loc.getAttribute("data-focus-id");
            await cap(R, "home", `services-hover-${(id || `card-${i + 1}`).replace(/^service:/, "")}`, { intended: id || undefined, intendedOf: "focus" });
          });
        }
      }
      const g0 = await geo(R, sec);
      const n = Math.max(2, Math.min(5, Math.ceil(Math.max(0, g0.h - vh) / (vh * 0.6)) + 1));
      for (let k = 1; k < n; k++) { // k = 0 is the section top: the services-entry frame
        if (lean(R)) break;
        await attempt(R, `services scroll ${k + 1}/${n}`, async () => {
          await goTo(R, secY(R, sec, (g) => g.top + (Math.max(0, g.h - g.vh) * k) / (n - 1)));
          await cap(R, "home", `services-scroll-${k + 1}`);
        });
      }
    }
  }

  if (want("transitions")) await transition(R, "services", "writing");
  if (want("writing")) await writingSteps(R);
  if (want("transitions")) await transition(R, "writing", "faq");

  if (want("faq")) await faqSteps(R, "home", { idle: true, hover: true, openAll: true });

  if (want("transitions")) await transition(R, "faq", "contact");
  if (want("contact")) await contactHome(R);
  // Last, so a run cut by its time share loses the footer frames before the contact interactions.
  if (want("transitions")) await transition(R, "contact", "footer");
}

/**
 * Writing (scene key "writing", lane fm3-writing): entry, each post card hovered, end.
 * Cards are found by data-focus-id="post:<slug>" (the lane's contract); until the lane lands,
 * by the post links in the section (role link, href /blog/<slug>), and the hook is reported missing.
 */
async function writingSteps(R) {
  const sec = '[data-section="writing"]';
  if (!(await geo(R, sec))) return missing(R, sec, "home writing section");
  await attempt(R, "writing entry", async () => { const k = secY(R, sec, (g) => g.top); await goTo(R, k); await cap(R, "home", "writing-entry", {}, S.settle, k); });
  let itemSel = `${sec} [data-focus-id^="post:"]`;
  let items = (await R.page.evaluate(pgGeoAll, itemSel)).filter(Boolean);
  if (!items.length) {
    missing(R, itemSel, 'writing post cards (data-focus-id="post:<slug>"); hovering the post links instead');
    itemSel = `${sec} li a[href^="/blog/"]`;
    items = (await R.page.evaluate(pgGeoAll, itemSel)).filter(Boolean);
    if (!items.length) return missing(R, itemSel, "writing post links");
  }
  if (!S.phone) {
    for (let i = 0; i < items.length; i++) {
      await attempt(R, `writing hover ${i + 1}`, async () => {
        await goTo(R, elCentreY(R, itemSel, i));
        const loc = R.page.locator(itemSel).nth(i);
        const box = await loc.boundingBox();
        if (!box) throw new Error(`post card ${i + 1} has no box`);
        await hoverBox(R.page, box);
        const id = await loc.getAttribute("data-focus-id");
        await cap(R, "home", `writing-hover-${i + 1}${id ? `-${id.replace(/^post:/, "").slice(0, 24)}` : ""}`, id ? { intended: id, intendedOf: "focus" } : {});
      });
    }
  }
  if (!want("transitions")) await attempt(R, "writing end", async () => { const k = secY(R, sec, (g) => g.bottom - g.vh); await goTo(R, k); await cap(R, "home", "writing-end", {}, S.settle, k); });
}

async function contactHome(R) {
  const sec = '[data-section="contact"]';
  if (!(await geo(R, sec))) return missing(R, sec, "home contact section");
  await attempt(R, "contact entry", async () => { const k = secY(R, sec, (g) => g.top); await goTo(R, k); await cap(R, "home", "contact-entry", {}, S.settle, k); });
  if (!lean(R)) await attempt(R, "contact mid", async () => { const k = secY(R, sec, (g) => g.top + (g.h - g.vh) / 2); await goTo(R, k); await cap(R, "home", "contact-mid", {}, S.settle, k); });

  // Channel links (data-focus-id="contact:<channel>"), one per channel, links before the copy button.
  const chanSel = `${sec} [data-focus-id^="contact:"]`;
  const chans = await R.page.evaluate(pgGeoAll, chanSel);
  if (!chans.some(Boolean)) missing(R, chanSel, "contact channel links");
  if (!S.phone) {
    const seen = new Set();
    const order = chans.map((c, i) => ({ c, i })).filter((x) => x.c).sort((p, q) => (p.c.tag === "a" ? 0 : 1) - (q.c.tag === "a" ? 0 : 1) || p.i - q.i);
    for (const { c, i } of order) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      await attempt(R, `contact hover ${c.id}`, async () => {
        await goTo(R, elY(R, chanSel, i, 0.5));
        const box = await R.page.locator(chanSel).nth(i).boundingBox();
        if (!box) throw new Error("channel link has no box");
        await hoverBox(R.page, box);
        await cap(R, "home", `contact-hover-${c.id.replace(/^contact:/, "")}`, { intended: c.id, intendedOf: "focus" });
      });
    }
  }

  const f = (name) => `${sec} #contact-${name}`;
  if (!(await R.page.locator(f("name")).count())) return missing(R, f("name"), "home contact form");
  await attempt(R, "contact name focus", async () => {
    await goTo(R, elY(R, f("name"), 0, 0.35));
    await R.page.locator(f("name")).click();
    await cap(R, "home", "contact-name-focus");
  });
  await attempt(R, "contact typing", async () => {
    await goTo(R, elY(R, f("message"), 0, 0.35));
    await R.page.locator(f("message")).click();
    // Captured mid-typing (the globe paces its sparks on each keystroke).
    const typing = R.page.keyboard.type("Hi Raish, QA tour typing to check the globe sparks.", { delay: 40 }).catch(() => {});
    await R.page.waitForTimeout(800);
    await cap(R, "home", "contact-typing", {}, 0);
    await typing;
  });
  await attempt(R, "contact copy email", async () => {
    const sel = `${sec} button[data-focus-id="contact:email"]`;
    if (!(await R.page.locator(sel).count())) return missing(R, sel, "copy-email button");
    await goTo(R, elY(R, sel, 0, 0.5));
    const btn = R.page.locator(sel).first();
    if (!S.phone) await hoverBox(R.page, await btn.boundingBox());
    await btn.click();
    // "Copied ✓" only lasts 2 s: read the state before the (possibly slow) screenshot.
    const copied = await R.page.waitForFunction((s) => /copied/i.test(document.querySelector(s).textContent), sel, { timeout: 1500 }).then(() => true, () => false);
    const clipboard = await R.page.evaluate(() => navigator.clipboard.readText()).catch((e) => `(unreadable: ${String(e && e.message).slice(0, 80)})`);
    if (!copied) S.tool.push({ run: R.run, page: R.path, step: "contact copy email", error: 'button never showed "Copied"' });
    await cap(R, "home", "contact-copy-flight", { copied, clipboard }, 250);
    await cap(R, "home", "contact-copy-landed", {}, 1300);
  });
  await attempt(R, "contact submit (intercepted)", async () => {
    if (!(await R.page.locator(f("name")).count())) throw new Error("form gone before submit");
    await R.page.locator(f("name")).fill("QA Robot");
    await R.page.locator(f("email")).fill("qa@example.com");
    await R.page.locator(f("subject")).fill("Owner-view QA (intercepted, never sent)");
    const m = await R.page.locator(f("message")).inputValue();
    if (m.trim().length < 2) await R.page.locator(f("message")).fill("QA tour message (intercepted).");
    const btn = `${sec} form button[type="submit"]`;
    await goTo(R, elY(R, btn, 0, 0.55));
    const before = S.intercepted.length;
    let release;
    S.contactGate = new Promise((r) => { release = r; });
    try {
      await R.page.locator(btn).click();
      // The response is held (S.contactGate) so the "Sending" frame is deterministic.
      const t = Date.now();
      while (S.intercepted.length === before && Date.now() - t < 4000) await R.page.waitForTimeout(50);
      const n = S.intercepted.length - before;
      if (!n) S.tool.push({ run: R.run, page: R.path, step: "contact submit", error: "no /api/contact request was seen (client validation failed?)" });
      await cap(R, "home", "contact-submit-sending", { intercepted: n }, 500);
    } finally {
      release();
      S.contactGate = null;
    }
    // The form swaps to "Message sent." (shorter: the page below moves up) and the packet flies to the city.
    await cap(R, "home", "contact-submit-sent-flight", {}, 600);
    // The form's always-mounted live region (role=status) announces the sent state.
    const sentState = await R.page.locator(`${sec} [role="status"]`).first().textContent().then((t) => /sent/i.test(t || "")).catch(() => null);
    if (!sentState) S.tool.push({ run: R.run, page: R.path, step: "contact submit", error: 'no "Message sent." state after the intercepted success response' });
    await cap(R, "home", "contact-submit-sent", { sentState }, 1300);
  });
}

/** Captures one section: its top at the viewport top (frac 0) or centred (frac null). */
async function sectionShot(R, pageKey, sel, state, frac = null) {
  await attempt(R, `${pageKey} ${state}`, async () => {
    if (!(await geo(R, sel))) return missing(R, sel, `${pageKey} ${state} section`);
    const k = frac == null ? elCentreY(R, sel, 0) : elY(R, sel, 0, frac);
    await goTo(R, k);
    await cap(R, pageKey, state, {}, S.settle, k);
  });
}

// ------------------------------------------------------------------ subpage tour
async function pagesTour(R) {
  // Frame plan for lean(): refined once /services shows how many service pages and list steps there are.
  const plan = (slugN, engN) => (want("projects") ? 3 + (S.phone ? 1 : 0) : 0) + (want("services-page") ? 2 + engN : 0) +
    (want("service-pages") ? 3 * slugN : 0) + (want("contact-page") ? 2 : 0) + (want("about") ? 3 : 0);
  R.t0 = Date.now();
  R.plan = plan(4, 4);
  if (want("projects")) {
    await attempt(R, "load /projects", () => open(R, "/projects"));
    if (R.loaded === "/projects") {
      // Desktop: the first deck position already shows the section head; phones open with the 3D window.
      if (S.phone) await sectionShot(R, "projects", '[data-section="ai"]', "ai-top", 0);
      await deckCards(R, "projects", '[data-section="ai"]', "ends");
      await sectionShot(R, "projects", '[data-section="cta"]', "cta");
    }
  }

  let slugs = [];
  if (want("services-page") || want("service-pages")) {
    await attempt(R, "load /services", () => open(R, "/services"));
    if (R.loaded === "/services") {
      slugs = await R.page.evaluate(() => [...new Set([...document.querySelectorAll('main a[href^="/services/"]')].map((a) => new URL(a.href).pathname.replace(/\/+$/, "")))].filter((p) => /^\/services\/[^/]+$/.test(p)));
      if (!slugs.length) missing(R, 'main a[href^="/services/"]', "service page links on /services");
      if (want("services-page")) {
        await attempt(R, "/services top", async () => { await scrollTo(R.page, 0); await cap(R, "services", "top"); });
        const sec = '[data-section="engagements"]';
        const g0 = await geo(R, sec);
        if (!g0) missing(R, sec, "/services engagements list");
        const n = g0 ? Math.max(3, Math.min(6, Math.ceil(Math.max(0, g0.h - g0.vh) / (g0.vh * 0.7)) + 1)) : 0;
        R.plan = plan(slugs.length, n);
        for (let k = 0; k < n; k++) {
          if (k > 0 && k < n - 1 && lean(R)) continue; // lean: the first and the last list step only
          await attempt(R, `/services engagements ${k + 1}/${n}`, async () => {
            await goTo(R, secY(R, sec, (g) => g.top + (Math.max(0, g.h - g.vh) * k) / (n - 1)));
            await cap(R, "services", `engagements-${k + 1}`);
          });
        }
        await sectionShot(R, "services", '[data-section="cta"]', "cta");
      }
    }
  }

  if (want("service-pages")) {
    for (const [i, p] of slugs.entries()) {
      const key = `service-${p.split("/").pop()}`;
      await attempt(R, `load ${p}`, () => open(R, p));
      if (R.loaded !== p) continue;
      await attempt(R, `${p} top`, async () => { await scrollTo(R.page, 0); await cap(R, key, "top"); });
      await faqSteps(R, key, { idle: false, hover: false, openAll: false });
      if (i === 0 || !lean(R)) await sectionShot(R, key, '[data-section="cta"]', "cta"); // lean: one service CTA (the same band on each)
    }
  }

  if (want("contact-page")) {
    await attempt(R, "load /contact", () => open(R, "/contact"));
    if (R.loaded === "/contact") {
      await attempt(R, "/contact top", async () => { await scrollTo(R.page, 0); await cap(R, "contact", "top"); });
      await attempt(R, "/contact form focus", async () => {
        const sel = '[data-section="contact"] #contact-name';
        if (!(await geo(R, sel))) return missing(R, sel, "/contact form");
        await goTo(R, elY(R, sel, 0, 0.4));
        await R.page.locator(sel).click();
        await cap(R, "contact", "form-focus");
      });
    }
  }

  if (want("about")) {
    await attempt(R, "load /about", () => open(R, "/about"));
    if (R.loaded === "/about") {
      await faqSteps(R, "about", { idle: true, hover: false, openAll: false });
      await sectionShot(R, "about", '[data-section="related"]', "keep-exploring");
    }
  }
}

// ------------------------------------------------------------------ outputs
async function buildSheets() {
  const out = [];
  const groups = [["home", "Home"], ["pages", "Pages"]];
  const cols = S.phone ? 7 : 4, thumbW = S.phone ? 190 : 380;
  const ownBrowser = !S.browser;
  const browser = S.browser || (await chromium.launch({ executablePath: EXE }));
  try {
    for (const [g, label] of groups) {
      const items = S.index.filter((r) => r.group === g);
      if (!items.length) continue;
      const title = `${label} · ${S.mode}${S.light ? " · light" : " · dark"} · ${S.base} · ${new Date().toISOString().slice(0, 16)} · ${items.length} captures`;
      const htmlPath = path.join(S.out, `sheet-${g}.html`);
      // Phones start at data-quality=low by design (stage.tsx: pointer: coarse), so only desktop flags it.
      fs.writeFileSync(htmlPath, buildSheetHtml(title, items, { cols, thumbW, baseQ: S.phone ? "low" : "high" }));
      const ctx = await browser.newContext({ viewport: { width: 32 + cols * thumbW + (cols - 1) * 12, height: 900 }, deviceScaleFactor: 1 });
      try {
        const p = await ctx.newPage();
        await p.goto(pathToFileURL(htmlPath).href, { waitUntil: "load", timeout: 60000 });
        await p.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 30000 }).catch(() => {});
        const png = path.join(S.out, `sheet-${g}.png`);
        await p.screenshot({ path: png, fullPage: true, timeout: 60000 });
        out.push(png);
      } finally {
        await ctx.close();
      }
    }
  } finally {
    if (ownBrowser) await browser.close();
  }
  return out;
}

function writeOutputs(extra = {}) {
  const index = S.index.map(({ shot, ...r }) => (shot ? r : { ...r, file: null, wanted: r.file }));
  fs.writeFileSync(path.join(S.out, "index.json"), JSON.stringify(index, null, 2));
  fs.writeFileSync(path.join(S.out, "errors.json"), JSON.stringify({ console: S.errors, tool: S.tool }, null, 2));
  fs.writeFileSync(path.join(S.out, "run.json"), JSON.stringify({
    base: S.base, mode: S.mode, theme: S.light ? "light" : "dark", parallel: S.parallel, settleMs: S.settle,
    durationMs: Date.now() - S.t0, timedOut: S.timedOut, captures: S.index.length, failedCaptures: S.index.filter((r) => !r.shot).length,
    lean: S.lean || false, canvasDrops: S.drops, interceptedContact: S.intercepted, blockedApiWrites: S.blocked, missingHooks: S.missing.map(({ key, ...m }) => m), ...extra,
  }, null, 2));
}

// ------------------------------------------------------------------ main
async function main() {
  const argv = process.argv.slice(2);
  const flags = new Set(argv.filter((a) => a.startsWith("--")));
  const [baseArg, outArg] = argv.filter((a) => !a.startsWith("--"));
  const known = ["--wide", "--light", "--phone", "--parallel", "--sheets-only"];
  const unknown = [...flags].filter((f) => !known.includes(f));
  if ((!baseArg || !outArg) && !(flags.has("--sheets-only") && (outArg || baseArg)) || unknown.length) {
    console.error(`Usage: node fm3-owner.cjs <baseUrl> <outDir> [--wide] [--light] [--phone] [--parallel] [--sheets-only]${unknown.length ? `\nUnknown flag(s): ${unknown.join(" ")}` : ""}`);
    process.exit(2);
  }
  S.phone = flags.has("--phone");
  S.wide = flags.has("--wide") && !S.phone;
  S.light = flags.has("--light");
  S.parallel = flags.has("--parallel");
  S.mode = S.phone ? "phone" : S.wide ? "wide" : "owner";
  S.settle = Number(process.env.FM3_SETTLE) || 1400;
  S.budget = Number(process.env.FM3_MAX_MS) || 330000;
  S.reloads = process.env.FM3_RELOADS != null && process.env.FM3_RELOADS !== "" ? Number(process.env.FM3_RELOADS) : 6;
  S.only = process.env.FM3_ONLY ? process.env.FM3_ONLY.split(",").map((x) => x.trim()).filter(Boolean) : null;

  if (flags.has("--sheets-only")) {
    S.out = path.resolve(outArg || baseArg);
    S.index = JSON.parse(fs.readFileSync(path.join(S.out, "index.json"), "utf8")).map((r) => (r.file ? { ...r, shot: true } : { ...r, file: r.wanted, shot: false }));
    try { const run = JSON.parse(fs.readFileSync(path.join(S.out, "run.json"), "utf8")); Object.assign(S, { base: run.base, mode: run.mode, light: run.theme === "light", phone: run.mode === "phone" }); } catch {}
    const sheets = await buildSheets();
    console.log(sheets.join("\n"));
    return 0;
  }

  S.base = baseArg.replace(/\/+$/, "");
  S.out = path.resolve(outArg);
  fs.mkdirSync(S.out, { recursive: true });
  try {
    const r = await fetch(S.base + "/", { signal: AbortSignal.timeout(30000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
  } catch (e) {
    console.error(`Base URL not reachable: ${S.base}/ (${msg(e)})`);
    process.exit(2);
  }

  S.t0 = Date.now();
  S.deadline = S.t0 + S.budget;
  log(`fm3-owner ${S.mode}${S.light ? " light" : " dark"} -> ${S.out}${S.only ? ` (only ${S.only.join(",")})` : ""}`);
  S.browser = await chromium.launch({ executablePath: EXE, args: GPU_ARGS });
  // A step stuck past the soft budget (a hung goto/screenshot): write what we have, try the sheets for 20 s, exit 3.
  const hard = setTimeout(async () => {
    log("hard timeout: writing partial outputs");
    S.timedOut = true;
    writeOutputs({ hardTimeout: true });
    const sheets = await Promise.race([buildSheets().catch(() => []), new Promise((r) => setTimeout(() => r([]), 20000))]);
    writeOutputs({ hardTimeout: true, sheets: sheets.map((s) => path.basename(s)) });
    process.exit(3);
  }, S.budget + 20000);

  const runs = [];
  const mk = async (run, group, fn) => {
    const ctx = await newCtx(run);
    const page = await ctx.newPage();
    watch(page, run);
    const R = { run, group, ctx, page, path: null, live: false };
    try {
      await fn(R);
    } catch (e) {
      if (!(e instanceof Abort)) S.tool.push({ run, page: R.path, step: "tour", error: msg(e) });
      log(`${run}: stopped: ${msg(e)}`);
    } finally {
      await ctx.close().catch(() => {});
    }
  };
  const homeOn = ["ai", "services", "writing", "faq", "contact", "transitions"].some(want);
  const pagesOn = ["projects", "services-page", "service-pages", "contact-page", "about"].some(want);
  if (S.parallel) {
    if (homeOn) runs.push(mk("home", "home", homeTour));
    if (pagesOn) runs.push(mk("pages", "pages", pagesTour));
    await Promise.all(runs);
  } else {
    if (homeOn) {
      S.deadline = S.t0 + (pagesOn ? S.budget * HOME_SHARE : S.budget);
      await mk("home", "home", homeTour);
    }
    S.deadline = S.t0 + S.budget;
    if (pagesOn) await mk("pages", "pages", pagesTour);
  }

  writeOutputs();
  let sheets = [];
  try { sheets = await buildSheets(); } catch (e) { S.tool.push({ step: "contact sheets", error: msg(e) }); }
  writeOutputs({ sheets: sheets.map((s) => path.basename(s)) });
  clearTimeout(hard);
  await S.browser.close().catch(() => {});

  const failed = S.index.filter((r) => !r.shot).length;
  log(`done: ${S.index.length} captures (${failed} failed), ${S.errors.length} console errors, ${S.tool.length} failed steps, ` +
    `${S.intercepted.length} contact POST intercepted, ${S.blocked.length} API writes blocked, ${S.missing.length} missing hooks, ${S.drops.length} 3D drops`);
  if (S.lean) log(`  went lean at ${S.lean.at} s on ${S.lean.page} (${S.lean.framesDone}/${S.lean.framesPlanned} home frames, projected ${S.lean.projectedEnd} s > ${S.lean.deadline} s)`);
  for (const d of S.drops) log(`  3D DROPPED to the poster: ${d.page} at ${d.at} (section ${d.section}, data-quality=${d.quality}, y=${d.y})${d.recovered ? ", page reloaded" : ""}`);
  for (const m of S.missing) log(`  missing hook: ${m.page} ${m.selector} (${m.what})`);
  for (const t of S.tool) log(`  failed step: ${t.run || ""} ${t.page || ""} ${t.step}: ${t.error}`);
  for (const e of S.errors.slice(0, 15)) log(`  console: ${e.page} [${e.state}] ${e.kind}: ${e.text.slice(0, 160)}`);
  if (sheets.length) log(`sheets: ${sheets.join(", ")}`);
  return S.timedOut ? 3 : failed || S.tool.length ? 1 : 0;
}

// Internals for offline/targeted tests of the tool itself.
module.exports._test = { S, newCtx, watch, open, ensureLive, attempt, cap, goTo, faqSteps };

if (require.main === module) {
  main().then((code) => process.exit(code || 0), (e) => {
    console.error(e && e.stack ? e.stack : e);
    try { writeOutputs({ crashed: msg(e) }); } catch {}
    process.exit(1);
  });
}

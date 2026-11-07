#!/usr/bin/env node
/* fm-tour.cjs: full-motion QA tour of the 3D portfolio against tasks/fullmotion-spec.md
 * ("Diagnosis" + "Contract between lanes"). Read-only: it only loads pages.
 *
 * Usage:  node fm-tour.cjs <baseUrl> <outDir> [--quick]
 *   --quick  skip the scroll videos and the light-theme frames
 * Env:    FM_SERIAL=1        run the two step lanes one after the other (default: in parallel)
 *         FM_CARD_SEL=<css>  card selector for check f (default [data-card]; for debugging the check)
 *         FM_ONLY=a,b        run only these steps (frames,cards,anchors,light,motion-off,reduced,mobile,tour)
 *
 * Output in <outDir>: report.json, frames/ (home 1440x900 dark), mobile/, light/, video/*.webm
 * Offline self-tests of the in-page probes (no server): node fm-libtest.cjs; node fm-cardtest.cjs
 * Exit code: 0 = every check PASS, 1 = any FAIL/ERROR, 2 = usage or base URL unreachable, 3 = global timeout (partial report).
 *
 * Checks:
 *  a  no pageerror / console.error on any page (THREE.Clock deprecation ignored; Next dev "N Issues" badge counts)
 *  b  every page with [data-neural-stage] has 0 or 1 <canvas>
 *  c  home: consecutive [data-section]s never share a data-stage value (missing = default "left")
 *  d  home: with a section centred, stage data-scene = section data-scene | data-section if scene key | "ambient"
 *  e  stage labels: never visible over .panel/[data-card]/[data-occlude]/h1-h3/p, never clipped by the viewport
 *  f  home + /projects: >=70% of [data-card] non-rest before entering; all end opacity 1 + identity/tilt-rest
 *  g  cp:3d=off (home, /projects): [data-card],[data-reveal],h1,h2,p at opacity 1; no active pin; no x-overflow
 *  h  OS reduced motion, no cp:3d: owner decision (2026-11-06) = motion + 3D still ON for everyone; html[data-motion]=on, a canvas mounts, everything ends visible
 *  i  mobile 390x844 (home, /projects): no x-overflow; every p/h2 visible; 6 frames each
 *  j  home header #anchors land the target 0-200 px below the viewport top (from top and from bottom)
 *  k  light theme: 3 frames of home, html not .dark
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const argv = process.argv.slice(2);
const QUICK = argv.includes("--quick");
const [BASE_ARG, OUT_ARG] = argv.filter((a) => !a.startsWith("--"));
if (!BASE_ARG || !OUT_ARG) {
  console.error("Usage: node fm-tour.cjs <baseUrl> <outDir> [--quick]");
  process.exit(2);
}
const BASE = BASE_ARG.replace(/\/+$/, "");
const OUT = path.resolve(OUT_ARG);
const EXE = "/home/raish/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell";
const ARGS = ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=gl"];
const SCENE_KEYS = ["hero", "stack", "experience", "ai", "work", "services", "faq", "contact", "ambient"];
const STAGE_VALUES = ["left", "right", "full", "band"];
const NOT_FOUND = "/this-page-does-not-exist";
const CARD_SEL = process.env.FM_CARD_SEL || "[data-card]";
const SERIAL = process.env.FM_SERIAL === "1";
const ONLY = process.env.FM_ONLY ? process.env.FM_ONLY.split(",").map((x) => x.trim()) : null;
const T_START = Date.now();
const GLOBAL_MS = QUICK ? 300000 : 600000;

for (const d of ["frames", "mobile", "light", "video"]) fs.mkdirSync(path.join(OUT, d), { recursive: true });

// ---------------------------------------------------------------- report state
const TITLES = {
  a: "No pageerror / console error on any page",
  b: "Pages with [data-neural-stage] have 0 or 1 canvas",
  c: "Home: consecutive sections differ in data-stage",
  d: "Home: stage data-scene matches the centred section",
  e: "Stage labels not over panels/cards/text, not clipped",
  f: "Cards animate in (>=70%) and end fully visible",
  g: "Motion off: visible, no pins, no x-overflow",
  h: "OS reduced motion: still animated (owner), ends visible",
  i: "Mobile 390x844: no x-overflow, p/h2 visible",
  j: "Home header anchors land 0-200px from top",
  k: "Light theme frames of home",
};
const report = {
  base: BASE, out: OUT, quick: QUICK, started: new Date().toISOString(), durationMs: 0,
  cardSelector: CARD_SEL, blogPost: null, steps: {}, checks: {}, sections: [], frames: [], mobileFrames: [],
  lightFrames: [], videos: [], pages: {}, errors: [], notes: [],
};
for (const id of Object.keys(TITLES)) report.checks[id] = { id, title: TITLES[id], status: "SKIP", ran: false, failures: [], notes: [], error: null };
const C = (id) => report.checks[id];
const ran = (id) => (C(id).ran = true);
const fail = (id, msg, extra) => { ran(id); C(id).failures.push(extra ? { msg, ...extra } : { msg }); };
const note = (id, msg) => { ran(id); C(id).notes.push(msg); };
const errored = (id, msg) => (C(id).error = C(id).error ? `${C(id).error}; ${msg}` : msg);
const labelBad = new Map(); // grouped label failures for check e
let labelFramesScanned = 0, labelVisibleSeen = 0;
const log = (...a) => console.log(`[${((Date.now() - T_START) / 1000).toFixed(0).padStart(3)}s]`, ...a);

function recordCanvas(run, p, st) {
  if (!st) return;
  const pg = (report.pages[p] ||= { hasStage: false, maxCanvas: 0, runs: {} });
  const r = (pg.runs[run] ||= { hasStage: false, maxCanvas: 0, samples: 0 });
  r.samples++;
  r.hasStage ||= !!st.has;
  r.maxCanvas = Math.max(r.maxCanvas, st.canvases);
  pg.hasStage ||= !!st.has;
  pg.maxCanvas = Math.max(pg.maxCanvas, st.canvases);
}

function recordLabels(run, p, frame, scan) {
  if (!scan) return;
  ran("e");
  labelFramesScanned++;
  labelVisibleSeen += scan.visible;
  for (const b of scan.bad) {
    const key = `${run}|${p}|${b.text}|${b.why}|${b.detail}`;
    const g = labelBad.get(key) || { run, page: p, label: b.text, why: b.why, detail: b.detail, opacity: b.opacity, rect: b.rect, frames: [] };
    if (g.frames.length < 12) g.frames.push(frame);
    labelBad.set(key, g);
  }
}

// ---------------------------------------------------------------- in-page library (init script)
// Installed in every context before page scripts. window.__fm exposes the DOM probes; with
// opts.cardMon a rAF sampler records each card's state from the first frame (check f).
function FM_LIB(opts) {
  if (window.__fm) return;
  const nums = (s) => (String(s).match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || []).map(Number);
  const near = (a, b, e) => Math.abs(a - b) <= e;
  // Rest = identity within 1px / 1%, or a pure perspective() matrix (tilt rest state).
  function tfRest(t) {
    if (!t || t === "none") return true;
    const m = nums(t.slice(t.indexOf("(")));
    if (t.startsWith("matrix3d")) {
      if (m.length !== 16) return false;
      return near(m[0], 1, 0.01) && near(m[5], 1, 0.01) && near(m[10], 1, 0.01) && near(m[15], 1, 0.01) &&
        [1, 2, 4, 6, 8, 9].every((k) => near(m[k], 0, 0.01)) && near(m[3], 0, 1e-4) && near(m[7], 0, 1e-4) &&
        near(m[12], 0, 1) && near(m[13], 0, 1) && near(m[14], 0, 1);
    }
    if (m.length !== 6) return false;
    return near(m[0], 1, 0.01) && near(m[1], 0, 0.01) && near(m[2], 0, 0.01) && near(m[3], 1, 0.01) && near(m[4], 0, 1) && near(m[5], 0, 1);
  }
  // matrix -> "translate(x,y,z) scale rotX/rotY perspective" for messages.
  function explain(t) {
    const m = nums(t.slice(t.indexOf("(")));
    const f = (v, d = 1) => +v.toFixed(d);
    if (m.length === 6) return `translate(${f(m[4])}px,${f(m[5])}px) scale(${f(Math.hypot(m[0], m[1]), 3)}) rot ${f((Math.atan2(m[1], m[0]) * 180) / Math.PI, 2)}deg`;
    if (m.length !== 16) return t.slice(0, 80);
    const parts = [`translate3d(${f(m[12])}px,${f(m[13])}px,${f(m[14])}px)`, `scale(${f(Math.hypot(m[0], m[1], m[2]), 3)},${f(Math.hypot(m[4], m[5], m[6]), 3)})`,
      `rotX ${f((Math.atan2(m[6], m[5]) * 180) / Math.PI, 2)}deg`, `rotY ${f((Math.atan2(-m[2], m[0]) * 180) / Math.PI, 2)}deg`];
    if (Math.abs(m[11]) > 1e-6) parts.push(`perspective ${Math.round(-1 / m[11])}px`);
    if (Math.abs(m[15] - 1) > 0.01) parts.push(`w ${f(m[15], 3)}`);
    return parts.join(" ");
  }
  function restInfo(el) {
    const cs = getComputedStyle(el);
    const op = parseFloat(cs.opacity);
    const bits = [];
    if (op < 0.99) bits.push(`opacity ${op.toFixed(2)}`);
    if (!tfRest(cs.transform)) bits.push(`transform ${explain(cs.transform)}`);
    if (cs.translate && cs.translate !== "none" && nums(cs.translate).some((v) => Math.abs(v) > 1)) bits.push(`translate ${cs.translate}`);
    if (cs.scale && cs.scale !== "none" && nums(cs.scale).some((v) => Math.abs(v - 1) > 0.01)) bits.push(`scale ${cs.scale}`);
    if (cs.rotate && cs.rotate !== "none") { const n = nums(cs.rotate); if (n.length && Math.abs(n[n.length - 1]) > 0.5) bits.push(`rotate ${cs.rotate}`); }
    return bits;
  }
  function effOpacity(el) {
    let o = 1;
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === "none") return 0;
      o *= parseFloat(cs.opacity);
      if (o < 0.001) return 0;
    }
    return o;
  }
  const shown = (el) => { const v = getComputedStyle(el).visibility; return v !== "hidden" && v !== "collapse"; };
  const rendered = (el) => el.getClientRects().length > 0;
  function textRects(el) {
    const r = document.createRange();
    r.selectNodeContents(el);
    return [...r.getClientRects()].filter((q) => q.width >= 2 && q.height >= 2);
  }
  function union(rs) {
    if (!rs.length) return null;
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    for (const q of rs) { l = Math.min(l, q.left); t = Math.min(t, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom); }
    return { left: l, top: t, right: r, bottom: b, width: r - l, height: b - t };
  }
  const txt = (el, n = 48) => (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, n);
  function desc(el) {
    const sec = el.closest("[data-section]");
    let s = el.tagName.toLowerCase();
    if (el.matches(".panel")) s += ".panel";
    else if (/bg-background\/85/.test(el.getAttribute("class") || "")) s += "(panel look)";
    for (const a of ["data-card", "data-occlude", "data-reveal"]) if (el.hasAttribute(a)) s += `[${a}]`;
    const t = txt(el, 40);
    return (sec ? `${sec.getAttribute("data-section")} > ` : "") + s + (t ? ` "${t}"` : "");
  }
  const stageEl = () => document.querySelector("[data-neural-stage]");
  function stage() {
    const s = stageEl();
    return {
      has: !!s, scene: s ? s.getAttribute("data-scene") : null, layout: s ? s.getAttribute("data-stage-layout") : null,
      quality: s ? s.getAttribute("data-quality") : null, canvases: document.querySelectorAll("canvas").length,
      section: (() => { const c = innerHeight / 2; for (const el of document.querySelectorAll("[data-section]")) { const b = el.getBoundingClientRect(); if (b.top <= c && b.bottom >= c) return el.getAttribute("data-section"); } return null; })(),
    };
  }
  // Stage labels = outermost elements with their own text inside the stage, the R3F canvas
  // wrapper (drei <Html> mounts there) or a [data-neural-labels] layer (LabelLayer).
  function labelScan() {
    const vw = innerWidth, vh = innerHeight;
    const roots = [...new Set([stageEl(), ...document.querySelectorAll("[data-neural-canvas], [data-neural-labels]")])].filter(Boolean);
    const out = { total: 0, visible: 0, bad: [] };
    if (!roots.length) return out;
    const inRoots = (el) => roots.some((r) => r.contains(el));
    const textEls = new Set();
    for (const root of roots) {
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        if (!n.nodeValue.trim()) continue;
        const el = n.parentElement;
        if (!el || el.closest("svg, script, style, noscript, template")) continue;
        textEls.add(el);
      }
    }
    const labels = [...textEls].filter((el) => { for (let p = el.parentElement; p; p = p.parentElement) if (textEls.has(p)) return false; return true; });
    out.total = labels.length;
    if (!labels.length) return out;
    const vis = (el) => rendered(el) && shown(el) && effOpacity(el) > 0.05;
    const occ = [];
    document.querySelectorAll('.panel, [data-card], [data-occlude], [class*="bg-background/85"]').forEach((el) => {
      if (inRoots(el) || !vis(el)) return;
      const r = el.getBoundingClientRect();
      if (r.bottom <= 0 || r.top >= vh || r.width < 2 || r.height < 2) return;
      occ.push({ el, kind: "box", rects: [r] });
    });
    document.querySelectorAll("h1, h2, h3, p").forEach((el) => {
      if (inRoots(el) || !vis(el)) return;
      const rs = textRects(el).filter((r) => r.bottom > 0 && r.top < vh);
      if (rs.length) occ.push({ el, kind: "text", rects: rs });
    });
    for (const el of labels) {
      if (!rendered(el) || !shown(el)) continue;
      const op = effOpacity(el);
      if (op <= 0.05) continue;
      const cs = getComputedStyle(el);
      const boxy = !/^(transparent|rgba\(0, 0, 0, 0\))$/.test(cs.backgroundColor) || parseFloat(cs.borderTopWidth) > 0;
      const lr = boxy ? el.getBoundingClientRect() : union(textRects(el));
      if (!lr || lr.width < 1 || lr.height < 1) continue;
      if (!(lr.right > 0 && lr.left < vw && lr.bottom > 0 && lr.top < vh)) continue; // fully off-screen: not seen
      out.visible++;
      const L = { text: txt(el, 40), opacity: +op.toFixed(2), rect: [lr.left, lr.top, lr.width, lr.height].map(Math.round) };
      const clip = [];
      if (lr.left < -1) clip.push("left");
      if (lr.right > vw + 1) clip.push("right");
      if (lr.top < -1) clip.push("top");
      if (lr.bottom > vh + 1) clip.push("bottom");
      if (clip.length) out.bad.push({ ...L, why: "clipped", detail: `cut at the ${clip.join("+")} viewport edge` });
      let hit = null;
      for (const kind of ["text", "box"]) {
        for (const o of occ) {
          if (o.kind !== kind) continue;
          for (const r of o.rects) {
            const w = Math.min(lr.right, r.right) - Math.max(lr.left, r.left);
            const h = Math.min(lr.bottom, r.bottom) - Math.max(lr.top, r.top);
            if (w >= 2 && h >= 2) { hit = o; break; }
          }
          if (hit) break;
        }
        if (hit) break;
      }
      if (hit) out.bad.push({ ...L, why: hit.kind === "text" ? "over-text" : "over-panel", detail: desc(hit.el) });
    }
    return out;
  }
  const skip = (el) => { const s = stageEl(); return (s && s.contains(el)) || !!el.closest('[aria-hidden="true"]'); };
  // Checks g/h: every listed element fully visible, no active pin, no horizontal overflow.
  function staticCheck(sel) {
    const hidden = [];
    let checked = 0, notRendered = 0, ariaHidden = 0;
    document.querySelectorAll(sel).forEach((el) => {
      if (skip(el)) { ariaHidden++; return; }
      if (!rendered(el)) { notRendered++; return; }
      checked++;
      const op = effOpacity(el);
      if (op < 0.99 || !shown(el)) hidden.push(`${desc(el)} (opacity ${op.toFixed(2)}${shown(el) ? "" : ", visibility hidden"})`);
    });
    const pins = [...document.querySelectorAll(".pin-spacer")].map((sp) => {
      const c = sp.firstElementChild;
      const a = sp.offsetHeight, b = c ? c.offsetHeight : 0;
      return { child: c ? desc(c) : "(empty)", spacer: a, childH: b, pinned: Math.abs(a - b) > 1, fixed: c ? getComputedStyle(c).position === "fixed" : false };
    });
    return {
      checked, notRendered, ariaHidden, hidden, pins, sw: document.documentElement.scrollWidth, iw: innerWidth,
      canvases: document.querySelectorAll("canvas").length, motion: document.documentElement.getAttribute("data-motion"),
      reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
    };
  }
  // Check i: every rendered p/h2 visible and not pushed off-screen sideways.
  function mobileCheck() {
    const vw = innerWidth, bad = [], offX = [];
    let checked = 0, notRendered = 0;
    const scrollerX = (el) => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) if (getComputedStyle(p).overflowX !== "visible") return true; return false; };
    document.querySelectorAll("p, h2").forEach((el) => {
      if (skip(el)) return;
      if (!rendered(el)) { notRendered++; return; }
      checked++;
      const op = effOpacity(el);
      if (op < 0.99 || !shown(el)) { bad.push(`${desc(el)} (opacity ${op.toFixed(2)}${shown(el) ? "" : ", visibility hidden"})`); return; }
      const r = el.getBoundingClientRect();
      if ((r.right > vw + 1 || r.left < -1) && !scrollerX(el)) offX.push(`${desc(el)} (x ${Math.round(r.left)}..${Math.round(r.right)})`);
    });
    return { checked, notRendered, bad, offX, sw: document.documentElement.scrollWidth, iw: vw };
  }
  // Outermost elements that stick out past the right edge without a clipping ancestor (x-overflow culprits).
  function overflowers(limit = 4) {
    const vw = innerWidth, hits = new Set();
    const free = (el) => {
      for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.position === "fixed") return false;
        if (e !== el && cs.overflowX !== "visible") return false;
      }
      return true;
    };
    for (const el of document.body.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.width && r.right > vw + 1 && free(el)) hits.add(el);
    }
    return [...hits].filter((el) => !hits.has(el.parentElement)).slice(0, limit).map((el) => `${desc(el)} (right edge ${Math.round(el.getBoundingClientRect().right)}px)`);
  }
  // Next dev overlay "N Issues" badge (shadow DOM of <nextjs-portal>).
  function devIssues() {
    const root = document.querySelector("nextjs-portal")?.shadowRoot;
    if (!root) return null;
    const c = root.querySelector("[data-issues-count]"); // Next 15/16 badge (the exit digit is aria-hidden)
    if (c) return parseInt(c.textContent, 10) || 0;
    for (const el of root.querySelectorAll("button, [data-issues]")) {
      const m = /(\d+)\s*Issues?/i.exec((el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " "));
      if (m) return +m[1];
    }
    return 0;
  }

  // Card monitor (check f).
  const cardState = new Map();
  let cardOrder = 0;
  const byIndex = [];
  const visRatio = (r, vw, vh) => {
    const visH = Math.min(r.bottom, vh) - Math.max(r.top, 0), visW = Math.min(r.right, vw) - Math.max(r.left, 0);
    if (visH <= 0 || visW <= 0) return 0;
    return Math.min(visH / Math.min(r.height, vh), visW / Math.min(r.width, vw));
  };
  const okOf = (el, s) => (el.closest("[data-deck]") ? s.everOk : s.lastOk);
  const cards = {
    tick() {
      const vh = innerHeight, vw = innerWidth, y = scrollY;
      document.querySelectorAll(opts.cardSel).forEach((el) => {
        let s = cardState.get(el);
        if (!s) {
          s = { i: cardOrder++, pre: false, restInView: false, rendered: false, seen: 0, everOk: false, lastOk: null, lastBad: null, preState: null, minY: null, maxY: null };
          cardState.set(el, s);
          byIndex[s.i] = el;
        }
        const r = el.getBoundingClientRect();
        if (!r.width && !r.height) return;
        s.rendered = true;
        const inView = r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw;
        if (inView) { s.minY = s.minY == null ? y : Math.min(s.minY, y); s.maxY = s.maxY == null ? y : Math.max(s.maxY, y); }
        if (s.restInView) return;
        const bits = restInfo(el);
        if (bits.length) { if (!s.pre) s.preState = bits.join(", "); s.pre = true; }
        else if (inView) s.restInView = true;
      });
    },
    // State of the on-screen cards, to wait until their entrances have finished.
    signature() {
      const vh = innerHeight, vw = innerWidth, out = [];
      document.querySelectorAll(opts.cardSel).forEach((el) => {
        const r = el.getBoundingClientRect();
        if (!(r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw)) return;
        const cs = getComputedStyle(el);
        out.push(`${(+cs.opacity).toFixed(2)}|${nums(cs.transform).map((v) => v.toFixed(3)).join(",")}|${Math.round(r.left)},${Math.round(r.top)}`);
      });
      return out.join(";");
    },
    // Samples every card that is >=60% on screen (call once the stop has settled).
    settle(only = null) {
      const vh = innerHeight, vw = innerWidth;
      let n = 0;
      document.querySelectorAll(opts.cardSel).forEach((el) => {
        const s = cardState.get(el);
        if (!s || (only != null && s.i !== only)) return;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        s.rendered = true;
        if (visRatio(r, vw, vh) < 0.6) return;
        n++;
        s.seen++;
        const bits = restInfo(el);
        const eo = effOpacity(el);
        if (eo < 0.99) bits.push(`effective opacity ${eo.toFixed(2)}`);
        s.lastOk = !bits.length;
        if (s.lastOk) s.everOk = true; else s.lastBad = bits.join(", ");
      });
      return n;
    },
    vis(i) { const el = byIndex[i]; return el ? visRatio(el.getBoundingClientRect(), innerWidth, innerHeight) : 0; },
    // Cards not yet verified at rest, with the scroll range where they were on screen.
    pending() {
      return [...cardState.entries()].filter(([el, s]) => s.rendered && (!s.seen || !okOf(el, s))).map(([, s]) => ({ i: s.i, minY: s.minY, maxY: s.maxY }));
    },
    result() {
      return [...cardState.entries()].map(([el, s]) => ({
        i: s.i, label: desc(el), deck: !!el.closest("[data-deck]"), rendered: s.rendered, pre: s.pre, preState: s.preState,
        seen: s.seen, everOk: s.everOk, lastOk: s.lastOk, lastBad: s.lastBad, minY: s.minY, maxY: s.maxY,
      }));
    },
  };
  if (opts.cardMon) {
    const loop = () => { try { cards.tick(); } catch (e) {} requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
  window.__fm = { stage, labelScan, staticCheck, mobileCheck, overflowers, devIssues, cards };
}

// ---------------------------------------------------------------- browser helpers
let browser;
function pathOf(page) { try { return new URL(page.url()).pathname; } catch { return page.url(); } }
function watch(page, run) {
  ran("a");
  page.on("pageerror", (e) => recordError(run, page, "pageerror", (e && e.message) || String(e)));
  page.on("console", (m) => { if (m.type() === "error") recordError(run, page, "console.error", m.text(), (m.location() || {}).url); });
  page.on("crash", () => recordError(run, page, "crash", "page crashed"));
}
function recordError(run, page, kind, text, src) {
  if (/THREE\.Clock/.test(text)) return;
  const p = pathOf(page);
  // The 404 page's own document is an expected 404 response.
  if (p === NOT_FOUND && /status of 404/.test(text) && src && src.split(/[?#]/)[0] === page.url().split(/[?#]/)[0]) return;
  report.errors.push({ run, page: p, kind, text: String(text).slice(0, 400) });
}
async function newCtx({ run, theme = "dark", motion = "on", viewport = { width: 1440, height: 900 }, mobile = false, reduced = false, video = null, cardMon = false } = {}) {
  const o = { viewport, colorScheme: theme, reducedMotion: reduced ? "reduce" : "no-preference" };
  if (mobile) Object.assign(o, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  if (video) o.recordVideo = { dir: video, size: { width: 1280, height: 800 } };
  const ctx = await browser.newContext(o);
  ctx.setDefaultTimeout(15000);
  ctx.setDefaultNavigationTimeout(60000);
  await ctx.addInitScript(([t, m]) => {
    try { localStorage.setItem("theme", t); if (m == null) localStorage.removeItem("cp:3d"); else localStorage.setItem("cp:3d", m); } catch (e) {}
  }, [theme, motion]);
  await ctx.addInitScript(FM_LIB, { cardSel: CARD_SEL, cardMon });
  ctx.on("page", (p) => watch(p, run));
  return ctx;
}
async function gotoP(page, p) {
  const resp = await page.goto(BASE + p, { waitUntil: "load", timeout: 60000 });
  return resp ? resp.status() : null;
}
// Waits for the stage's canvas if the page has a stage. Returns the canvas count (0 = none).
async function waitCanvas(page, ms) {
  try {
    await page.waitForFunction(() => !document.querySelector("[data-neural-stage]") || document.querySelectorAll("canvas").length > 0, null, { timeout: ms, polling: 250 });
  } catch (e) {}
  return page.evaluate(() => document.querySelectorAll("canvas").length);
}
const stageInfo = (page) => page.evaluate(() => window.__fm.stage());
// Native scroll by mouse wheel, top -> bottom. onSample(s) runs every `sampleEveryPx` of travel.
async function wheelThrough(page, { step = 120, delay = 110, maxMs = 60000, sampleEveryPx = 0, onSample = null, mouse = null } = {}) {
  const vp = page.viewportSize();
  await page.mouse.move(mouse ? mouse.x : vp.width / 2, mouse ? mouse.y : vp.height / 2);
  const t0 = Date.now();
  let lastY = -1, lastSample = -Infinity, bottom = 0, stall = 0;
  while (Date.now() - t0 < maxMs) {
    await page.mouse.wheel(0, step);
    await page.waitForTimeout(delay);
    const s = await page.evaluate(() => ({ y: scrollY, max: document.documentElement.scrollHeight - innerHeight }));
    if (onSample && s.y - lastSample >= sampleEveryPx) { lastSample = s.y; await onSample(s); }
    const atBottom = s.y >= s.max - 2;
    if (atBottom) { if (++bottom >= 3) break; } else bottom = 0;
    if (!atBottom && Math.abs(s.y - lastY) < 0.5) { if (++stall >= 15) break; } else stall = 0;
    lastY = s.y;
  }
}
// Programmatic scroll in viewport fractions (mobile and the static checks).
async function jsThrough(page, { frac = 0.8, delay = 120, maxMs = 30000, everyN = 3, onSample = null } = {}) {
  const t0 = Date.now();
  let n = 0, bottom = 0;
  while (Date.now() - t0 < maxMs) {
    const s = await page.evaluate((f) => { window.scrollBy({ top: innerHeight * f, behavior: "instant" }); return { y: scrollY, max: document.documentElement.scrollHeight - innerHeight }; }, frac);
    await page.waitForTimeout(delay);
    if (onSample && ++n % everyN === 0) await onSample(s);
    if (s.y >= s.max - 2) { if (++bottom >= 2) break; } else bottom = 0;
  }
}
async function scrollToY(page, y) { await page.evaluate((v) => window.scrollTo({ top: v, behavior: "instant" }), y); }
// Puts section i at: enter = its top at 75% of the viewport; center; leave = its bottom at 25%.
async function placeSection(page, i, where) {
  for (let k = 0; k < 3; k++) {
    const r = await page.evaluate(([i, where]) => {
      const el = document.querySelectorAll("[data-section]")[i];
      if (!el) return null;
      const vh = innerHeight, b = el.getBoundingClientRect();
      const delta = where === "enter" ? b.top - vh * 0.75 : where === "center" ? b.top + b.height / 2 - vh / 2 : b.bottom - vh * 0.25;
      return { delta, y: scrollY, max: document.documentElement.scrollHeight - innerHeight };
    }, [i, where]);
    if (!r || Math.abs(r.delta) < 3) break;
    const target = Math.max(0, Math.min(r.max, r.y + r.delta));
    if (Math.abs(target - r.y) < 1) break; // clamped at the page top/bottom
    await scrollToY(page, target);
    await page.waitForTimeout(160);
  }
  return page.evaluate((i) => {
    const el = document.querySelectorAll("[data-section]")[i];
    const b = el.getBoundingClientRect(), c = innerHeight / 2;
    return { y: Math.round(scrollY), top: Math.round(b.top), bottom: Math.round(b.bottom), coversCentre: b.top <= c && b.bottom >= c };
  }, i);
}
// Swipes every horizontal scroller in <main> to its end, like a user would, so items that start
// off-screen sideways (scroll-snap tracks) get their chance to reveal. afterStep runs after each swipe.
async function swipeScrollers(page, afterStep = null) {
  const n = await page.evaluate(() => {
    const list = [...document.querySelectorAll("main *")].filter((el) => {
      const cs = getComputedStyle(el);
      return /(auto|scroll)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 4 && el.clientHeight > 0;
    });
    window.__fmScrollers = list;
    return list.length;
  });
  for (let k = 0; k < Math.min(n, 12); k++) {
    await page.evaluate((k) => window.__fmScrollers[k].scrollIntoView({ block: "center", behavior: "instant" }), k);
    await page.waitForTimeout(300);
    for (let i = 0; i < 20; i++) {
      const done = await page.evaluate((k) => {
        const el = window.__fmScrollers[k], before = el.scrollLeft;
        el.scrollBy({ left: el.clientWidth * 0.8, behavior: "instant" });
        return Math.abs(el.scrollLeft - before) < 1 || el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;
      }, k);
      await page.waitForTimeout(350);
      if (afterStep) await afterStep();
      if (done) break;
    }
  }
  return n;
}
// Waits until the on-screen cards stop changing (entrance tweens finished), at most maxMs.
async function waitCardsStable(page, minMs = 450, maxMs = 2600) {
  await page.waitForTimeout(minMs);
  const t0 = Date.now();
  let prev = await page.evaluate(() => window.__fm.cards.signature());
  while (Date.now() - t0 < maxMs) {
    await page.waitForTimeout(200);
    const cur = await page.evaluate(() => window.__fm.cards.signature());
    if (cur === prev) return true;
    prev = cur;
  }
  return false;
}
async function settleScroll(page, maxMs = 4000) {
  const t0 = Date.now();
  let last = -1, same = 0;
  while (Date.now() - t0 < maxMs) {
    const y = await page.evaluate(() => scrollY);
    if (Math.abs(y - last) < 0.5) { if (++same >= 4) return; } else same = 0;
    last = y;
    await page.waitForTimeout(100);
  }
}
async function shot(page, file) {
  try { await page.screenshot({ path: file, timeout: 20000 }); return path.relative(OUT, file); } catch (e) { return `(screenshot failed: ${e.message.split("\n")[0]})`; }
}
async function pool(items, n, fn) {
  const q = items.slice();
  await Promise.all(Array.from({ length: Math.min(n, q.length) }, async () => { while (q.length) await fn(q.shift()); }));
}
const pad = (n) => String(n).padStart(2, "0");
const slug = (p) => (p === "/" ? "home" : p === NOT_FOUND ? "not-found" : p.replace(/^\//, "").replace(/\//g, "-")).slice(0, 60);

// ---------------------------------------------------------------- step runner
async function step(name, ids, ms, fn) {
  if (ONLY && !ONLY.includes(name)) return;
  const t0 = Date.now();
  const ctxs = [];
  const S = { ctx: async (o) => { const c = await newCtx(o); ctxs.push(c); return c; } };
  let timer;
  log(`> ${name}`);
  try {
    await Promise.race([fn(S), new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(`timed out after ${ms / 1000}s`)), ms); })]);
    report.steps[name] = { ok: true, ms: Date.now() - t0 };
  } catch (e) {
    const msg = String((e && e.message) || e).split("\n")[0];
    report.steps[name] = { ok: false, ms: Date.now() - t0, error: msg };
    for (const id of ids) errored(id, `${name}: ${msg}`);
    log(`! ${name} failed: ${msg}`);
  } finally {
    clearTimeout(timer);
    await Promise.all(ctxs.map((c) => c.close().catch(() => {})));
  }
  log(`< ${name} ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

// ---------------------------------------------------------------- steps
// 2 + c + d + e: home frames at 1440x900 dark, every [data-section] entering / centred / leaving.
async function stepFrames(S) {
  const ctx = await S.ctx({ run: "frames" });
  const page = await ctx.newPage();
  await gotoP(page, "/");
  const nCanvas = await waitCanvas(page, 12000);
  if (!nCanvas) note("d", "home: no canvas within 12 s (3D gated off?)");
  await page.waitForTimeout(1500);
  const secs = await page.evaluate(() => [...document.querySelectorAll("[data-section]")].map((s) => ({
    section: s.getAttribute("data-section"), scene: s.getAttribute("data-scene"), stage: s.getAttribute("data-stage"), id: s.id || null,
  })));
  report.sections = secs;
  if (!secs.length) { fail("c", "home has no [data-section] elements"); fail("d", "home has no [data-section] elements"); return; }

  // c: rhythm of compositions
  const missing = secs.filter((s) => s.stage == null);
  if (missing.length) fail("c", `${missing.length}/${secs.length} sections have no data-stage (default "left"): ${missing.map((s) => s.section).join(", ")}`);
  for (const s of secs) if (s.stage != null && !STAGE_VALUES.includes(s.stage)) fail("c", `${s.section}: invalid data-stage="${s.stage}"`);
  for (let i = 1; i < secs.length; i++) {
    const a = secs[i - 1], b = secs[i];
    const ea = a.stage || "left", eb = b.stage || "left";
    if (ea === eb) fail("c", `${a.section} -> ${b.section}: both "${ea}"${a.stage == null || b.stage == null ? " (missing = default)" : ""}`);
  }
  ran("c");

  const fast = QUICK ? 0.75 : 1;
  const layouts = new Set();
  for (let i = 0; i < secs.length; i++) {
    const key = secs[i].section || `s${i}`;
    for (const where of ["enter", "center", "leave"]) {
      const pos = await placeSection(page, i, where);
      await page.waitForTimeout(Math.round((where === "center" ? 1100 : 750) * fast));
      const info = await page.evaluate((i) => {
        const el = document.querySelectorAll("[data-section]")[i];
        return {
          stage: window.__fm.stage(),
          sec: { section: el.getAttribute("data-section"), scene: el.getAttribute("data-scene"), stage: el.getAttribute("data-stage") },
          labels: window.__fm.labelScan(),
        };
      }, i);
      const name = `home-${pad(i)}-${key}-${where}`;
      const file = await shot(page, path.join(OUT, "frames", `${name}.png`));
      recordCanvas("frames", "/", info.stage);
      recordLabels("frames@1440", "/", name, info.labels);
      if (info.stage.layout) layouts.add(info.stage.layout);
      report.frames.push({
        file, index: i, where, scrollY: pos.y, sectionTop: pos.top, sectionBottom: pos.bottom, coversCentre: pos.coversCentre,
        stage: { scene: info.stage.scene, layout: info.stage.layout, quality: info.stage.quality, canvases: info.stage.canvases },
        section: info.sec, labels: { total: info.labels.total, visible: info.labels.visible, bad: info.labels.bad.length },
      });
      if (where !== "center") continue;
      // d: scene match with the section centred
      const ov = info.sec.scene;
      const expected = ov || (SCENE_KEYS.includes(info.sec.section) ? info.sec.section : "ambient");
      if (ov && !SCENE_KEYS.includes(ov)) fail("d", `${key}: data-scene="${ov}" is not a scene key`);
      if (!info.stage.has) fail("d", `${key}: no [data-neural-stage] on the page`);
      else if (!pos.coversCentre) note("d", `${key}: cannot be centred (page top/bottom), skipped`);
      else if (!info.stage.canvases) { note("d", `${key}: no canvas at the centred frame (3D gated or fell back), scene not verifiable`); C("d").unverified = (C("d").unverified || 0) + 1; }
      else if (info.stage.scene == null) fail("d", `${key}: stage has no data-scene (3D not running?) - expected "${expected}"`);
      else if (info.stage.scene !== expected) fail("d", `${key}: stage shows "${info.stage.scene}", expected "${expected}"`, { frame: file });
      ran("d");
    }
    log(`  frames ${key}`);
  }
  if (C("d").unverified && C("d").unverified === secs.length) errored("d", "no canvas at any centred frame: scene match not verifiable");
  if (!layouts.size) note("d", "stage never exposed data-stage-layout");
  else note("d", `stage layouts seen: ${[...layouts].join(", ")}`);
  const issues = await page.evaluate(() => window.__fm.devIssues());
  if (issues) fail("a", `/ (frames run): Next dev overlay shows ${issues} issue(s)`);
}

// f: cards animate in, then end fully visible (home, /projects), 1440x900 dark, motion on.
// Home and /projects run side by side (each in its own tab) to keep the step short.
async function stepCards(S) {
  const ctx = await S.ctx({ run: "cards", cardMon: true });
  await Promise.all(["/", "/projects"].map((p) => cardsOn(ctx, p).catch((e) => errored("f", `${p}: ${e.message.split("\n")[0]}`))));
}
async function cardsOn(ctx, p) {
  {
    const page = await ctx.newPage();
    await gotoP(page, p);
    await page.waitForTimeout(2000);
    const n = await page.evaluate((sel) => document.querySelectorAll(sel).length, CARD_SEL);
    ran("f");
    if (!n) { fail("f", `${p}: no ${CARD_SEL} elements on the page`); await page.close(); return; }
    const vp = page.viewportSize();
    await page.mouse.move(2, vp.height / 2); // left gutter: no hover tilt on the cards
    const stats = { stops: 0, capped: 0, pass1Ms: 0, pass2Cards: 0, pass2Ms: 0 };
    const settled = async () => { stats.stops++; if (!(await waitCardsStable(page))) stats.capped++; return page.evaluate(() => window.__fm.cards.settle()); };
    await settled();
    // Pass 1: wheel down in ~0.85-viewport stops; sample the on-screen cards once they stop moving.
    const t0 = Date.now();
    let bottom = 0;
    while (Date.now() - t0 < (QUICK ? 110000 : 130000)) {
      for (let k = 0; k < 5; k++) { await page.mouse.wheel(0, Math.round(vp.height * 0.17)); await page.waitForTimeout(40); }
      await settled();
      const s = await page.evaluate(() => ({ y: scrollY, max: document.documentElement.scrollHeight - innerHeight }));
      if (s.y >= s.max - 2) { if (++bottom >= 2) break; } else bottom = 0;
    }
    await swipeScrollers(page, settled);
    stats.pass1Ms = Date.now() - t0;
    // Pass 2: cards not verified yet (on screen only briefly, e.g. inside a pinned horizontal track):
    // sweep their on-screen scroll range, stop where they are most visible, and sample again.
    const pend = await page.evaluate(() => window.__fm.cards.pending());
    const t1 = Date.now();
    for (const c of pend) {
      if (c.minY == null || Date.now() - t1 > (QUICK ? 20000 : 30000)) continue;
      stats.pass2Cards++;
      let best = { v: -1, y: c.minY };
      const stepPx = Math.max(60, Math.min(160, (c.maxY - c.minY) / 8));
      for (let y = c.minY; y <= c.maxY + 1; y += stepPx) {
        await scrollToY(page, y);
        await page.waitForTimeout(140);
        const v = await page.evaluate((i) => window.__fm.cards.vis(i), c.i);
        if (v > best.v) best = { v, y };
        if (v >= 0.98) break;
      }
      await scrollToY(page, best.y);
      await waitCardsStable(page);
      await page.evaluate((i) => window.__fm.cards.settle(i), c.i);
    }
    stats.pass2Ms = Date.now() - t1;
    const res = (await page.evaluate(() => window.__fm.cards.result())).filter((c) => c.rendered);
    const pre = res.filter((c) => c.pre);
    const pct = res.length ? pre.length / res.length : 0;
    const summary = `${p}: ${pre.length}/${res.length} cards (${Math.round(pct * 100)}%) were in a pre-entry state`;
    if (pct < 0.7) fail("f", `${summary} (< 70%); static: ${res.filter((c) => !c.pre).slice(0, 6).map((c) => c.label).join(" | ")}`);
    else note("f", summary);
    for (const c of res) {
      const ok = c.deck ? c.everOk : c.lastOk;
      if (!c.seen) fail("f", `${p}: ${c.label} never settled in view`);
      else if (!ok) fail("f", `${p}: ${c.label} did not end fully visible (${c.lastBad})`);
    }
    report.pages[p] = report.pages[p] || { hasStage: false, maxCanvas: 0, runs: {} };
    report.pages[p].cards = res;
    report.pages[p].cardTiming = stats;
    await page.close();
  }
}

// g / h: static layout with motion off (cp:3d=off) or reduced motion + auto.
async function stepStatic(S, id, ctxOpts, noCanvas, expectMotion = false) {
  const ctx = await S.ctx(ctxOpts);
  for (const p of ["/", "/projects"]) {
    const page = await ctx.newPage();
    await gotoP(page, p);
    await page.waitForTimeout(noCanvas ? 4500 : 2000); // give the lazy 3D a chance to (wrongly) mount
    let maxSw = 0, maxCanvas = 0, iw = 0;
    const sample = async () => {
      const s = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, c: document.querySelectorAll("canvas").length }));
      maxSw = Math.max(maxSw, s.sw); maxCanvas = Math.max(maxCanvas, s.c); iw = s.iw;
    };
    await sample();
    await jsThrough(page, { frac: 0.8, delay: 130, everyN: 2, onSample: sample });
    await page.waitForTimeout(1500);
    await sample();
    const r = await page.evaluate((sel) => window.__fm.staticCheck(sel), "[data-card], [data-reveal], h1, h2, p");
    ran(id);
    const tag = `${p}`;
    note(id, `${tag}: checked ${r.checked} elements (${r.notRendered} not rendered, ${r.ariaHidden} decorative skipped); html[data-motion]=${r.motion ?? "(none)"}; reduced=${r.reduced}`);
    if (r.hidden.length) fail(id, `${tag}: ${r.hidden.length} element(s) not at opacity 1: ${r.hidden.slice(0, 6).join(" | ")}${r.hidden.length > 6 ? " | ..." : ""}`);
    const pinned = r.pins.filter((x) => x.pinned);
    if (pinned.length && !expectMotion) fail(id, `${tag}: ${pinned.length} active pin(s): ${pinned.map((x) => `${x.child} (spacer ${x.spacer}px vs ${x.childH}px)`).join(" | ")}`);
    else if (r.pins.length) note(id, `${tag}: ${r.pins.length} .pin-spacer present but inert`);
    const sw = Math.max(maxSw, r.sw);
    if (sw > iw + 1) fail(id, `${tag}: horizontal overflow (scrollWidth ${sw} > innerWidth ${iw}); culprits: ${(await page.evaluate(() => window.__fm.overflowers())).join(" | ") || "(not found at the end of the scroll)"}`);
    if (noCanvas && Math.max(maxCanvas, r.canvases) > 0) fail(id, `${tag}: ${Math.max(maxCanvas, r.canvases)} canvas element(s) under reduced motion`);
    if (expectMotion) {
      if (r.motion !== "on") fail(id, `${tag}: html[data-motion]=${r.motion ?? "(none)"} under OS reduced motion; owner wants motion on for everyone`);
      if (p === "/" && Math.max(maxCanvas, r.canvases) === 0) fail(id, `${tag}: no canvas under OS reduced motion; owner wants the 3D for everyone`);
    }
    if (!noCanvas) note(id, `${tag}: canvases ${Math.max(maxCanvas, r.canvases)}`);
    await page.close();
  }
}

// i: mobile 390x844 (home, /projects), motion on, 6 frames each.
async function stepMobile(S) {
  const ctx = await S.ctx({ run: "mobile", mobile: true, viewport: { width: 390, height: 844 } });
  for (const p of ["/", "/projects"]) {
    const page = await ctx.newPage();
    await gotoP(page, p);
    await waitCanvas(page, 6000);
    await page.waitForTimeout(1000);
    let maxSw = 0, iw = 390, had = false, dropped = null;
    for (let k = 0; k < 6; k++) {
      const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
      const target = Math.round((max * k) / 5);
      // walk there in steps so scroll-triggered reveals fire on the way
      for (;;) {
        const y = await page.evaluate(() => scrollY);
        if (Math.abs(target - y) < 2) break;
        const next = target > y ? Math.min(target, y + 600) : target;
        await scrollToY(page, next);
        await page.waitForTimeout(90);
        if (next === target) break;
      }
      await page.waitForTimeout(QUICK ? 800 : 1000);
      const info = await page.evaluate(() => ({ y: scrollY, sw: document.documentElement.scrollWidth, iw: innerWidth, stage: window.__fm.stage(), labels: window.__fm.labelScan() }));
      maxSw = Math.max(maxSw, info.sw); iw = info.iw;
      const name = `${slug(p)}-${k}`;
      const file = await shot(page, path.join(OUT, "mobile", `${name}.png`));
      recordCanvas("mobile", p, info.stage);
      if (info.stage.has && info.stage.canvases) had = true;
      else if (info.stage.has && had && !dropped) dropped = `${name} (section ${info.stage.section || "?"}, data-quality=${info.stage.quality})`;
      recordLabels("mobile@390", p, name, info.labels);
      report.mobileFrames.push({ file, page: p, scrollY: Math.round(info.y), scrollWidth: info.sw, stage: { scene: info.stage.scene, layout: info.stage.layout, canvases: info.stage.canvases }, labels: { visible: info.labels.visible, bad: info.labels.bad.length } });
    }
    if (dropped) { const m = `${p} mobile: the 3D canvas was removed mid-scroll at ${dropped}: the stage fell back to the poster`; note("b", m); report.notes.push(m); }
    const swiped = await swipeScrollers(page);
    await page.waitForTimeout(1200);
    const r = await page.evaluate(() => window.__fm.mobileCheck());
    ran("i");
    maxSw = Math.max(maxSw, r.sw);
    if (maxSw > r.iw + 1) fail("i", `${p}: horizontal overflow (scrollWidth ${maxSw} > innerWidth ${r.iw}); culprits: ${(await page.evaluate(() => window.__fm.overflowers())).join(" | ") || "(not found at the end of the scroll)"}`);
    if (r.bad.length) fail("i", `${p}: ${r.bad.length} p/h2 not visible: ${r.bad.slice(0, 6).join(" | ")}${r.bad.length > 6 ? " | ..." : ""}`);
    if (r.offX.length) fail("i", `${p}: ${r.offX.length} p/h2 off-screen sideways: ${r.offX.slice(0, 4).join(" | ")}`);
    note("i", `${p}: checked ${r.checked} p/h2 (${r.notRendered} not rendered), swiped ${swiped} horizontal scroller(s)`);
    await page.close();
  }
}

// j: header in-page anchors on home, clicked from the top and from the bottom of the page.
async function stepAnchors(S) {
  const ctx = await S.ctx({ run: "anchors" });
  const page = await ctx.newPage();
  await gotoP(page, "/");
  await waitCanvas(page, 8000);
  await page.waitForTimeout(1500);
  const hrefs = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll("header a[href]").forEach((a) => {
      const h = a.getAttribute("href");
      if (!/^\/?#./.test(h)) return;
      const r = a.getBoundingClientRect(), cs = getComputedStyle(a);
      if (!r.width || !r.height || cs.visibility === "hidden") return;
      if (!out.includes(h)) out.push(h);
    });
    return out;
  });
  ran("j");
  if (!hrefs.length) { fail("j", "no visible header link points to a #anchor on home"); return; }
  for (const href of hrefs) {
    for (const from of ["top", "bottom"]) {
      await page.evaluate((f) => window.scrollTo({ top: f === "top" ? 0 : document.documentElement.scrollHeight, behavior: "instant" }), from);
      await page.waitForTimeout(450);
      let how = "click";
      try {
        await page.locator(`header a[href="${href}"]:visible`).first().click({ timeout: 3000 });
      } catch (e) {
        how = "el.click() (Playwright click failed)";
        await page.evaluate((h) => { const a = [...document.querySelectorAll("header a")].find((x) => x.getAttribute("href") === h); if (a) a.click(); }, href);
      }
      await page.waitForTimeout(150);
      await settleScroll(page, 5000);
      await page.waitForTimeout(250);
      const r = await page.evaluate((h) => {
        const id = decodeURIComponent(h.slice(h.indexOf("#") + 1));
        const t = document.getElementById(id);
        if (!t) return null;
        return { top: Math.round(t.getBoundingClientRect().top), hash: location.hash, y: Math.round(scrollY), pins: document.querySelectorAll(".pin-spacer").length };
      }, href);
      const tag = `${href} from ${from}`;
      if (!r) fail("j", `${tag}: target element not found`);
      else if (r.top < -2 || r.top > 200) fail("j", `${tag}: target top at ${r.top}px (want 0-200), scrollY ${r.y}, pins ${r.pins}${how !== "click" ? `, via ${how}` : ""}`);
      else note("j", `${tag}: top ${r.top}px (pins ${r.pins})${how !== "click" ? ` via ${how}` : ""}`);
    }
  }
}

// k: light theme, 3 frames of home (top, a scene section, a plain section).
async function stepLight(S) {
  const ctx = await S.ctx({ run: "light", theme: "light" });
  const page = await ctx.newPage();
  await gotoP(page, "/");
  await waitCanvas(page, 10000);
  await page.waitForTimeout(1500);
  const th = await page.evaluate(() => ({ cls: document.documentElement.className, dark: document.documentElement.classList.contains("dark") }));
  ran("k");
  if (th.dark) fail("k", `html still has class "dark" with theme=light (class="${th.cls}")`);
  const plan = await page.evaluate(() => {
    const keys = [...document.querySelectorAll("[data-section]")].map((s) => s.getAttribute("data-section"));
    const pick = (list) => list.map((k) => keys.indexOf(k)).find((i) => i >= 0);
    return [{ name: "top", i: -1 }, { name: "scene", i: pick(["work", "ai", "stack", "experience"]) }, { name: "plain", i: pick(["faq", "services", "writing", "cta"]) }];
  });
  for (const t of plan) {
    if (t.i == null || t.i < 0) { if (t.name !== "top") { const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight); await scrollToY(page, Math.round(max * (t.name === "scene" ? 0.4 : 0.75))); } else await scrollToY(page, 0); }
    else await placeSection(page, t.i, "center");
    await page.waitForTimeout(1100);
    const info = await page.evaluate(() => ({ y: scrollY, stage: window.__fm.stage(), labels: window.__fm.labelScan() }));
    const name = `home-light-${t.name}`;
    const file = await shot(page, path.join(OUT, "light", `${name}.png`));
    recordCanvas("light", "/", info.stage);
    recordLabels("light@1440", "/", name, info.labels);
    report.lightFrames.push({ file, scrollY: Math.round(info.y), stage: { scene: info.stage.scene, layout: info.stage.layout }, labels: { visible: info.labels.visible, bad: info.labels.bad.length } });
  }
  note("k", `3 frames in light/ (html class "${th.cls}")`);
}

// 1 + a + b: every page, scrolled top -> bottom by mouse wheel (recorded at 1280x800 unless --quick).
async function stepTour(S, pages) {
  const rawDir = path.join(OUT, "video", ".raw");
  const ctx = await S.ctx({ run: "tour", viewport: { width: 1280, height: 800 }, video: QUICK ? null : rawDir });
  const one = async (p) => {
    const page = await ctx.newPage();
    const rec = { status: null };
    try {
      rec.status = await gotoP(page, p);
      await waitCanvas(page, QUICK ? 5000 : 7000);
      await page.waitForTimeout(QUICK ? 600 : 1500);
      const timeline = [];
      const sample = async () => {
        const s = await page.evaluate(() => ({ stage: window.__fm.stage(), labels: window.__fm.labelScan(), y: Math.round(scrollY) }));
        recordCanvas("tour", p, s.stage);
        recordLabels("tour@1280", p, `tour ${p} @y=${s.y}`, s.labels);
        if (s.stage.has) timeline.push(`y${s.y}:${s.stage.section || "-"}:${s.stage.canvases ? s.stage.scene || "?" : "poster"}${s.stage.quality ? "/" + s.stage.quality : ""}`);
        if (s.stage.has && s.stage.canvases) rec.hadCanvas = true;
        else if (s.stage.has && rec.hadCanvas && !rec.dropped) rec.dropped = { y: s.y, section: s.stage.section, quality: s.stage.quality };
      };
      await sample();
      await wheelThrough(page, QUICK ? { step: 700, delay: 90, maxMs: 25000, sampleEveryPx: 800, onSample: sample } : { step: 120, delay: 110, maxMs: 60000, sampleEveryPx: 800, onSample: sample });
      await page.waitForTimeout(QUICK ? 400 : 1200);
      await sample();
      const issues = await page.evaluate(() => window.__fm.devIssues());
      if (issues) fail("a", `${p}: Next dev overlay shows ${issues} issue(s)`);
      if (p === NOT_FOUND && rec.status !== 404) note("a", `${p}: HTTP ${rec.status} (expected 404)`);
      if (rec.dropped) {
        const m = `${p}: the 3D canvas was removed mid-scroll in the wheel tour at y=${rec.dropped.y} (section ${rec.dropped.section || "?"}, data-quality=${rec.dropped.quality}): the stage fell back to the poster; later tour label scans saw no 3D`;
        note("b", m);
        report.notes.push(m);
      }
      (report.pages[p] ||= { hasStage: false, maxCanvas: 0, runs: {} }).tourTimeline = timeline;
      ran("a"); ran("b");
    } catch (e) {
      const msg = e.message.split("\n")[0];
      errored("a", `tour ${p}: ${msg}`);
      errored("b", `tour ${p}: ${msg}`);
      log(`! tour ${p}: ${msg}`);
    } finally {
      const v = page.video();
      await page.close().catch(() => {});
      if (v) {
        const file = path.join(OUT, "video", `${slug(p)}.webm`);
        try { await v.saveAs(file); await v.delete().catch(() => {}); report.videos.push(path.relative(OUT, file)); } catch (e) { report.notes.push(`video ${p}: ${e.message.split("\n")[0]}`); }
      }
      const pg = (report.pages[p] ||= { hasStage: false, maxCanvas: 0, runs: {} });
      pg.status = rec.status;
      log(`  tour ${p} (${rec.status})`);
    }
  };
  if (QUICK) await pool(pages, 3, one);
  else for (const p of pages) await one(p);
}

async function discoverPost() {
  try {
    const res = await fetch(BASE + "/blog", { signal: AbortSignal.timeout(45000) });
    const html = await res.text();
    const re = /href="(\/blog\/[^"?#]+)"/g;
    for (let m; (m = re.exec(html)); ) {
      const segs = m[1].split("/").filter(Boolean);
      if (segs.length === 2 && !["page", "tag", "tags", "category", "categories", "feed", "rss"].includes(segs[1])) return m[1];
    }
    report.notes.push("no blog post link found on /blog");
  } catch (e) {
    report.notes.push(`blog post discovery failed: ${e.message}`);
  }
  return null;
}

// ---------------------------------------------------------------- finalize
let finalized = false;
function finalize(reason) {
  if (finalized) return 1;
  finalized = true;
  // a: group errors by text
  const groups = new Map();
  for (const e of report.errors) {
    const k = `${e.kind}: ${e.text.split("\n")[0].slice(0, 220)}`;
    const g = groups.get(k) || { count: 0, where: new Set() };
    g.count++; g.where.add(`${e.run}:${e.page}`);
    groups.set(k, g);
  }
  for (const [k, g] of groups) fail("a", k, { count: g.count, where: [...g.where].slice(0, 12) });
  // b: canvas count on pages with a stage
  const pages = Object.entries(report.pages);
  for (const [p, pg] of pages) {
    for (const [run, r] of Object.entries(pg.runs || {})) if (r.hasStage && r.maxCanvas > 1) fail("b", `${p} (${run}): ${r.maxCanvas} canvas elements`);
  }
  const withStage = pages.filter(([, pg]) => pg.hasStage).map(([p]) => p);
  const without = pages.filter(([, pg]) => pg.runs && Object.keys(pg.runs).length && !pg.hasStage).map(([p]) => p);
  if (pages.length) {
    note("b", `pages with a stage: ${withStage.join(", ") || "none"}`);
    if (without.length) note("b", `pages without [data-neural-stage]: ${without.join(", ")}`);
  }
  // e: grouped label failures
  for (const g of labelBad.values()) fail("e", `${g.page} [${g.run}] "${g.label}" ${g.why}: ${g.detail}`, { opacity: g.opacity, rect: g.rect, frames: g.frames });
  if (C("e").ran) {
    note("e", `${labelFramesScanned} frames scanned, ${labelVisibleSeen} visible label sightings`);
    const by = {};
    for (const g of labelBad.values()) {
      const where = g.why === "clipped" ? "clipped" : (g.detail.includes(" > ") ? g.detail.split(" > ")[0] : "(outside sections)");
      const k = `${g.run} ${g.page}`;
      (by[k] ||= {})[where] = ((by[k] || {})[where] || 0) + 1;
    }
    for (const [k, m] of Object.entries(by)) C("e").summary = [...(C("e").summary || []), `${k}: ${Object.entries(m).map(([w, n]) => `${w} ${n}`).join(", ")}`];
  }
  for (const c of Object.values(report.checks)) c.status = c.failures.length ? "FAIL" : c.error ? "ERROR" : c.ran ? "PASS" : "SKIP";
  if (QUICK) { C("k").status = "SKIP"; C("k").notes.push("skipped (--quick)"); }
  report.durationMs = Date.now() - T_START;
  if (reason) report.notes.push(reason);
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));

  // table
  const w = Math.max(...Object.values(report.checks).map((c) => c.title.length));
  const line = "-".repeat(w + 30);
  console.log(`\n${line}\nfm-tour  ${BASE}  ${QUICK ? "(quick) " : ""}${(report.durationMs / 1000).toFixed(0)}s  -> ${path.join(OUT, "report.json")}\n${line}`);
  for (const c of Object.values(report.checks)) {
    const extra = c.failures.length ? `${c.failures.length} issue(s)` : c.error ? "step error" : "";
    console.log(`${c.id}  ${c.title.padEnd(w)}  ${c.status.padEnd(5)}  ${extra}`);
  }
  console.log(line);
  for (const c of Object.values(report.checks)) {
    if (!c.failures.length && !c.error) continue;
    console.log(`[${c.id}] ${c.title}`);
    for (const line of c.summary || []) console.log(`   by section: ${line}`);
    for (const f of c.failures.slice(0, 8)) console.log(`   - ${f.msg.slice(0, 230)}${f.where ? `  @ ${f.where.slice(0, 4).join(", ")}` : ""}${f.frames ? `  (${f.frames.length} frame(s), e.g. ${f.frames[0]})` : ""}`);
    if (c.failures.length > 8) console.log(`   ... ${c.failures.length - 8} more in report.json`);
    if (c.error) console.log(`   ! ${c.error.slice(0, 300)}`);
  }
  console.log(`frames: ${report.frames.length} home, ${report.mobileFrames.length} mobile, ${report.lightFrames.length} light; videos: ${report.videos.length}`);
  for (const n of report.notes) console.log(`note: ${n}`);
  return Object.values(report.checks).some((c) => c.status === "FAIL" || c.status === "ERROR") ? 1 : 0;
}

// ---------------------------------------------------------------- main
process.on("unhandledRejection", (e) => log("unhandledRejection:", String((e && e.message) || e).split("\n")[0]));
(async () => {
  const watchdog = setTimeout(async () => {
    log(`global timeout after ${GLOBAL_MS / 1000}s; writing a partial report`);
    const code = finalize(`global timeout after ${GLOBAL_MS / 1000}s`);
    try { await browser.close(); } catch (e) {}
    process.exit(3);
  }, GLOBAL_MS);
  try {
    await fetch(BASE + "/", { signal: AbortSignal.timeout(60000) });
  } catch (e) {
    console.error(`base URL unreachable: ${BASE} (${(e.cause && e.cause.code) || e.message})`);
    for (const c of Object.values(report.checks)) c.error = "base URL unreachable";
    clearTimeout(watchdog);
    finalize(`base URL unreachable: ${BASE}`);
    process.exit(2);
  }
  browser = await chromium.launch({ executablePath: EXE, args: ARGS });
  report.blogPost = await discoverPost();
  const pages = ["/", "/about", "/skills", "/experience", "/projects", "/services", "/services/nextjs-development", "/blog"];
  if (report.blogPost) pages.push(report.blogPost);
  pages.push("/contact", NOT_FOUND);
  log(`base ${BASE}, out ${OUT}${QUICK ? ", quick" : ""}; blog post: ${report.blogPost || "(none)"}`);

  const lane1 = async () => {
    await step("frames", ["c", "d", "e"], 150000, stepFrames);
    await step("cards", ["f"], 300000, stepCards);
    await step("anchors", ["j"], 90000, stepAnchors);
    if (!QUICK) await step("light", ["k", "e"], 60000, stepLight);
  };
  const lane2 = async () => {
    await step("motion-off", ["g"], 70000, (S) => stepStatic(S, "g", { run: "motion-off", motion: "off" }, false));
    await step("reduced", ["h"], 80000, (S) => stepStatic(S, "h", { run: "reduced", motion: null, reduced: true }, false, true));
    await step("mobile", ["i", "e"], 100000, stepMobile);
    await step("tour", ["a", "b", "e"], QUICK ? 110000 : 330000, (S) => stepTour(S, pages));
  };
  if (SERIAL) { await lane1(); await lane2(); } else await Promise.all([lane1(), lane2()]);
  try { fs.rmSync(path.join(OUT, "video", ".raw"), { recursive: true, force: true }); } catch (e) {}
  clearTimeout(watchdog);
  const code = finalize();
  await browser.close().catch(() => {});
  process.exit(code);
})().catch((e) => {
  console.error("fatal:", e);
  const code = finalize(`fatal: ${e.message}`);
  process.exit(code || 1);
});

// Motion runtime: loaded lazily by MotionProvider (never part of the initial JS).
// Binds the [data-*] hooks documented in components/motion/index.ts, keeps them in
// sync with DOM additions/removals and client navigation, and tears everything down
// (DOM restored, inline styles cleared) when motion is turned off.
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { BINDERS } from "./bindings";
import type { Binding } from "./shared";
import { mountChrome } from "./chrome";

gsap.registerPlugin(ScrollTrigger);
gsap.config({ nullTargetWarn: false });
ScrollTrigger.config({ ignoreMobileResize: true, limitCallbacks: true });

const bound = new Map<string, Map<Element, Binding>>();
let running = false;
let mo: MutationObserver | null = null;
let ro: ResizeObserver | null = null;
let chrome: Binding | null = null;
let scanTimer = 0;
let refreshTimer = 0;
let lastHeight = 0;

let lastScroll = 0;
const onScroll = () => {
  lastScroll = performance.now();
};

function scheduleRefresh() {
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(() => {
    // A refresh restores the scroll position, which would cut an in-flight smooth
    // (anchor/keyboard) scroll short: wait until scrolling has been idle for 150 ms.
    if (performance.now() - lastScroll < 150) return scheduleRefresh();
    lastHeight = document.documentElement.scrollHeight;
    const keep = anchor();
    // Refresh in page order: a pin's spacer must exist before the triggers below it measure.
    ScrollTrigger.sort();
    ScrollTrigger.refresh();
    // A refresh restores the numeric scroll position, so a pin spacer inserted above the
    // reader (e.g. after landing on /#ai) would push the content away: put it back.
    if (keep) {
      const moved = boxOf(keep[0]).getBoundingClientRect().top - keep[1];
      if (Math.abs(moved) > 1) window.scrollBy({ top: moved, behavior: "instant" });
    }
  }, 120);
}

/** A pinned section's in-flow box is its pin spacer. */
const boxOf = (s: Element) => (s.parentElement?.classList.contains("pin-spacer") ? s.parentElement : s);

/** The section under the reading line (30% down the viewport) and its box's top, or null at the very top. */
function anchor(): [Element, number] | null {
  if (window.scrollY < 1) return null;
  const line = window.innerHeight * 0.3;
  for (const s of document.querySelectorAll("main [data-section]")) {
    const r = boxOf(s).getBoundingClientRect();
    if (r.bottom > line) return [s, r.top];
  }
  return null;
}

const PENDING: Binding = { revert() {} };
let queue: [Map<Element, Binding>, HTMLElement, (el: HTMLElement) => Binding][] = [];
let drainTimer = 0;
let bindChanged = false;

/** Drop bindings whose element left the DOM and queue new hook elements. */
function scan() {
  if (!running) return;
  // Never bind under an in-flight scroll (e.g. the smooth jump to a #hash on load): what is
  // "already seen" and whether a pin may still change the layout depend on where it ends.
  if (performance.now() - lastScroll < 150) return queueScan();
  let changed = false;
  for (const [, map] of bound) {
    for (const [el, binding] of map) {
      if (el.isConnected) continue;
      binding.revert();
      map.delete(el);
      changed = true;
    }
  }
  for (const [attr, bind] of Object.entries(BINDERS)) {
    let map = bound.get(attr);
    if (!map) bound.set(attr, (map = new Map()));
    const els = document.querySelectorAll<HTMLElement>(`[${attr}]`);
    for (const el of els) {
      if (map.has(el)) continue;
      map.set(el, PENDING);
      queue.push([map, el, bind]);
    }
  }
  if (changed) scheduleRefresh();
  drain();
}

/** Bind queued elements in slices of ~8 ms, so binding a long page never makes a long task. */
function drain() {
  window.clearTimeout(drainTimer);
  const t0 = performance.now();
  while (queue.length && running) {
    const [map, el, bind] = queue.shift()!;
    if (el.isConnected && map.get(el) === PENDING) {
      // One broken element must never stop the rest of the page from binding.
      try {
        map.set(el, bind(el));
      } catch (err) {
        map.set(el, { revert() {} });
        if (process.env.NODE_ENV !== "production") console.warn("[motion] bind failed", el, err);
      }
      bindChanged = true;
    }
    if (performance.now() - t0 > 8) {
      drainTimer = window.setTimeout(drain, 0);
      return;
    }
  }
  if (bindChanged) {
    bindChanged = false;
    scheduleRefresh();
  }
}

function queueScan() {
  window.clearTimeout(scanTimer);
  scanTimer = window.setTimeout(scan, 80);
}

/** Our own nodes (split words, glare, pin spacers, ticker clones/button) never trigger a rescan. */
const OWN = ["split-word", "tilt-glare", "pin-spacer", "mq-clone", "mq-pause"];

/** Only element additions/removals that are not our own nodes. */
function relevant(records: MutationRecord[]): boolean {
  for (const r of records) {
    for (const list of [r.addedNodes, r.removedNodes]) {
      for (const n of list) {
        if (n.nodeType !== 1) continue;
        const el = n as Element;
        if (OWN.some((c) => el.classList.contains(c))) continue;
        return true;
      }
    }
  }
  return false;
}

export function start() {
  if (running) return;
  running = true;
  document.documentElement.classList.add("motion-live");
  chrome = mountChrome();
  window.addEventListener("scroll", onScroll, { passive: true });
  // Binding (DOM splits, pin spacers) runs in its own task, after the chrome.
  queueScan();
  mo = new MutationObserver((records) => {
    if (relevant(records)) queueScan();
  });
  mo.observe(document.body, { childList: true, subtree: true });
  // Late layout changes (fonts, images, streamed content) move every trigger.
  lastHeight = document.documentElement.scrollHeight;
  ro = new ResizeObserver(() => {
    if (Math.abs(document.documentElement.scrollHeight - lastHeight) > 1) scheduleRefresh();
  });
  ro.observe(document.body);
}

export function stop() {
  if (!running) return;
  running = false;
  window.clearTimeout(scanTimer);
  window.clearTimeout(refreshTimer);
  window.clearTimeout(drainTimer);
  queue = [];
  window.removeEventListener("scroll", onScroll);
  mo?.disconnect();
  ro?.disconnect();
  mo = ro = null;
  for (const [, map] of bound) {
    for (const [, binding] of map) binding.revert();
    map.clear();
  }
  chrome?.revert();
  chrome = null;
  document.documentElement.classList.remove("motion-live");
  ScrollTrigger.refresh();
}

/** After a client navigation: kill the old page's triggers, bind the new page's hooks. */
export function rescan() {
  if (!running) return;
  // The new route's DOM is committed by now; one frame later layout has settled.
  requestAnimationFrame(() => {
    scan();
    scheduleRefresh();
  });
}

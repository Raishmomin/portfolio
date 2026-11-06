// Motion runtime: loaded lazily by MotionProvider (never part of the initial JS).
// Binds the [data-*] hooks documented in components/motion/index.ts, keeps them in
// sync with DOM additions/removals and client navigation, and tears everything down
// (DOM restored, inline styles cleared) when motion is turned off.
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { BINDERS, type Binding } from "./bindings";
import { mountChrome } from "./chrome";

gsap.registerPlugin(ScrollTrigger);
gsap.config({ nullTargetWarn: false });
ScrollTrigger.config({ ignoreMobileResize: true });

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
    // Refresh in page order: a pin's spacer must exist before the triggers below it measure.
    ScrollTrigger.sort();
    ScrollTrigger.refresh();
  }, 120);
}

const PENDING: Binding = { revert() {} };
let queue: [Map<Element, Binding>, HTMLElement, (el: HTMLElement) => Binding][] = [];
let drainTimer = 0;
let bindChanged = false;

/** Drop bindings whose element left the DOM and queue new hook elements. */
function scan() {
  if (!running) return;
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
      map.set(el, bind(el));
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

/** Only element additions/removals that are not our own split words, glare or pin spacers. */
function relevant(records: MutationRecord[]): boolean {
  for (const r of records) {
    for (const list of [r.addedNodes, r.removedNodes]) {
      for (const n of list) {
        if (n.nodeType !== 1) continue;
        const el = n as Element;
        if (el.classList.contains("split-word") || el.classList.contains("tilt-glare") || el.classList.contains("pin-spacer")) continue;
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

// One binder per [data-*] hook (contract: components/motion/index.ts). Each returns a
// Binding whose revert() undoes everything it did: tweens, triggers, inline styles,
// split/counter DOM. Loaded only inside the lazy motion runtime.
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { CARD_BINDERS } from "./cards";
import { arch } from "./arch";
import { DESKTOP, FINE, NOOP, clamp, seen, type Binding } from "./shared";

export { FINE, type Binding };

/** Swap text nodes for replacement nodes; returns an idempotent restore of the ORIGINAL nodes. */
function swapText(pairs: [Text, Node[]][]): () => void {
  for (const [text, nodes] of pairs) text.replaceWith(...nodes);
  let done = false;
  return () => {
    if (done) return;
    done = true;
    for (const [text, nodes] of pairs) {
      const first = nodes[0];
      if (!first?.parentNode) continue;
      first.parentNode.insertBefore(text, first);
      for (const n of nodes) n.parentNode?.removeChild(n);
    }
  };
}

function textNodes(root: Element): Text[] {
  const out: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) out.push(walker.currentNode as Text);
  return out;
}

// [data-split] — h2/h3 words rise out of a blur with a stagger. The split exists only
// while the heading is waiting/animating; afterwards the original text nodes return.
function split(el: HTMLElement): Binding {
  if (el.tagName === "H1" || el.closest("h1") || seen(el)) return NOOP;
  // A heading wrapping a link/button keeps its words in the accessibility tree (an
  // aria-hidden link would vanish); otherwise the heading carries its text as aria-label.
  const interactive = !!el.querySelector("a,button,input,select,textarea,[tabindex]") || !!el.closest("a,button");
  const label = !interactive && !el.hasAttribute("aria-label") && !el.hasAttribute("aria-labelledby");
  const words: HTMLElement[] = [];
  const pairs: [Text, Node[]][] = [];
  for (const text of textNodes(el)) {
    if (!text.data.trim()) continue;
    const nodes = text.data
      .split(/(\s+)/)
      .filter(Boolean)
      .map((part) => {
        if (!part.trim()) return document.createTextNode(part);
        const span = document.createElement("span");
        span.className = "split-word";
        span.textContent = part;
        if (label) span.setAttribute("aria-hidden", "true");
        words.push(span);
        return span;
      });
    pairs.push([text, nodes]);
  }
  if (!words.length) return NOOP;
  const name = el.textContent?.replace(/\s+/g, " ").trim() ?? "";
  const restore = swapText(pairs);
  if (label) el.setAttribute("aria-label", name);
  const unsplit = () => {
    restore();
    if (label) el.removeAttribute("aria-label");
  };
  const ctx = gsap.context(() => {
    gsap.set(words, { opacity: 0, yPercent: 45, filter: "blur(8px)" });
    gsap.to(words, {
      opacity: 1,
      yPercent: 0,
      filter: "blur(0px)",
      duration: 0.9,
      ease: "power3.out",
      stagger: Math.min(0.07, 0.7 / words.length),
      onComplete: unsplit,
      scrollTrigger: { trigger: el, start: "top 88%", once: true },
    });
  });
  return {
    revert() {
      ctx.revert();
      unsplit();
    },
  };
}

// [data-count] — the server-rendered number counts up from 0 on enter, inside a box
// locked to the final number's width (zero layout shift); the original text returns after.
const NUMBER = /\d[\d,]*(?:\.\d+)?/;
function count(el: HTMLElement): Binding {
  if (seen(el)) return NOOP;
  const text = textNodes(el).find((t) => NUMBER.test(t.data));
  const match = text?.data.match(NUMBER);
  if (!text || !match || match.index === undefined) return NOOP;
  const raw = match[0];
  const target = parseFloat(raw.replace(/,/g, ""));
  if (!Number.isFinite(target) || target <= 0) return NOOP;
  const decimals = raw.split(".")[1]?.length ?? 0;
  const format = (v: number) =>
    raw.includes(",")
      ? v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
      : v.toFixed(decimals);

  const range = document.createRange();
  range.setStart(text, match.index);
  range.setEnd(text, match.index + raw.length);
  const width = range.getBoundingClientRect().width;
  const box = document.createElement("span");
  box.className = "count-box";
  box.style.width = `${width}px`;
  box.textContent = format(0);
  const before = text.data.slice(0, match.index);
  const after = text.data.slice(match.index + raw.length);
  const nodes: Node[] = [box];
  if (before) nodes.unshift(document.createTextNode(before));
  if (after) nodes.push(document.createTextNode(after));
  const restore = swapText([[text, nodes]]);

  const state = { v: 0 };
  const ctx = gsap.context(() => {
    gsap.to(state, {
      v: target,
      duration: clamp(0.8 + Math.log10(target + 1) * 0.35, 0.9, 1.8),
      ease: "power2.out",
      onUpdate: () => {
        box.textContent = format(decimals ? state.v : Math.round(state.v));
      },
      onComplete: restore,
      scrollTrigger: { trigger: el, start: "top 90%", once: true },
    });
  });
  return {
    revert() {
      ctx.revert();
      restore();
    },
  };
}

// [data-parallax="-1..1"] — scrubbed translateY while the element crosses the viewport.
// Positive moves faster than the page (foreground), negative slower (background).
function parallax(el: HTMLElement): Binding {
  const v = clamp(parseFloat(el.getAttribute("data-parallax") ?? "") || 0, -1, 1);
  if (!v) return NOOP;
  const ctx = gsap.context(() => {
    gsap.fromTo(
      el,
      { y: v * 70 },
      {
        y: -v * 70,
        ease: "none",
        scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: 0.5, invalidateOnRefresh: true },
      },
    );
  });
  return { revert: () => ctx.revert() };
}

// [data-pin] (desktop ≥1024px) — pins the element while its [data-step] children are
// stepped through: --pin-progress (0..1) and data-pin-step on the element, data-active
// on the current step and data-past on earlier ones, --step-progress (0..1) per step, and a
// bubbling "cp:pin" event { progress, step, steps }. data-pin="<n>" sets the scroll length
// per step in viewport-height percent (default 70).
function pin(el: HTMLElement): Binding {
  const mm = gsap.matchMedia();
  mm.add(DESKTOP, () => {
    const steps = Array.from(el.querySelectorAll<HTMLElement>("[data-step]")).filter(
      (s) => s.parentElement?.closest("[data-pin]") === el,
    );
    const n = Math.max(steps.length, 1);
    const per = parseFloat(el.getAttribute("data-pin") ?? "") || 70;
    let last = -1;
    const update = (self: ScrollTrigger) => {
      const p = self.progress;
      el.style.setProperty("--pin-progress", p.toFixed(4));
      steps.forEach((s, i) => s.style.setProperty("--step-progress", clamp(p * n - i, 0, 1).toFixed(4)));
      const step = Math.min(n - 1, Math.floor(p * n));
      if (step === last) return;
      last = step;
      el.setAttribute("data-pin-step", String(step));
      steps.forEach((s, i) => {
        s.toggleAttribute("data-active", i === step);
        s.toggleAttribute("data-past", i < step);
      });
      el.dispatchEvent(new CustomEvent("cp:pin", { bubbles: true, detail: { progress: p, step, steps: n } }));
    };
    ScrollTrigger.create({
      trigger: el,
      start: "top top",
      end: () => `+=${(n * per * window.innerHeight) / 100}`,
      pin: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: update,
      onRefresh: update,
      onToggle: (self) => el.toggleAttribute("data-pinned", self.isActive),
    });
    return () => {
      el.removeAttribute("data-pin-step");
      el.removeAttribute("data-pinned");
      el.style.removeProperty("--pin-progress");
      for (const s of steps) {
        s.removeAttribute("data-active");
        s.removeAttribute("data-past");
        s.style.removeProperty("--step-progress");
      }
    };
  });
  return { revert: () => mm.revert() };
}

// [data-tilt] (pointer:fine) — 3D hover tilt toward the pointer with a glare highlight.
// data-tilt="<deg>" sets the maximum angle (default 6).
function tilt(el: HTMLElement): Binding {
  const mm = gsap.matchMedia();
  mm.add(FINE, () => {
    const max = parseFloat(el.getAttribute("data-tilt") ?? "") || 6;
    const glare = document.createElement("span");
    glare.className = "tilt-glare";
    glare.setAttribute("aria-hidden", "true");
    const positioned = getComputedStyle(el).position !== "static";
    if (!positioned) el.style.position = "relative";
    el.appendChild(glare);
    gsap.set(el, { transformPerspective: 900 });
    const rx = gsap.quickTo(el, "rotationX", { duration: 0.6, ease: "power3" });
    const ry = gsap.quickTo(el, "rotationY", { duration: 0.6, ease: "power3" });
    const lift = gsap.quickTo(el, "z", { duration: 0.6, ease: "power3" });
    // The untilted rect, cached on enter (reading it per move would measure the tilt
    // itself); re-read only after the page scrolled.
    let r: DOMRect | null = null;
    let at = 0;
    const move = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      if (!r || at !== window.scrollY) {
        if (!r) r = el.getBoundingClientRect();
        else r = new DOMRect(r.x, r.y + at - window.scrollY, r.width, r.height);
        at = window.scrollY;
      }
      const px = clamp((e.clientX - r.left) / r.width, 0, 1);
      const py = clamp((e.clientY - r.top) / r.height, 0, 1);
      ry((px - 0.5) * 2 * max);
      rx((0.5 - py) * 2 * max);
      lift(14);
      el.style.setProperty("--gx", `${(px * 100).toFixed(1)}%`);
      el.style.setProperty("--gy", `${(py * 100).toFixed(1)}%`);
      el.setAttribute("data-tilting", "");
    };
    const leave = () => {
      r = null;
      rx(0);
      ry(0);
      lift(0);
      el.removeAttribute("data-tilting");
    };
    el.addEventListener("pointermove", move, { passive: true });
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      glare.remove();
      if (!positioned) el.style.removeProperty("position");
      el.style.removeProperty("--gx");
      el.style.removeProperty("--gy");
      el.removeAttribute("data-tilting");
    };
  });
  return { revert: () => mm.revert() };
}

// [data-magnetic] (pointer:fine) — the element leans toward the pointer (max 12px) and
// eases back on leave. For primary buttons/links.
function magnetic(el: HTMLElement): Binding {
  const mm = gsap.matchMedia();
  mm.add(FINE, () => {
    const xTo = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3" });
    const move = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2 - (gsap.getProperty(el, "x") as number);
      const cy = r.top + r.height / 2 - (gsap.getProperty(el, "y") as number);
      xTo(clamp((e.clientX - cx) * 0.3, -12, 12));
      yTo(clamp((e.clientY - cy) * 0.3, -12, 12));
    };
    const leave = () => {
      xTo(0);
      yTo(0);
    };
    el.addEventListener("pointermove", move, { passive: true });
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  });
  return { revert: () => mm.revert() };
}

/** Attribute → binder. The runtime binds each element once per attribute. */
export const BINDERS: Record<string, (el: HTMLElement) => Binding> = {
  ...CARD_BINDERS,
  "data-split": split,
  "data-count": count,
  "data-parallax": parallax,
  "data-pin": pin,
  "data-tilt": tilt,
  "data-magnetic": magnetic,
  "data-arch": arch,
};

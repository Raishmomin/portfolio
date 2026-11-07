// Card-level motion hooks (contract: components/motion/index.ts): [data-card],
// [data-card-group], [data-deck], [data-hscroll], [data-spotlight], [data-draw] and
// [data-marquee]. Each binder returns a Binding whose revert() restores the server DOM
// exactly (inline styles, attributes, clones, pins). Loaded only inside the lazy runtime.
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { DESKTOP, FINE, HSCROLL, NOOP, NOT_HSCROLL, clamp, seen, type Binding } from "./shared";

type Kind = "rise" | "flip" | "swing" | "zoom";

const kindOf = (c: HTMLElement): Kind => {
  const k = c.dataset.card;
  return k === "flip" || k === "swing" || k === "zoom" ? k : "rise";
};

/** The card's own [data-card-part]s, in DOM order (not those of a nested card). */
function partsOf(card: HTMLElement): HTMLElement[] {
  return Array.from(card.querySelectorAll<HTMLElement>("[data-card-part]")).filter(
    (p) => p.parentElement?.closest("[data-card]") === card,
  );
}

/*
 * Card entrances are CSS transitions keyed on attributes (app/globals.css "Card
 * entrances"), started by one shared IntersectionObserver: arming a card only writes
 * attributes and custom properties (no style reads, so binding a long page never forces
 * a style recalc per card), the motion runs on the compositor, and the observer also
 * sees cards that a horizontal track slides into view. Poses: data-card-wait="<kind>";
 * landing: data-card-in with --cd (delay); parts cascade by --pi × --each, pop children
 * by --ci. Everything is removed once the card has landed.
 */
const waiting = new Map<HTMLElement, Element | null>(); // armed card -> its wave scope
const timers = new Map<HTMLElement, number>();
let io: IntersectionObserver | null = null;

function observer(): IntersectionObserver {
  io ??= new IntersectionObserver(
    (entries) => {
      // Cards entering together form one wave per scope, staggered by grid distance
      // (row + column, max 8 steps) from the first one. Rects come with the entries.
      const waves = new Map<Element | null, IntersectionObserverEntry[]>();
      for (const e of entries) {
        const c = e.target as HTMLElement;
        if (!e.isIntersecting || !waiting.has(c) || c.hasAttribute("data-card-in")) continue;
        const scope = waiting.get(c) ?? null;
        const wave = waves.get(scope);
        if (wave) wave.push(e);
        else waves.set(scope, [e]);
      }
      for (const wave of waves.values()) {
        wave.sort((x, y) => x.boundingClientRect.top - y.boundingClientRect.top || x.boundingClientRect.left - y.boundingClientRect.left);
        const o = wave[0].boundingClientRect;
        for (const e of wave) {
          const r = e.boundingClientRect;
          const d = Math.hypot((r.left - o.left) / Math.max(1, o.width), (r.top - o.top) / Math.max(1, o.height));
          land(e.target as HTMLElement, Math.min(8, Math.round(d)) * 0.075);
        }
      }
    },
    { rootMargin: "0px 0px -12% 0px" },
  );
  return io;
}

/** Hide a card in its start pose until it scrolls in. Writes only. */
function arm(card: HTMLElement, kind: Kind, scope: Element | null) {
  const parts = partsOf(card);
  card.setAttribute("data-card-wait", kind);
  card.style.setProperty("--each", `${Math.min(0.07, 0.56 / Math.max(1, parts.length)).toFixed(3)}s`);
  parts.forEach((p, i) => {
    p.style.setProperty("--pi", String(i));
    if (p.dataset.cardPart === "pop") Array.from(p.children).forEach((c, j) => (c as HTMLElement).style.setProperty("--ci", String(j)));
  });
  waiting.set(card, scope);
  observer().observe(card);
}

function land(card: HTMLElement, delay: number) {
  io?.unobserve(card);
  card.style.setProperty("--cd", `${delay.toFixed(3)}s`);
  card.setAttribute("data-card-in", "");
  timers.set(card, window.setTimeout(() => disarm(card), (delay + 2.4) * 1000));
}

/** Back to the server DOM (landed or not). */
function disarm(card: HTMLElement) {
  io?.unobserve(card);
  waiting.delete(card);
  window.clearTimeout(timers.get(card));
  timers.delete(card);
  card.removeAttribute("data-card-wait");
  card.removeAttribute("data-card-in");
  card.style.removeProperty("--each");
  card.style.removeProperty("--cd");
  for (const p of partsOf(card)) {
    p.style.removeProperty("--pi");
    for (const c of Array.from(p.children)) (c as HTMLElement).style.removeProperty("--ci");
    if (p.getAttribute("style") === "") p.removeAttribute("style");
    for (const c of Array.from(p.children)) if (c.getAttribute("style") === "") c.removeAttribute("style");
  }
  if (card.getAttribute("style") === "") card.removeAttribute("style");
}

/** Cards of a group: direct members only (a nested group owns its own cards). */
function membersOf(g: HTMLElement): HTMLElement[] {
  return Array.from(g.querySelectorAll<HTMLElement>("[data-card]")).filter(
    (c) => c.parentElement?.closest("[data-card-group]") === g,
  );
}

// [data-card-group] — its cards enter as a wave. Inside a [data-hscroll] the desktop pin
// owns the entrances, so the group only binds where the pin does not.
function cardGroup(g: HTMLElement): Binding {
  const mm = gsap.matchMedia();
  mm.add(g.closest("[data-hscroll]") ? NOT_HSCROLL : "all", () => {
    const cards = membersOf(g).filter((c) => !seen(c)); // all reads first
    cards.forEach((c) => arm(c, kindOf(c), g));
    return () => cards.forEach(disarm);
  });
  return { revert: () => mm.revert() };
}

// [data-card] on its own (a card inside a group or a horizontal track is bound there).
function card(c: HTMLElement): Binding {
  if (c.parentElement?.closest("[data-card-group],[data-hscroll-track]") || seen(c)) return NOOP;
  arm(c, kindOf(c), null);
  return { revert: () => disarm(c) };
}

// [data-deck] (desktop ≥1024) — its [data-card] children become a sticky stack: each card
// sticks 14px below the previous one and the next slides over it, while the covered card
// scales to 0.92 and dims (--deck 0..1, scroll-linked). Exposes data-deck-top on the
// top card, data-deck-index on the deck and a bubbling "cp:deck" event
// { index, count, id } (id = the top card's data-focus-id).
const DECK_TOP = 88;
const DECK_STEP = 14;
function deck(el: HTMLElement): Binding {
  const mm = gsap.matchMedia();
  mm.add(DESKTOP, () => {
    const cards = Array.from(el.children).filter(
      (c): c is HTMLElement => c instanceof HTMLElement && c.hasAttribute("data-card"),
    );
    if (cards.length < 2) return;
    el.setAttribute("data-deck-live", "");
    cards.forEach((c, i) => c.style.setProperty("--i", String(i)));
    // Natural (unstuck) offsets of each card inside the deck: sticky never changes flow.
    const offsets = () => {
      const gap = parseFloat(getComputedStyle(el).rowGap) || 0;
      let y = 0;
      return cards.map((c) => {
        const t = y;
        y += c.offsetHeight + gap;
        return t;
      });
    };
    const cover = cards.map(() => 0);
    let top = -1;
    const mark = () => {
      let t = 0;
      while (t < cards.length - 1 && cover[t] >= 0.5) t++;
      if (t === top) return;
      top = t;
      cards.forEach((c, i) => c.toggleAttribute("data-deck-top", i === t));
      el.setAttribute("data-deck-index", String(t));
      const id = cards[t].dataset.focusId ?? cards[t].querySelector<HTMLElement>("[data-focus-id]")?.dataset.focusId;
      el.dispatchEvent(new CustomEvent("cp:deck", { bubbles: true, detail: { index: t, count: cards.length, id } }));
    };
    cards.slice(0, -1).forEach((c, i) => {
      const next = () => offsets()[i + 1];
      ScrollTrigger.create({
        trigger: el,
        start: () => `top+=${next()} bottom`,
        end: () => `top+=${next()} ${DECK_TOP + (i + 1) * DECK_STEP}px`,
        invalidateOnRefresh: true,
        onUpdate: (s) => {
          cover[i] = s.progress;
          c.style.setProperty("--deck", s.progress.toFixed(3));
          mark();
        },
        onRefresh: (s) => {
          cover[i] = s.progress;
          c.style.setProperty("--deck", s.progress.toFixed(3));
          mark();
        },
      });
    });
    // Keyboard: focusing a covered card scrolls back to where it sits on top of the stack.
    const onFocus = (e: FocusEvent) => {
      const c = (e.target as Element).closest<HTMLElement>("[data-card]");
      const k = c ? cards.indexOf(c) : -1;
      if (k < 0 || k >= top) return;
      const y = el.getBoundingClientRect().top + window.scrollY + offsets()[k] - (DECK_TOP + k * DECK_STEP);
      window.scrollTo({ top: y, behavior: "instant" });
    };
    el.addEventListener("focusin", onFocus);
    return () => {
      el.removeEventListener("focusin", onFocus);
      el.removeAttribute("data-deck-live");
      el.removeAttribute("data-deck-index");
      for (const c of cards) {
        c.style.removeProperty("--i");
        c.style.removeProperty("--deck");
        c.removeAttribute("data-deck-top");
      }
    };
  });
  return { revert: () => mm.revert() };
}

// [data-hscroll] (desktop ≥1024 and ≥640px tall) — the section grows by the track's
// overflow and its frame (the track's parent) sticks to the viewport while the vertical
// scroll drives the track sideways. Native position:sticky, not a ScrollTrigger pin: a
// fixed-position pin is reported by Chrome as a full-viewport layout shift where it starts
// and ends, sticky is not, and it scrolls on the compositor. Cards on the first screen
// rise in with the section; the rest swing in from depth as the track brings them in.
// The frame runs full-bleed and fades the track out at the viewport edges (app/globals.css),
// so items enter and leave softly and the first / last item rest fully inside at the start
// / end. The reading line sits at 50% of the viewport and sweeps to 92% over the last part
// of the journey, so the final items light up too. Exposes on the section:
// --hscroll-progress (0..1), --hscroll-fill (share of the track behind the reading line),
// --hscroll-line (the reading line, px from the viewport's left), --hscroll-band (px of
// free frame above the track), --hscroll-edge (px faded at each viewport edge); on track
// items data-lit once the line passes their start and --hs-lit (0..1, how far the line has
// crossed them); and a bubbling "cp:hscroll" event { progress, line }.
function hscroll(el: HTMLElement): Binding {
  const track = el.querySelector<HTMLElement>("[data-hscroll-track]");
  if (!track) return NOOP;
  const mm = gsap.matchMedia();
  mm.add(HSCROLL, () => {
    // Going live re-lays the section out and adds its scroll length below it: only while it is
    // still below the fold, so a reader already at or past it (a #hash landing, a reload
    // mid-page) never sees the page move. They keep the static layout.
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    const frame = track.parentElement !== el ? track.parentElement : null;
    if (!frame) return; // contract: the track sits in a wrapper, which becomes the sticky frame
    el.setAttribute("data-hscroll-live", "");
    frame.setAttribute("data-hscroll-frame", "");
    const items = Array.from(track.children).filter((c): c is HTMLElement => c instanceof HTMLElement);
    // Geometry from layout sizes (never from transformed rects), refreshed with ScrollTrigger:
    // pad = the track's inset from the section's left edge, lefts = item offsets in the row.
    let pad = 0;
    let width = 1;
    let view = 1;
    let lefts: number[] = [];
    let widths: number[] = [];
    const measure = () => {
      const fs = getComputedStyle(frame);
      pad = frame.getBoundingClientRect().left - el.getBoundingClientRect().left + (parseFloat(fs.paddingLeft) || 0);
      const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      let x = 0;
      widths = items.map((c) => c.offsetWidth);
      lefts = widths.map((w) => {
        const at = x;
        x += w + gap;
        return at;
      });
      width = Math.max(1, track.offsetWidth);
      view = el.clientWidth;
      // Free frame above the track (the 3D band) and the faded edge (never wider than the
      // inset, so the first and last items rest fully visible at the ends).
      el.style.setProperty("--hscroll-band", `${Math.max(0, Math.round(track.offsetTop - (parseFloat(fs.paddingTop) || 0)))}px`);
      el.style.setProperty("--hscroll-edge", `${Math.round(clamp(Math.min(pad - 8, view * 0.08), 24, 140))}px`);
    };
    const dist = () => Math.max(0, width + 2 * pad - view);
    // The section's extra height is exactly the horizontal distance to travel.
    const size = () => {
      measure();
      el.style.setProperty("--hscroll-length", `${Math.round(dist())}px`);
    };
    size();
    let last = -1;
    let tween: gsap.core.Tween | null = null;
    const progress = () => tween?.progress() ?? 0;
    const paint = (p: number) => {
      if (Math.abs(p - last) < 0.0005) return;
      last = p;
      // The reading line: 50% of the viewport, sweeping to 92% over the last 45% of the
      // journey. An item lights once the line passes its start (its rail stop).
      const k = clamp((p - 0.55) / 0.45, 0, 1);
      const screen = view * (0.5 + 0.42 * k * k * (3 - 2 * k));
      const line = p * dist() + screen - pad;
      el.style.setProperty("--hscroll-progress", p.toFixed(4));
      el.style.setProperty("--hscroll-fill", clamp(line / width, 0, 1).toFixed(4));
      el.style.setProperty("--hscroll-line", `${screen.toFixed(1)}px`);
      items.forEach((c, i) => {
        c.toggleAttribute("data-lit", lefts[i] <= line);
        c.style.setProperty("--hs-lit", clamp((line - lefts[i]) / Math.max(1, widths[i]), 0, 1).toFixed(3));
      });
      el.dispatchEvent(new CustomEvent("cp:hscroll", { bubbles: true, detail: { progress: p, line: screen } }));
    };
    tween = gsap.to(track, {
      x: () => -dist(),
      ease: "none",
      onUpdate: () => paint(progress()),
      scrollTrigger: {
        trigger: el,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.6,
        invalidateOnRefresh: true,
        onRefreshInit: size,
        onRefresh: () => {
          last = -1;
          paint(progress());
        },
      },
    });
    paint(0);
    const scrubbed = tween;

    // Entrances: what the first frame shows rises in with the section; the rest swings in
    // from depth as the track slides it into view (the shared observer sees both).
    const cards = items.filter((c) => c.hasAttribute("data-card") && !seen(c));
    for (const c of cards) arm(c, lefts[items.indexOf(c)] + pad < view * 0.9 ? kindOf(c) : "swing", track);

    // Keyboard: focus inside the track scrolls the page to where that item is centred.
    const onFocus = (e: FocusEvent) => {
      const st = scrubbed.scrollTrigger;
      const item = items.find((c) => c.contains(e.target as Node));
      if (!st || !item) return;
      const p = clamp((lefts[items.indexOf(item)] + pad - (view - item.offsetWidth) / 2) / (dist() || 1), 0, 1);
      window.scrollTo({ top: st.start + p * (st.end - st.start), behavior: "instant" });
      scrubbed.progress(p);
    };
    el.addEventListener("focusin", onFocus);
    // In-page links to the section land at the START of the journey: the browser would aim
    // at the element's current layout box, which sits at the end of the pin once passed.
    const onClick = (e: MouseEvent) => {
      const a = e.target instanceof Element ? e.target.closest<HTMLAnchorElement>("a[href*='#']") : null;
      const st = scrubbed.scrollTrigger;
      if (!a || !st || !el.id || a.hash !== `#${el.id}` || a.pathname !== location.pathname) return;
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      history.pushState(null, "", `#${el.id}`);
      window.scrollTo({ top: st.start, behavior: "smooth" });
    };
    document.addEventListener("click", onClick);
    return () => {
      el.removeEventListener("focusin", onFocus);
      document.removeEventListener("click", onClick);
      cards.forEach(disarm);
      // The reverted tween leaves an identity transform behind; restore the server style.
      for (const p of ["transform", "translate", "rotate", "scale"]) track.style.removeProperty(p);
      el.removeAttribute("data-hscroll-live");
      frame.removeAttribute("data-hscroll-frame");
      el.style.removeProperty("--hscroll-length");
      el.style.removeProperty("--hscroll-progress");
      el.style.removeProperty("--hscroll-fill");
      for (const p of ["--hscroll-line", "--hscroll-band", "--hscroll-edge"]) el.style.removeProperty(p);
      for (const c of items) {
        c.removeAttribute("data-lit");
        c.style.removeProperty("--hs-lit");
      }
    };
  });
  return { revert: () => mm.revert() };
}

// [data-spotlight] (pointer:fine) — writes the pointer position (--mx/--my, px) for the CSS
// light that follows it inside the element and along its 1px border (app/globals.css).
// One rAF-throttled read+write per frame while hovered.
function spotlight(el: HTMLElement): Binding {
  const mm = gsap.matchMedia();
  mm.add(FINE, () => {
    let raf = 0;
    let x = 0;
    let y = 0;
    const paint = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${(x - r.left).toFixed(0)}px`);
      el.style.setProperty("--my", `${(y - r.top).toFixed(0)}px`);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      x = e.clientX;
      y = e.clientY;
      if (!raf) raf = requestAnimationFrame(paint);
    };
    el.addEventListener("pointermove", move, { passive: true });
    el.addEventListener("pointerenter", move, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerenter", move);
      el.style.removeProperty("--mx");
      el.style.removeProperty("--my");
    };
  });
  return { revert: () => mm.revert() };
}

// [data-draw] — on an <svg> (its path/line/polyline/circle) or a single path: the stroke
// draws with scroll (scrubbed). pathLength exists only while bound.
function draw(el: HTMLElement): Binding {
  const node = el as unknown as Element;
  const paths =
    node instanceof SVGGeometryElement
      ? [node]
      : Array.from(node.querySelectorAll<SVGGeometryElement>("path,line,polyline,circle,rect"));
  if (!paths.length) return NOOP;
  const prev = paths.map((p) => p.getAttribute("pathLength"));
  paths.forEach((p) => p.setAttribute("pathLength", "1"));
  const ctx = gsap.context(() => {
    gsap.fromTo(
      paths,
      { strokeDasharray: 1, strokeDashoffset: 1 },
      { strokeDashoffset: 0, ease: "none", scrollTrigger: { trigger: node, start: "top 85%", end: "bottom 55%", scrub: 0.5 } },
    );
  });
  return {
    revert() {
      ctx.revert();
      paths.forEach((p, i) => {
        const v = prev[i];
        if (v == null) p.removeAttribute("pathLength");
        else p.setAttribute("pathLength", v);
      });
    },
  };
}

// [data-marquee] — an endless ticker. The first child is the row: its items are cloned
// once (aria-hidden + inert, JS-only, so the server HTML never repeats text) and the row
// slides by -50% on the compositor at ~45px/s. Pauses on hover/focus, offscreen, and with
// its own Pause button (WCAG 2.2.2).
function marquee(el: HTMLElement): Binding {
  const row = el.firstElementChild as HTMLElement | null;
  // The live row is one line instead of a wrapped block: only switch while it is below the fold.
  if (!row || !row.children.length || seen(el)) return NOOP;
  const clones = Array.from(row.children).map((n) => {
    const c = n.cloneNode(true) as HTMLElement;
    c.classList.add("mq-clone");
    c.setAttribute("aria-hidden", "true");
    c.setAttribute("inert", "");
    return c;
  });
  row.append(...clones);
  el.setAttribute("data-marquee-live", "");
  el.style.setProperty("--mq", `${Math.max(20, row.offsetWidth / 2 / 45).toFixed(1)}s`);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "mq-pause";
  const label = (paused: boolean) => {
    button.setAttribute("aria-label", paused ? "Play the ticker" : "Pause the ticker");
    button.setAttribute("aria-pressed", String(paused));
    button.textContent = paused ? "▶" : "❚❚";
  };
  label(false);
  const toggle = () => {
    const paused = !el.hasAttribute("data-paused");
    el.toggleAttribute("data-paused", paused);
    label(paused);
  };
  button.addEventListener("click", toggle);
  el.appendChild(button);
  const io = new IntersectionObserver(([e]) => el.toggleAttribute("data-off", !e.isIntersecting));
  io.observe(el);
  return {
    revert() {
      io.disconnect();
      button.removeEventListener("click", toggle);
      button.remove();
      for (const c of clones) c.remove();
      el.removeAttribute("data-marquee-live");
      el.removeAttribute("data-paused");
      el.removeAttribute("data-off");
      el.style.removeProperty("--mq");
    },
  };
}

export const CARD_BINDERS: Record<string, (el: HTMLElement) => Binding> = {
  "data-hscroll": hscroll,
  "data-deck": deck,
  "data-card-group": cardGroup,
  "data-card": card,
  "data-spotlight": spotlight,
  "data-draw": draw,
  "data-marquee": marquee,
};

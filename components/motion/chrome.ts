// Site-wide motion chrome, mounted while motion is on: a 2px scroll-progress hairline
// (scaleX only; a CSS scroll-driven animation where supported, else rAF-throttled) and, on mouse/trackpad devices, a soft cursor glow in the AI accent
// (rAF that sleeps once it settles, transform only). Styles: app/globals.css.
import { gsap } from "gsap";
import { FINE, type Binding } from "./shared";

function node(className: string): HTMLDivElement {
  const el = document.createElement("div");
  el.className = className;
  el.setAttribute("aria-hidden", "true");
  document.body.appendChild(el);
  return el;
}

export function mountChrome(): Binding {
  // Where the browser drives it from the scroll itself (CSS scroll-driven animation,
  // app/globals.css), no JS runs per frame. Elsewhere the page height is cached when the
  // document or the viewport resizes (also right after a client navigation) and the scroll
  // position is read in the scroll event, so the rAF only writes: a layout read after the
  // scrub tick's writes forced a full restyle on every scrolled frame.
  const bar = node("motion-progress");
  let unbar = () => {};
  if (!CSS.supports("animation-timeline: scroll()")) {
    let max = 0;
    let p = 0;
    let frame = 0;
    const paint = () => {
      frame = 0;
      bar.style.transform = `scaleX(${p.toFixed(4)})`;
    };
    const read = () => {
      p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const measure = () => {
      max = document.documentElement.scrollHeight - window.innerHeight;
      read();
    };
    const ro = new ResizeObserver(measure); // fires once on observe: the first paint
    ro.observe(document.documentElement);
    window.addEventListener("scroll", read, { passive: true });
    window.addEventListener("resize", measure);
    unbar = () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener("scroll", read);
      window.removeEventListener("resize", measure);
    };
  }

  const mm = gsap.matchMedia();
  mm.add(FINE, () => {
    const glow = node("motion-glow");
    let tx = 0;
    let ty = 0;
    let x = 0;
    let y = 0;
    let raf = 0;
    const tick = () => {
      x += (tx - x) * 0.16;
      y += (ty - y) * 0.16;
      glow.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.5 ? requestAnimationFrame(tick) : 0;
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      tx = e.clientX;
      ty = e.clientY;
      if (!glow.hasAttribute("data-on")) {
        x = tx;
        y = ty;
        glow.setAttribute("data-on", "");
      }
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const out = (e: MouseEvent) => {
      if (!e.relatedTarget) glow.removeAttribute("data-on");
    };
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("mouseout", out);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", move);
      document.removeEventListener("mouseout", out);
      glow.remove();
    };
  });

  return {
    revert() {
      unbar();
      bar.remove();
      mm.revert();
    },
  };
}

// Site-wide motion chrome, mounted while motion is on: a 2px scroll-progress hairline
// (scaleX only, rAF-throttled) and, on mouse/trackpad devices, a soft cursor glow in the AI accent
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
  // Read straight from the document on each scrolled frame, so it is right even
  // between ScrollTrigger refreshes (e.g. right after a client navigation).
  const bar = node("motion-progress");
  let frame = 0;
  const paint = () => {
    frame = 0;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max).toFixed(4) : 0})`;
  };
  const queue = () => {
    if (!frame) frame = requestAnimationFrame(paint);
  };
  paint();
  window.addEventListener("scroll", queue, { passive: true });
  window.addEventListener("resize", queue);

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
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
      bar.remove();
      mm.revert();
    },
  };
}

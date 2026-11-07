// [data-arch] — architecture spy for the work scene (lazy motion runtime only).
// Inside the element, every [data-arch-item] (a project card or row, carrying its slug in
// data-focus-id) is a step: the visible item nearest the viewport's centre line is the
// active project, and an item under the pointer or holding keyboard focus overrides it.
// A [data-arch-tech="<technology key>"] chip under the pointer names the technology to
// light in 3D. Exposed state:
//   item:     data-arch-active on the active item (CSS lights its chips, staggered)
//   element:  data-arch-slug / data-arch-tech
//   event:    "cp:arch" (bubbles from the element) detail { slug, tech } on every change
// Hidden items (the /projects filter sets `hidden`) never count; a resize (the filter
// fires one) re-measures. Without the runtime nothing is marked: the cards are static.
import type { Binding } from "./shared";

const ITEM = "[data-arch-item]";
const TECH = "[data-arch-tech]";

const HOLD_MS = 140;

const slugOf = (el: Element | null) => (el as HTMLElement | null)?.dataset.focusId ?? null;

export function arch(el: HTMLElement): Binding {
  let scrolled: Element | null = null;
  let hovered: Element | null = null;
  let focused: Element | null = null;
  let tech: string | null = null;
  let current: Element | null = null;
  let sent = "";
  let raf = 0;
  let hold = 0;
  let pending: Element | null = null;

  const pick = () => {
    raf = 0;
    const line = window.innerHeight / 2;
    let best: Element | null = null;
    let bestD = Infinity;
    for (const it of el.querySelectorAll(ITEM)) {
      if (it.closest("[hidden]")) continue;
      const r = it.getBoundingClientRect();
      if (r.height <= 0) continue;
      const d = line < r.top ? r.top - line : line > r.bottom ? line - r.bottom : 0;
      // Inside the line: prefer the item whose centre is nearest it.
      const score = d === 0 ? -1 / (1 + Math.abs((r.top + r.bottom) / 2 - line)) : d;
      if (score < bestD) {
        bestD = score;
        best = it;
      }
    }
    // A fast scroll would flick through projects every few frames: the reading line's
    // project takes over once it has held for a moment (hover and focus switch at once).
    // The timer restarts only when the candidate changes, so a steady scroll still switches.
    if (best === scrolled) {
      window.clearTimeout(hold);
      pending = null;
      return;
    }
    if (best === pending) return;
    window.clearTimeout(hold);
    pending = best;
    hold = window.setTimeout(
      () => {
        scrolled = best;
        pending = null;
        emit();
      },
      scrolled ? HOLD_MS : 0,
    );
  };
  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(pick);
  };

  const emit = () => {
    const item = hovered ?? focused ?? scrolled;
    if (item !== current) {
      current?.removeAttribute("data-arch-active");
      item?.setAttribute("data-arch-active", "");
      current = item;
    }
    const slug = slugOf(item);
    const key = `${slug}|${tech}`;
    if (key === sent) return;
    sent = key;
    if (slug) el.dataset.archSlug = slug;
    else delete el.dataset.archSlug;
    if (tech) el.dataset.archTech = tech;
    else delete el.dataset.archTech;
    el.dispatchEvent(new CustomEvent("cp:arch", { bubbles: true, detail: { slug, tech } }));
  };

  const over = (e: PointerEvent) => {
    if (e.pointerType === "touch") return;
    const t = e.target as Element;
    hovered = t.closest(ITEM);
    tech = (t.closest(TECH) as HTMLElement | null)?.dataset.archTech ?? null;
    emit();
  };
  const leave = () => {
    hovered = null;
    tech = null;
    emit();
  };
  const focusIn = (e: FocusEvent) => {
    focused = (e.target as Element).closest(ITEM);
    emit();
  };
  const focusOut = (e: FocusEvent) => {
    const to = e.relatedTarget instanceof Element ? e.relatedTarget.closest(ITEM) : null;
    focused = to && el.contains(to) ? to : null;
    emit();
  };

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule, { passive: true });
  el.addEventListener("pointerover", over, { passive: true });
  el.addEventListener("pointerleave", leave);
  el.addEventListener("focusin", focusIn);
  el.addEventListener("focusout", focusOut);
  pick();

  return {
    revert() {
      cancelAnimationFrame(raf);
      window.clearTimeout(hold);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      el.removeEventListener("pointerover", over);
      el.removeEventListener("pointerleave", leave);
      el.removeEventListener("focusin", focusIn);
      el.removeEventListener("focusout", focusOut);
      current?.removeAttribute("data-arch-active");
      delete el.dataset.archSlug;
      delete el.dataset.archTech;
    },
  };
}

// DOM → 3D signals for the contact scene (components/neural/scenes/contact/rig.ts): the
// contact form and the copy-email button say what happened and which element the message
// leaves the page from, so the globe can fly a packet from there to the city. Plain window
// events: nothing listens (and nothing breaks) when the 3D stage is off.
export type ContactSignalKind = "focus" | "blur" | "type" | "copy" | "send" | "sent" | "error";

/** Where a message leaves the page: the edge of the element's panel facing the globe, at the element's height. */
export function launchPoint(el: Element): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  const panel = (el.closest(".panel") ?? el).getBoundingClientRect();
  return { x: panel.left, y: Math.min(Math.max(r.top + r.height / 2, 0), window.innerHeight) };
}

export function signal(kind: ContactSignalKind, el?: Element | null) {
  const detail = el ? { kind, el, ...launchPoint(el) } : { kind };
  window.dispatchEvent(new CustomEvent("cp:contact", { detail }));
}

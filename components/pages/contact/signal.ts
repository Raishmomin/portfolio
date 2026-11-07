// DOM → 3D signals for the contact scene (components/neural/scenes/contact/rig.ts): the
// contact form and the copy-email button say what happened and where the message leaves
// the page, so the globe can fly a packet from there to the city. Plain window events:
// nothing listens (and nothing breaks) when the 3D stage is off.
export type ContactSignalKind = "focus" | "blur" | "type" | "copy" | "send" | "sent" | "error";
export type LaunchPoint = { x: number; y: number };

/** Where a message leaves the page: the edge of the element's panel facing the globe, at the element's height. */
export function launchPoint(el: Element | null | undefined): LaunchPoint | undefined {
  if (!el) return undefined;
  const r = el.getBoundingClientRect();
  const panel = (el.closest(".panel") ?? el).getBoundingClientRect();
  const y = Math.min(Math.max(r.top + r.height / 2, 0), window.innerHeight);
  return { x: panel.left, y };
}

export function signal(kind: ContactSignalKind, at?: LaunchPoint) {
  window.dispatchEvent(new CustomEvent("cp:contact", { detail: at ? { kind, x: at.x, y: at.y } : { kind } }));
}

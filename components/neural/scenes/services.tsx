"use client";
// Services scene: each engagement in NeuralData.services as the working system it delivers,
// built from shared instanced parts (services/designs.ts): Next.js = an App Router route
// tree streaming server components into a page; MERN = MongoDB, Express, React and Node
// passing data round one loop; DevOps & AWS = a CI/CD loop building containers and
// shipping them to a cloud cluster; API & Backend = a gateway that checks auth and rate
// limits before the backend answers. Switching services reassembles the machine: parts
// glide to their new place, new ones rise in, links draw on.
// Which service: a hovered / focused card (data-focus-id="service:<slug>") at once; else
// the card at the reading line ([data-arch] spy on the list, which also highlights that
// card, so scene and card always agree); else scroll progress through the section; on a
// service page the page's own service ([data-service-pin]); on a section without cards
// (the /services intro) and on phones (where the cards cover the scene) the four take turns.
// Where: the scene's own free rect (framing.sceneFrames.services), shrunk by the
// visibility guard so it never sits under content. A page intro frames it beside the
// headline and sits it on its 3D caption; on phones a page may reserve an empty room for it
// ([data-svc-room]). Names are aria-hidden labels in the shared layer (duplicates of the
// server-rendered cards: active scene only, never over content or each other, clamped),
// each appearing as its part lands.
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Vector3, type Camera, type Matrix4 } from "three";
import { clearRect, framing, sceneFrames, type Rect } from "../framing";
import { occluders } from "../occluders";
import type { SceneProps } from "../types";
import type { Side } from "./services/designs";
import { emptyRegistry, ServicesRig, stagger, type ServicesFrame, type ServicesRegistry } from "./services/rig";
import { LabelLayer, type Align } from "./stack/labels";

const PREFIX = "service:";
const HEADER_PX = 76;
/** Largest scale (world units per layout unit). */
const CAP = 1.25;
/** Below this frame height (px) there is no room: the machine fades out. */
const MIN_H = { desk: 200, phone: 140 };
/** Turns per service on a section without cards (s). */
const CYCLE = 6.5;
/** Nearest depth of a machine after its turn (layout units), for the perspective fit. */
const NEAR_Z = 1.1;
/** A page's reserved phone room for the machine (an empty aria-hidden block). */
const ROOM_SEL = "[data-svc-room]";
/** Px the label layer keeps free at the viewport edges (its clamp, mirrored here). */
const EDGE = 12;
/** Px between two labels. */
const GAP = 4;

const ALIGN: Record<Side, Align> = {
  r: { x: 0, y: -0.5, dx: 10 },
  l: { x: -1, y: -0.5, dx: -10 },
  t: { x: -0.5, y: -1, dy: -6 },
  b: { x: -0.5, y: 0, dy: 6 },
};

type Spy = { el: Element; slug: string };
/** One label of a machine: its anchor, its alignment (dy nudged off other labels) and size. */
type Slot = { id: number; x: number; y: number; z: number; side: Side; dy0: number; align: Align; off: number; w: number; h: number; at: number };
/** Scratch rects (px) for the framing (one services scene per page). */
const px: Rect = { l: 0, t: 0, r: 0, b: 0 };
const clear: Rect = { l: 0, t: 0, r: 0, b: 0 };

const v0 = new Vector3();
const v1 = new Vector3();
/** World point on the z = 0 plane under a canvas pixel (out = [x, y]). */
function toWorld(camera: Camera, px: number, py: number, w: number, h: number, out: number[]) {
  v0.set((px / w) * 2 - 1, 1 - (py / h) * 2, 0.5).unproject(camera);
  v1.copy(camera.position);
  v0.sub(v1);
  const t = Math.abs(v0.z) > 1e-6 ? -v1.z / v0.z : 0;
  out[0] = v1.x + v0.x * t;
  out[1] = v1.y + v0.y * t;
}

/**
 * The visibility guard, widened: besides the guard's own answer (the rect shrunk from the
 * bottom until no content covers it), try stepping the side that faces the content column
 * away (10% at a time, up to 30%), and keep whichever candidate lets the machine (half
 * extents hw × hh) be drawn largest. side: -1 = content on the right of the rect, 1 = on its left.
 */
const cand: Rect = { l: 0, t: 0, r: 0, b: 0 };
function roomFor(px: Rect, minH: number, out: Rect, side: number, hw: number, hh: number): Rect | null {
  const step = (px.r - px.l) * 0.1;
  let best = 0;
  for (let k = 0; k < 4; k++) {
    if (clearRect(px, minH, cand)) {
      const score = Math.min((cand.r - cand.l) / hw, (cand.b - cand.t) / hh);
      if (score > best) {
        best = score;
        Object.assign(out, cand);
      }
    }
    if (side < 0) px.r -= step;
    else if (side > 0) px.l += step;
    else break;
  }
  return best > 0 ? out : null;
}

/**
 * A page intro (data-section="intro": the headline on the left, its 3D caption at the
 * bottom right): the room between the headline's actual text and the content grid's right
 * edge (a little past it on wide screens), above the caption. Returns the caption's centre
 * x (the machine centres on it), or NaN when there is no such room (narrow screens).
 */
type Intro = { els: Element[]; note: Element | null; box: Element };
const intros = new WeakMap<Element, Intro | null>();
let range: Range | null = null;
function introRoom(sec: HTMLElement, W: number, H: number, out: Rect): number {
  let it = intros.get(sec);
  if (it === undefined || (it && !it.box.isConnected)) {
    const h1 = sec.querySelector("h1");
    const block = h1?.parentElement;
    const box = block?.parentElement;
    it = block && box ? { els: [...block.querySelectorAll("h1, p, a")], note: box.lastElementChild !== block ? box.lastElementChild : null, box } : null;
    intros.set(sec, it);
  }
  if (!it) return NaN;
  range ??= document.createRange();
  // The text's real right edge (line boxes, not the column's).
  let textR = 0;
  for (const el of it.els) {
    let r: DOMRect;
    if (el.tagName === "A") r = el.getBoundingClientRect();
    else {
      range.selectNodeContents(el);
      r = range.getBoundingClientRect();
    }
    if (r.width > 0 && r.right > textR) textR = r.right;
  }
  const br = it.box.getBoundingClientRect();
  const nr = it.note?.getBoundingClientRect();
  const note = nr && nr.width > 0 && getComputedStyle(it.note as Element).position === "absolute" ? nr : null;
  const gridR = note ? note.right : br.right - 32;
  out.l = textR + 56;
  const margin = W - gridR;
  out.r = Math.min(W - 24, gridR + Math.max(margin * 0.45, Math.min(margin * 0.8, 120)));
  out.t = Math.max(HEADER_PX + 12, br.top + 12);
  out.b = Math.min(H - 12, note ? note.top - 22 : br.bottom - 16);
  if (out.r - out.l < 300) return NaN;
  // Block boxes (the headline's full-width column) count as content for the labels: start
  // clear of them, with room for a label hanging off the machine's left side.
  occluders.sync();
  if (occluders.hits(out.l, out.t, out.r, out.b)) {
    let lo = out.l;
    let hi = out.r - 300;
    if (occluders.hits(hi, out.t, out.r, out.b)) return NaN;
    for (let i = 0; i < 10 && hi - lo > 2; i++) {
      const m = (lo + hi) / 2;
      if (occluders.hits(m, out.t, out.r, out.b)) lo = m;
      else hi = m;
    }
    out.l = Math.min(hi + 32, out.r - 300);
  }
  return note ? (note.left + note.right) / 2 : (out.l + out.r) / 2;
}

/** Narrow a room to the machine's aspect: centred on x (clamped inside), sitting on its bottom. */
function sitOn(room: Rect, x: number, hw: number, hh: number) {
  const asp = hw / hh;
  const rw = room.r - room.l;
  const rh = room.b - room.t;
  if (rw > rh * asp) {
    const nw = rh * asp;
    const cx = Math.min(Math.max(x, room.l + nw / 2), room.r - nw / 2);
    room.l = cx - nw / 2;
    room.r = cx + nw / 2;
  } else room.t = room.b - rw / asp;
}

/**
 * Labels never overlap each other: placed in priority order (the machine's own order, then
 * its title), each one that would cover an earlier one moves off by its height on its side (up
 * for "t", down for "b", either way for "l" / "r"), else hides. A moved label returns home
 * only once home is clear by a margin, so labels do not flicker on a boundary.
 */
const placed = new Float32Array(4 * 24);
let nPlaced = 0;
const bx = [0, 0, 0, 0];
const lv = new Vector3();
function boxAt(s: Slot, sx: number, sy: number, off: number, W: number, H: number) {
  const a = s.align;
  let x = sx + a.x * s.w + (a.dx ?? 0);
  let y = sy + a.y * s.h + s.dy0 + off;
  x = Math.min(Math.max(x, EDGE), Math.max(EDGE, W - EDGE - s.w));
  y = Math.min(Math.max(y, EDGE), Math.max(EDGE, H - EDGE - s.h));
  bx[0] = x;
  bx[1] = y;
  bx[2] = x + s.w;
  bx[3] = y + s.h;
}
function clearOf(m: number) {
  for (let i = 0; i < nPlaced; i++) {
    const o = i * 4;
    if (bx[2] + m > placed[o] && bx[0] - m < placed[o + 2] && bx[3] + m > placed[o + 1] && bx[1] - m < placed[o + 3]) return false;
  }
  return true;
}
function offset(side: Side, k: number, h: number) {
  const step = h + GAP;
  if (k === 0) return 0;
  if (side === "b") return step * k;
  if (side === "t") return -step * k;
  return k === 1 ? -step : step;
}
function placeLabel(layer: LabelLayer, s: Slot, alpha: number, M: Matrix4, camera: Camera, W: number, H: number) {
  if (alpha < 0.03) {
    layer.hide(s.id);
    return;
  }
  lv.set(s.x, s.y, s.z).applyMatrix4(M).project(camera);
  if (lv.z > 1 || lv.z < -1) {
    layer.hide(s.id);
    return;
  }
  const sx = ((lv.x + 1) / 2) * W;
  const sy = ((1 - lv.y) / 2) * H;
  let chosen = NaN;
  boxAt(s, sx, sy, 0, W, H);
  const home = clearOf(GAP + (s.off !== 0 ? 4 : 0));
  if (home) chosen = 0;
  else {
    if (s.off !== 0) {
      boxAt(s, sx, sy, s.off, W, H);
      if (clearOf(GAP)) chosen = s.off;
    }
    for (let k = 1; k < 3 && chosen !== chosen; k++) {
      const o = offset(s.side, k, s.h);
      boxAt(s, sx, sy, o, W, H);
      if (clearOf(GAP)) chosen = o;
    }
  }
  if (chosen !== chosen) {
    layer.hide(s.id);
    return;
  }
  boxAt(s, sx, sy, chosen, W, H);
  if (nPlaced < placed.length / 4) {
    placed.set(bx, nPlaced * 4);
    nPlaced++;
  }
  if (chosen !== s.off) {
    s.off = chosen;
    s.align.dy = s.dy0 + chosen;
    layer.setAlign(s.id, s.align);
  }
  layer.place(s.id, s.x, s.y, s.z, M, camera, W, H, alpha);
}

type Labels = { layer: LabelLayer; slots: Slot[][]; sized: boolean };
/** One batched read of every label's size (labels are laid out even while hidden). */
function sizeLabels(L: Labels) {
  const kids = L.layer.el.children;
  for (const list of L.slots)
    for (const sl of list) {
      const el = kids[sl.id] as HTMLElement | undefined;
      sl.w = el?.offsetWidth ?? 0;
      sl.h = el?.offsetHeight ?? 0;
    }
  L.sized = true;
}

const smooth01 = (v: number) => {
  const t = v < 0 ? 0 : v > 1 ? 1 : v;
  return t * t * (3 - 2 * t);
};

/**
 * The room is re-measured at most every ROOM_MS while the page scrolls (ROOM_IDLE_MS
 * otherwise) or when the frame changes: each measurement reads layout (the occluder rects,
 * the scroll offset), which would force a style recalc on every frame.
 */
const ROOM_MS = 100;
const ROOM_IDLE_MS = 500;
/** doc: the room scrolls with the page (phone room, intro): shifted by the scroll since. */
type RoomCache = { at: number; ok: boolean; key: number; doc: boolean; y: number };
const room0: Rect = { l: 0, t: 0, r: 0, b: 0 };
const room1: Rect = { l: 0, t: 0, r: 0, b: 0 };

/** Does this section list service cards (then scroll / the spy pick the service)? */
const hasCards = new WeakMap<Element, boolean>();
function listsCards(el: Element) {
  let v = hasCards.get(el);
  if (v === undefined) {
    v = !!el.querySelector(`[data-focus-id^="${PREFIX}"]`);
    hasCards.set(el, v);
  }
  return v;
}

export default function ServicesScene({ data, weight, progress, pointer, focus, palette, quality }: SceneProps) {
  const services = useMemo(() => data.services ?? [], [data.services]);
  const rig = useMemo(() => new ServicesRig(services, quality), [services, quality]);
  const index = useMemo(() => new Map(services.map((s, i) => [s.slug, i])), [services]);
  useEffect(() => () => rig.dispose(), [rig]);
  useEffect(() => rig.setPalette(palette), [rig, palette]);
  const active = weight > 0;

  // The card spy's latest report for a services list ("cp:arch" bubbles { slug }).
  const spy = useRef<Spy | null>(null);
  // A service page's own service.
  const pin = useRef<number>(-1);
  // A phone room reserved by the page (looked up again if it leaves the DOM).
  const slot = useRef<{ el: HTMLElement | null; at: number }>({ el: null, at: -1e9 });
  useEffect(() => {
    const onArch = (e: Event) => {
      const slug = (e as CustomEvent<{ slug?: string | null }>).detail?.slug;
      if (e.target instanceof Element && slug?.startsWith(PREFIX)) spy.current = { el: e.target, slug: slug.slice(PREFIX.length) };
    };
    document.addEventListener("cp:arch", onArch);
    const el = document.querySelector<HTMLElement>("[data-arch-slug^='service:']");
    if (el?.dataset.archSlug) spy.current = { el, slug: el.dataset.archSlug.slice(PREFIX.length) };
    const p = document.querySelector<HTMLElement>("[data-service-pin]")?.dataset.servicePin;
    pin.current = p ? (index.get(p) ?? -1) : -1;
    return () => document.removeEventListener("cp:arch", onArch);
  }, [index]);

  // Labels: each machine's technology names, then its title.
  const host = useThree((s) => s.gl.domElement.parentElement);
  const labels = useRef<Labels | null>(null);
  useEffect(() => {
    if (!host || services.length === 0) return;
    const layer = new LabelLayer(host);
    const chip = `color-mix(in srgb, ${palette.bg} 80%, transparent)`;
    const slots = rig.designs.map((d, k) => {
      const list: Slot[] = [];
      for (const l of d.labels) {
        const base = ALIGN[l.side];
        const id = layer.add(l.text, "", "rounded-full border px-2 py-[3px] font-mono text-[10.5px] leading-none tracking-[0.02em]", base);
        layer.style(id, { color: palette.fg, background: chip, borderColor: `color-mix(in srgb, ${palette.muted} 55%, transparent)` });
        // A name appears once its part has landed (the machine assembles left to right).
        list.push({ id, x: l.x, y: l.y, z: l.z, side: l.side, dy0: base.dy ?? 0, align: { ...base }, off: 0, w: 0, h: 0, at: stagger(l.x) + 0.25 });
      }
      // The title goes last: the names keep their places, the title steps up over them.
      const title = layer.add(`● ${services[k].title}`, "", "font-mono text-xs uppercase tracking-[0.16em]", { x: -0.5, y: -1 });
      layer.style(title, { color: palette.fg, textShadow: `0 0 10px ${palette.bg}, 0 0 4px ${palette.bg}` });
      list.push({ id: title, x: d.title[0], y: d.title[1], z: d.title[2], side: "t", dy0: 0, align: { x: -0.5, y: -1, dy: 0 }, off: 0, w: 0, h: 0, at: 0.25 });
      return list;
    });
    const L: Labels = { layer, slots, sized: false };
    labels.current = L;
    // Sizes change once the web fonts arrive.
    document.fonts?.ready.then(() => {
      L.sized = false;
    });
    return () => {
      labels.current = null;
      layer.dispose();
    };
  }, [host, rig, services, palette]);

  const reg = useRef<ServicesRegistry>(emptyRegistry());
  const f = useRef<ServicesFrame>({ active: 0, weight: 0, pointer: { x: 0, y: 0 }, x: 0, y: 0, scale: 1, turn: 0, room: 0 });
  const seen = useRef({ last: -1e9, room: 0 });
  const cache = useRef<RoomCache>({ at: -1e9, ok: false, key: NaN, doc: false, y: 0 });
  // Scrolls mark the room stale (a passive flag: no layout read here).
  const scrolledAt = useRef(-1e9);
  useEffect(() => {
    const on = () => {
      scrolledAt.current = performance.now();
    };
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on, { passive: true });
    return () => {
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
    };
  }, []);
  const pt = useMemo(() => [0, 0], []);

  useFrame((state, dt) => {
    const L = labels.current;
    const { root, tilt } = reg.current;
    if (!active || services.length === 0 || !root || !tilt) {
      L?.layer.hideAll();
      return;
    }
    const time = state.clock.elapsedTime;
    const { camera, size } = state;
    const o = f.current;
    const sf = sceneFrames.services;
    const sec = sf.el;
    const phone = framing.phone;

    // Which service. Phones: the cards cover the scene, so the four take turns in its room.
    let idx = -1;
    if (focus?.startsWith(PREFIX)) idx = index.get(focus.slice(PREFIX.length)) ?? -1;
    const s = spy.current;
    if (!phone && idx < 0 && s && sec && s.el.isConnected && sec.contains(s.el)) idx = index.get(s.slug) ?? -1;
    if (!phone && idx < 0 && sec && listsCards(sec)) idx = Math.min(services.length - 1, Math.floor(progress * services.length));
    if (idx < 0 && pin.current >= 0) idx = pin.current;
    if (idx < 0) idx = Math.floor(time / CYCLE) % services.length;

    // Coming back after a while: assemble the machine again.
    if (time - seen.current.last > 0.8) rig.reassemble(idx);
    seen.current.last = time;

    // Where: the free rect in px, minus anything content covers.
    const W = size.width;
    const H = size.height;
    px.l = sf.rect.l * W;
    px.r = sf.rect.r * W;
    px.t = Math.max(sf.rect.t * H, phone ? 56 : HEADER_PX);
    px.b = Math.min(sf.rect.b * H, H - 8);
    const mid = (sf.rect.l + sf.rect.r) / 2;
    const d = rig.designs[rig.current >= 0 ? rig.current : idx];
    const side = phone ? 0 : mid < 0.45 ? -1 : mid > 0.55 ? 1 : 0;
    const c = cache.current;
    const now = performance.now();
    const key = px.l + px.t * 7 + px.r * 13 + px.b * 17 + W * 19 + H * 23 + (sec ? 1 : 0) + rig.current * 29;
    if (key !== c.key || now - c.at > (now - scrolledAt.current < 200 ? ROOM_MS : ROOM_IDLE_MS)) {
      c.key = key;
      c.at = now;
      c.y = window.scrollY;
      c.doc = false;
      c.ok = false;
      if (sec) {
        // A reserved phone room in view wins; then a page intro's own room; else the frame.
        let el = slot.current.el;
        if (phone && (!el || !el.isConnected) && now - slot.current.at > 1000) {
          slot.current.at = now;
          el = slot.current.el = document.querySelector<HTMLElement>(ROOM_SEL);
        }
        const r = phone && el ? el.getBoundingClientRect() : null;
        if (r && r.height > 0 && r.bottom - Math.max(r.top, 64) >= MIN_H.phone && r.top < H - MIN_H.phone) {
          room1.l = 12;
          room1.r = W - 12;
          room1.t = Math.max(r.top, 64);
          room1.b = Math.min(r.bottom, H - 8);
          c.ok = !!clearRect(room1, MIN_H.phone, clear);
          c.doc = true;
        } else if (!phone && sec.dataset.section === "intro") {
          const x = introRoom(sec, W, H, room1);
          if (x === x && clearRect(room1, MIN_H.desk, clear)) {
            sitOn(clear, x, d.hw, d.hh);
            c.ok = c.doc = true;
          }
        }
        if (!c.doc) {
          c.ok = !!roomFor(px, phone ? MIN_H.phone : MIN_H.desk, clear, side, d.hw, d.hh);
          c.doc = phone;
        }
      }
      if (c.ok) Object.assign(room0, clear);
    }
    const room = c.ok ? room0 : null;
    if (room) {
      // A room on the page moves with it between measurements.
      const shift = c.doc ? c.y - window.scrollY : 0;
      camera.updateMatrixWorld();
      const cw = room.r - room.l;
      const ch = room.b - room.t;
      toWorld(camera, room.l + cw / 2, room.t + shift + ch / 2, W, H, pt);
      o.x = pt[0];
      o.y = pt[1];
      toWorld(camera, room.l, room.t + shift, W, H, pt);
      const halfW = Math.abs(o.x - pt[0]);
      const halfH = Math.abs(pt[1] - o.y);
      let scale = Math.min(CAP, (halfW * 0.92) / d.hw, (halfH * 0.9) / d.hh);
      const dist = Math.max(4, camera.position.z);
      scale = (scale * dist) / (dist + NEAR_Z * scale);
      o.scale = scale;
      const cx = (room.l + cw / 2) / W;
      o.turn = phone ? 0 : cx < 0.45 ? 1 : cx > 0.55 ? -1 : 0;
    }
    seen.current.room += ((room ? 1 : 0) - seen.current.room) * Math.min(1, dt * 6);
    o.active = idx;
    o.weight = weight;
    o.pointer.x = pointer.x;
    o.pointer.y = pointer.y;
    o.room = seen.current.room;
    rig.frame(time, dt, o, root, tilt);

    if (!L) return;
    const { layer } = L;
    if (!layer.begin(weight * (o.room > 0.6 ? 1 : 0))) return;
    if (!L.sized) sizeLabels(L);
    tilt.updateMatrixWorld(true);
    const M = tilt.matrixWorld;
    for (let k = 0; k < rig.designs.length; k++) {
      const a = rig.labelAlpha[k] * o.room;
      const list = L.slots[k];
      const cur = k === rig.current;
      nPlaced = 0;
      for (let j = 0; j < list.length; j++) {
        const sl = list[j];
        // The incoming machine's names wait for their parts to land.
        placeLabel(layer, sl, cur ? a * smooth01((rig.clock - sl.at) / 0.35) : a, M, camera, W, H);
      }
    }
  });

  if (services.length === 0) return null;
  const g = rig.gl;
  return (
    <group
      ref={(el) => {
        reg.current.root = el;
      }}
      visible={active}
    >
      <group
        ref={(el) => {
          reg.current.tilt = el;
        }}
      >
        <mesh geometry={g.slabs} material={g.slabMat} frustumCulled={false} renderOrder={1} />
        <mesh geometry={g.boxes} material={g.boxMat} frustumCulled={false} renderOrder={2} />
        <mesh geometry={g.cyls} material={g.cylMat} frustumCulled={false} renderOrder={2} />
        <mesh geometry={g.links} material={g.linkMat} frustumCulled={false} renderOrder={3} />
        <mesh geometry={g.sprites} material={g.spriteMat} frustumCulled={false} renderOrder={4} />
      </group>
    </group>
  );
}

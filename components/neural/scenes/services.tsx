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
// (the /services intro) the four take turns.
// Where: the scene's own free rect (framing.sceneFrames.services), shrunk by the
// visibility guard so it never sits under content. Names are aria-hidden labels in the
// shared layer (duplicates of the server-rendered cards: active scene only, never over
// content, clamped).
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Vector3, type Camera } from "three";
import { clearRect, framing, sceneFrames, type Rect } from "../framing";
import type { SceneProps } from "../types";
import type { Side } from "./services/designs";
import { emptyRegistry, ServicesRig, type ServicesFrame, type ServicesRegistry } from "./services/rig";
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

const ALIGN: Record<Side, Align> = {
  r: { x: 0, y: -0.5, dx: 10 },
  l: { x: -1, y: -0.5, dx: -10 },
  t: { x: -0.5, y: -1, dy: -6 },
  b: { x: -0.5, y: 0, dy: 6 },
};

type Spy = { el: Element; slug: string };

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
 * The visibility guard, widened: when content (a wide heading's box, say) covers the side
 * of the free rect that faces the content column, step that side away (up to 30%) before
 * giving up. side: -1 = content on the right of the rect, 1 = on its left.
 */
function roomFor(px: Rect, minH: number, out: Rect, side: number): Rect | null {
  const step = (px.r - px.l) * 0.1;
  for (let k = 0; k < 4; k++) {
    if (clearRect(px, minH, out)) return out;
    if (side < 0) px.r -= step;
    else if (side > 0) px.l += step;
    else return null;
  }
  return null;
}

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

  // Labels: each machine's technology names and its title.
  const host = useThree((s) => s.gl.domElement.parentElement);
  const labels = useRef<{ layer: LabelLayer; ids: number[][]; title: number[] } | null>(null);
  useEffect(() => {
    if (!host || services.length === 0) return;
    const layer = new LabelLayer(host);
    const chip = `color-mix(in srgb, ${palette.bg} 80%, transparent)`;
    const ids = rig.designs.map((d) =>
      d.labels.map((l) => {
        const id = layer.add(l.text, "", "rounded-full border px-2 py-[3px] font-mono text-[10.5px] leading-none tracking-[0.02em]", ALIGN[l.side]);
        layer.style(id, { color: palette.fg, background: chip, borderColor: `color-mix(in srgb, ${palette.muted} 55%, transparent)` });
        return id;
      }),
    );
    const title = services.map((s) => {
      const id = layer.add(`● ${s.title}`, "", "font-mono text-xs uppercase tracking-[0.16em]", { x: -0.5, y: -1 });
      layer.style(id, { color: palette.fg, textShadow: `0 0 10px ${palette.bg}, 0 0 4px ${palette.bg}` });
      return id;
    });
    labels.current = { layer, ids, title };
    return () => {
      labels.current = null;
      layer.dispose();
    };
  }, [host, rig, services, palette]);

  const reg = useRef<ServicesRegistry>(emptyRegistry());
  const f = useRef<ServicesFrame>({ active: 0, weight: 0, pointer: { x: 0, y: 0 }, x: 0, y: 0, scale: 1, turn: 0, room: 0 });
  const seen = useRef({ last: -1e9, room: 0 });
  const px = useMemo<Rect>(() => ({ l: 0, t: 0, r: 0, b: 0 }), []);
  const clear = useMemo<Rect>(() => ({ l: 0, t: 0, r: 0, b: 0 }), []);
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

    // Which service.
    let idx = -1;
    if (focus?.startsWith(PREFIX)) idx = index.get(focus.slice(PREFIX.length)) ?? -1;
    const s = spy.current;
    if (idx < 0 && s && sec && s.el.isConnected && sec.contains(s.el)) idx = index.get(s.slug) ?? -1;
    if (idx < 0 && sec && listsCards(sec)) idx = Math.min(services.length - 1, Math.floor(progress * services.length));
    if (idx < 0 && pin.current >= 0) idx = pin.current;
    if (idx < 0) idx = Math.floor(time / CYCLE) % services.length;

    // Coming back after a while: assemble the machine again.
    if (time - seen.current.last > 0.8) rig.reassemble(idx);
    seen.current.last = time;

    // Where: the free rect in px, minus anything content covers.
    const W = size.width;
    const H = size.height;
    const phone = framing.phone;
    px.l = sf.rect.l * W;
    px.r = sf.rect.r * W;
    px.t = Math.max(sf.rect.t * H, phone ? 56 : HEADER_PX);
    px.b = Math.min(sf.rect.b * H, H - 8);
    const mid = (sf.rect.l + sf.rect.r) / 2;
    const room = sec ? roomFor(px, phone ? MIN_H.phone : MIN_H.desk, clear, phone ? 0 : mid < 0.45 ? -1 : mid > 0.55 ? 1 : 0) : null;
    const d = rig.designs[rig.current >= 0 ? rig.current : idx];
    if (room) {
      camera.updateMatrixWorld();
      const cw = room.r - room.l;
      const ch = room.b - room.t;
      toWorld(camera, room.l + cw / 2, room.t + ch / 2, W, H, pt);
      o.x = pt[0];
      o.y = pt[1];
      toWorld(camera, room.l, room.t, W, H, pt);
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
    tilt.updateMatrixWorld(true);
    const M = tilt.matrixWorld;
    for (let k = 0; k < rig.designs.length; k++) {
      const a = rig.labelAlpha[k] * o.room;
      const D = rig.designs[k];
      const ids = L.ids[k];
      for (let j = 0; j < ids.length; j++) {
        if (a < 0.03) layer.hide(ids[j]);
        else layer.place(ids[j], D.labels[j].x, D.labels[j].y, D.labels[j].z, M, camera, W, H, a);
      }
      if (a < 0.03) layer.hide(L.title[k]);
      else layer.place(L.title[k], D.title[0], D.title[1], D.title[2], M, camera, W, H, a);
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

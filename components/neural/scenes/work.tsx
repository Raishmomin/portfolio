"use client";
// Work scene: the active project's architecture, built from its real tech stack
// (NeuralData.work[i].stack). Glass platforms stacked client → server → data carry one
// glowing node per technology; request packets run down the spine and responses run back
// up; an AI project plugs a small neural cluster into its server; infra wraps the whole
// system in a wireframe container. When the project changes, the stack morphs: shared
// technologies glide to their new slot, new ones fly in, missing ones dissolve.
// Which project: the DOM's architecture spy ([data-arch], components/motion/arch.ts)
// reports the card at the reading line or under the pointer, and a hovered chip's
// technology (its node lights up). The scene sits in the section's [data-arch-window]
// (an empty sticky box in the layout) when there is one, else in the composition's free
// rect. Names are aria-hidden screen-space labels in the shared layer (they duplicate the
// DOM cards and follow its rules: active scene only, never over content, clamped).
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Vector3, type Camera } from "three";
import { fitFree } from "../framing";
import type { SceneProps } from "../types";
import { STACK, TIER_INDEX } from "./work/layout";
import { ArchRig, emptyRegistry, type ArchRegistry } from "./work/rig";
import { LabelLayer, type Align } from "./stack/labels";

const TIER_NAME = ["Client", "Server", "Data", "Infra", "AI"];
const LEFT: Align = { x: -1, y: -0.5, dx: -11 };
const RIGHT: Align = { x: 0, y: -0.5, dx: 11 };
/** Largest scale (world units per layout unit) in a free rect; a window may go a bit bigger. */
const CAP = 1.2;

const short = (title: string) => title.split(/\s+[–—-]\s+|\s*\(/)[0].trim();

type Spy = { el: Element; slug: string | null; tech: string | null };
type Win = { el: HTMLElement | null; l: number; t: number; w: number; h: number; ok: boolean };

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

function setText(layer: LabelLayer, id: number, text: string) {
  const el = layer.el.children[id] as HTMLElement | undefined;
  if (!el || el.textContent === text) return;
  el.textContent = text;
  layer.style(id, {});
}

export default function WorkScene({ data, weight, pointer, focus, palette, quality }: SceneProps) {
  const work = useMemo(() => data.work ?? [], [data.work]);
  const rig = useMemo(() => new ArchRig(work), [work]);
  const index = useMemo(() => new Map(work.map((p, i) => [p.slug, i])), [work]);
  /** Tier of every technology node (a technology keeps its tier across projects). */
  const vocabTier = useMemo(() => {
    const t = new Uint8Array(rig.v);
    for (const p of work) for (const s of p.stack) t[rig.vocab.index.get(s.key) ?? 0] = TIER_INDEX[s.tier];
    return t;
  }, [rig, work]);
  useEffect(() => () => rig.dispose(), [rig]);
  useEffect(() => rig.setPalette(palette), [rig, palette]);
  useEffect(() => rig.setQuality(quality), [rig, quality]);
  const active = weight > 0;

  // The architecture spy's latest report (it bubbles "cp:arch" { slug, tech } from its list).
  const spy = useRef<Spy | null>(null);
  useEffect(() => {
    const onArch = (e: Event) => {
      const d = (e as CustomEvent<{ slug?: string | null; tech?: string | null }>).detail;
      if (e.target instanceof Element) spy.current = { el: e.target, slug: d?.slug ?? null, tech: d?.tech ?? null };
    };
    document.addEventListener("cp:arch", onArch);
    const el = document.querySelector<HTMLElement>("[data-arch][data-arch-slug]");
    if (el) spy.current = { el, slug: el.dataset.archSlug || null, tech: el.dataset.archTech || null };
    return () => document.removeEventListener("cp:arch", onArch);
  }, []);

  // The scene window: measured on scroll/resize (one rect read per scroll frame), relative
  // to the canvas. Hidden (phones) or off screen → the free rect instead.
  const gl = useThree((s) => s.gl);
  const win = useRef<Win>({ el: null, l: 0, t: 0, w: 0, h: 0, ok: false });
  useEffect(() => {
    let raf = 0;
    const read = () => {
      raf = 0;
      const w = win.current;
      if (!w.el || !w.el.isConnected) w.el = document.querySelector<HTMLElement>("[data-arch-window]");
      if (!w.el) {
        w.ok = false;
        return;
      }
      const r = w.el.getBoundingClientRect();
      const c = gl.domElement.getBoundingClientRect();
      w.l = r.left - c.left;
      w.t = r.top - c.top;
      w.w = r.width;
      w.h = r.height;
      const vh = c.height || window.innerHeight;
      w.ok = r.width > 160 && r.height > 160 && r.bottom > vh * 0.25 && r.top < vh * 0.75;
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    const ro = new ResizeObserver(schedule);
    ro.observe(document.body);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      ro.disconnect();
    };
  }, [gl]);

  // Labels: one per technology, a name per platform / the infra container / the AI
  // cluster, and each project's title. Rebuilt on theme change (cheap plain DOM).
  const host = useThree((s) => s.gl.domElement.parentElement);
  const labels = useRef<{ layer: LabelLayer; tech: number[]; tier: number[]; title: number[]; version: number; hi: number } | null>(null);
  useEffect(() => {
    if (!host || work.length === 0) return;
    const layer = new LabelLayer(host);
    const tint = [palette.fg, palette.accent, palette.ok, palette.muted, palette.ai];
    const chip = `color-mix(in srgb, ${palette.bg} 80%, transparent)`;
    const tech = rig.vocab.names.map((name, i) => {
      const id = layer.add(name, "", "rounded-full border px-2 py-[3px] font-mono text-[10.5px] leading-none tracking-[0.02em]", RIGHT);
      layer.style(id, { color: palette.fg, background: chip, borderColor: `color-mix(in srgb, ${tint[vocabTier[i]]} 55%, transparent)` });
      return id;
    });
    const tier = TIER_NAME.map((name, k) => {
      const id = layer.add(name, "", "font-mono text-[10px] font-medium uppercase leading-none tracking-[0.18em]", { x: 0, y: 0, dy: 7 });
      layer.style(id, { color: k === 0 ? palette.muted : tint[k], textShadow: `0 0 8px ${palette.bg}, 0 0 3px ${palette.bg}` });
      return id;
    });
    const title = work.map((p) => {
      const id = layer.add(`● ${short(p.title)}`, "", "font-mono text-xs uppercase tracking-[0.16em]", { x: 0, y: -1 });
      layer.style(id, { color: palette.fg, textShadow: `0 0 10px ${palette.bg}, 0 0 4px ${palette.bg}` });
      return id;
    });
    labels.current = { layer, tech, tier, title, version: -1, hi: -1 };
    return () => {
      labels.current = null;
      layer.dispose();
    };
  }, [host, rig, work, palette, vocabTier]);

  const reg = useRef<ArchRegistry>(emptyRegistry());
  const live = useRef({ x: 0, y: 0, scale: 1, active: 0, tech: null as string | null });
  const titleO = useRef<Float32Array>(new Float32Array(0));
  const pt = useMemo(() => [0, 0], []);

  useFrame((state, dt) => {
    const ids = labels.current;
    if (!active || work.length === 0) {
      ids?.layer.hideAll();
      return;
    }
    const r = reg.current;
    const { camera, size } = state;
    const o = live.current;

    // Which project, and which technology to light.
    const s = spy.current;
    const report = s && s.el.isConnected ? s : null;
    let idx = report?.slug ? index.get(report.slug) : undefined;
    if (idx === undefined && focus) idx = index.get(focus);
    if (idx !== undefined) o.active = idx;
    o.tech = report?.tech ?? null;

    // Where: the window, else the free rect (whose centre is the origin).
    const L = rig.L;
    const w = win.current;
    if (w.ok) {
      camera.updateMatrixWorld();
      toWorld(camera, w.l + w.w / 2, w.t + w.h / 2, size.width, size.height, pt);
      o.x = pt[0];
      o.y = pt[1];
      toWorld(camera, w.l, w.t, size.width, size.height, pt);
      const halfW = Math.abs(o.x - pt[0]);
      const halfH = Math.abs(pt[1] - o.y);
      o.scale = Math.min(CAP * 1.15, (halfW * 0.92) / L.hw, (halfH * 0.88) / L.hh);
    } else {
      o.x = 0;
      o.y = 0;
      o.scale = fitFree(camera, size, L.hw, L.hh, CAP, CAP) * 0.94;
    }
    rig.frame(state, dt, { active: o.active, tech: o.tech, weight, pointer, x: o.x, y: o.y, scale: o.scale }, r);

    if (!ids || !r.tilt) return;
    const { layer } = ids;
    if (!layer.begin(weight)) return;
    // After a relayout: label sides and the "+N" counts.
    const Lr = rig.L;
    if (ids.version !== rig.version) {
      ids.version = rig.version;
      for (let i = 0; i < rig.v; i++) if (Lr.on[i]) layer.setAlign(ids.tech[i], Lr.side[i] < 0 ? LEFT : RIGHT);
      const more = [Lr.platforms[0].more, Lr.platforms[1].more, Lr.platforms[2].more, Lr.infra.more, Lr.ai.more];
      TIER_NAME.forEach((name, k) => setText(layer, ids.tier[k], more[k] > 0 ? `${name} · +${more[k]}` : name));
    }
    // The highlighted technology's label turns orange.
    const hi = o.tech ? (rig.vocab.index.get(o.tech) ?? -1) : -1;
    if (hi !== ids.hi) {
      const tint = [palette.fg, palette.accent, palette.ok, palette.muted, palette.ai];
      if (ids.hi >= 0)
        layer.style(ids.tech[ids.hi], { color: palette.fg, borderColor: `color-mix(in srgb, ${tint[vocabTier[ids.hi]]} 55%, transparent)`, fontWeight: "" });
      if (hi >= 0) layer.style(ids.tech[hi], { color: palette.accent, borderColor: palette.accent, fontWeight: "600" });
      ids.hi = hi;
    }
    const { width: W, height: H } = size;
    r.tilt.updateMatrixWorld(true);
    const M = r.tilt.matrixWorld;
    const P = rig.gl.nAttr.aPos.array as Float32Array;
    for (let i = 0; i < rig.v; i++) {
      const a = rig.alpha[i];
      if (a < 0.05 || !Lr.on[i]) layer.hide(ids.tech[i]);
      else layer.place(ids.tech[i], P[i * 3], P[i * 3 + 1], P[i * 3 + 2], M, camera, W, H, (a - 0.05) / 0.95);
    }
    for (let k = 0; k < STACK.length; k++) {
      const p = rig.plat[k];
      if (p.a < 0.05) layer.hide(ids.tier[k]);
      else layer.place(ids.tier[k], -p.w / 2 + 0.1, p.y, p.d / 2, M, camera, W, H, p.a);
    }
    const inf = rig.infra;
    if (inf.a < 0.05) layer.hide(ids.tier[3]);
    else layer.place(ids.tier[3], inf.min[0] + 0.05, inf.min[1], inf.max[2], M, camera, W, H, inf.a);
    if (rig.ai.a < 0.05) layer.hide(ids.tier[4]);
    else layer.place(ids.tier[4], rig.ai.x - 0.2, rig.ai.y + 0.62, 0, M, camera, W, H, rig.ai.a);
    if (titleO.current.length !== work.length) titleO.current = new Float32Array(work.length);
    const tO = titleO.current;
    const k = Math.min(1, dt * 7);
    for (let j = 0; j < work.length; j++) {
      tO[j] += ((j === o.active ? 1 : 0) - tO[j]) * k;
      if (tO[j] < 0.02) layer.hide(ids.title[j]);
      else layer.place(ids.title[j], rig.title[0], rig.title[1], rig.title[2], M, camera, W, H, tO[j]);
    }
  });

  if (work.length === 0) return null;
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
        <mesh geometry={g.platforms} material={g.platformMat} frustumCulled={false} renderOrder={1} />
        <mesh geometry={g.links} material={g.linkMat} frustumCulled={false} renderOrder={2} />
        <mesh geometry={g.nodes} material={g.nodeMat} frustumCulled={false} renderOrder={3} />
      </group>
    </group>
  );
}

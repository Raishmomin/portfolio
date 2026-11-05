"use client";

// The lazy R3F scene (loaded only by cluster-island.tsx via next/dynamic, ssr:false).
// One orthographic <Canvas>, one instancedMesh of rounded pods with a runtime matcap
// (no network assets), demand frameloop: invalidate() only while something moves.
// Decorative only: no text, no interaction in the canvas (tasks/design-spec.md §4).
//
// The mutable simulation lives in a plain class (ClusterEngine) created in an effect;
// React only wires its lifecycle, so nothing re-renders per frame.
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { damp3 } from "maath/easing";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  BoxGeometry,
  CanvasTexture,
  Color,
  DynamicDrawUsage,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshMatcapMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
  type Camera,
  type OrthographicCamera,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { POSTER_PRESETS, VIEW_MARGIN, type Layout } from "./config";
import { buildFormations, CAM_DIR, POD, SCREEN_R, SCREEN_U, STATUS, type Formations, type FormationView } from "./formations";
import { clusterStore, type ClusterState } from "./store";
import type { FormationData, FormationKey } from "./types";

const STAGGER = 0.006; // s per instance index
const SMOOTH = 0.18; // damp3 smoothTime for pods
const CAMERA_SMOOTH = 0.32;
const HOP = 1.1; // s: lifted + Pending, then Running
const HOP_EVERY = 2400; // ms
const SCATTER = 0.7; // s
const CAM_DISTANCE = 80; // orthographic: distance only has to clear every formation

type SceneProps = {
  data: FormationData;
  count: number;
  variant: "sticky" | "band";
  active: boolean;
  onReady: (ready: boolean) => void;
  onFallback: () => void;
};

const now = () => performance.now() / 1000;

function cssColor(style: CSSStyleDeclaration, name: string, out: Color): Color {
  const [h, s, l] = style.getPropertyValue(name).trim().split(/\s+/).map((v) => parseFloat(v));
  if ([h, s, l].some((v) => Number.isNaN(v))) return out;
  return out.setHSL(h / 360, s / 100, l / 100, SRGBColorSpace);
}

/** 256px matcap drawn at runtime: bright top, mid left, darker right (the poster's three tones). */
function makeMatcap(): CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size * 0.4, size * 0.12, 0, size * 0.4, size * 0.12, size * 0.95);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.35, "#f2f2f2");
  g.addColorStop(0.62, "#bdbdbd");
  g.addColorStop(0.85, "#929292");
  g.addColorStop(1, "#7a7a7a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function lookAtView(v: FormationView, out: Vector3): Vector3 {
  return out.set(
    v.cx * SCREEN_R[0] + v.cy * SCREEN_U[0],
    v.cx * SCREEN_R[1] + v.cy * SCREEN_U[1],
    v.cx * SCREEN_R[2] + v.cy * SCREEN_U[2],
  );
}

function fitZoom(v: FormationView, width: number, height: number): number {
  return Math.min(width / (v.w * VIEW_MARGIN), height / (v.h * VIEW_MARGIN));
}

class ClusterEngine {
  readonly group = new Group();
  private readonly formations: Formations;
  private readonly projectIndex: Map<string, number>;
  private readonly groupIndex: Map<string, number>;
  private readonly geometry = new RoundedBoxGeometry(POD, POD, POD, 2, 0.12);
  private readonly matcap = makeMatcap();
  private readonly material = new MeshMatcapMaterial({ matcap: this.matcap });
  private readonly mesh: InstancedMesh;
  private readonly colors: Float32Array;
  private readonly plateGeometry = new BoxGeometry(1, 0.06, 1);
  private readonly plateMaterial = new MeshBasicMaterial();
  private readonly plates: InstancedMesh;
  // Palette, indexed by STATUS; colours are read from CSS variables.
  private readonly palette = [new Color(), new Color(), new Color(), new Color()];
  private readonly plateColor = new Color();
  // Simulation state, allocated once.
  private key: FormationKey;
  private start = -Infinity;
  private scatterUntil = -Infinity;
  private pulseAt = -Infinity;
  private readonly cur: Vector3[];
  private readonly scale: Float32Array;
  private readonly hops: Float64Array;
  private readonly angle: Float32Array;
  private readonly scatter: Float32Array;
  private plateScale: number;
  private readonly look = new Vector3();
  private zoom: number;
  private readonly pointer = new Vector2();
  private readonly parallax = new Vector3();
  private readonly target = new Vector3();
  private readonly matrix = new Matrix4();
  private readonly tint = new Color();

  constructor(
    private readonly data: FormationData,
    private readonly count: number,
    layout: Layout,
    width: number,
    height: number,
  ) {
    this.formations = buildFormations(data, count, { layout });
    this.projectIndex = new Map(data.projects.map((p, i) => [p.slug, i]));
    this.groupIndex = new Map(data.skills.map((s, i) => [s.group, i]));

    this.mesh = new InstancedMesh(this.geometry, this.material, count);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.colors = new Float32Array(count * 3);
    this.mesh.instanceColor = new InstancedBufferAttribute(this.colors, 3).setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.plates = new InstancedMesh(this.plateGeometry, this.plateMaterial, this.formations.hero.plates.length / 4);
    this.plates.frustumCulled = false;
    this.group.add(this.plates, this.mesh);

    // Start settled in the current formation, so the first frame matches the poster.
    this.key = clusterStore.getState().section;
    const f = this.formations[this.key];
    if (this.key === "contact") this.pulseAt = now() + 0.4;
    this.cur = Array.from({ length: count }, (_, i) => new Vector3().fromArray(f.positions, i * 3));
    this.scale = Float32Array.from(f.status, (s) => (s === STATUS.hidden ? 0 : 1));
    this.hops = new Float64Array(count).fill(-Infinity);
    this.plateScale = this.key === "hero" || this.key === "about" ? 1 : 0;
    lookAtView(f.view, this.look);
    this.zoom = fitZoom(f.view, width, height);

    const contact = this.formations.contact.positions;
    this.angle = new Float32Array(count);
    this.scatter = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      this.angle[i] = (Math.atan2(contact[i * 3 + 2], contact[i * 3]) + Math.PI) / (2 * Math.PI);
      const a = Math.random() * Math.PI * 2;
      const r = 3 + Math.random() * 4;
      this.scatter[i * 3] = Math.cos(a) * r;
      this.scatter[i * 3 + 1] = Math.random() * 5;
      this.scatter[i * 3 + 2] = Math.sin(a) * r;
    }
    this.readTheme();
  }

  /** Re-read the theme's CSS variables. Mixed in linear space, so these ratios match the poster's sRGB color-mix(). */
  readTheme() {
    const root = document.documentElement;
    const style = getComputedStyle(root);
    const dark = root.classList.contains("dark");
    const fg = cssColor(style, "--foreground", new Color());
    const card = cssColor(style, "--card", new Color());
    this.palette[STATUS.running].copy(card).lerp(fg, dark ? 0.78 : 0.55);
    this.palette[STATUS.hidden].copy(this.palette[STATUS.running]);
    cssColor(style, "--ok", this.palette[STATUS.ready]);
    cssColor(style, "--primary", this.palette[STATUS.pending]);
    this.plateColor.copy(card).lerp(fg, dark ? 0.07 : 0.09);
    this.plateMaterial.color.copy(this.plateColor);
    const f = this.formations[this.key];
    for (let i = 0; i < this.count; i++) this.palette[f.status[i]].toArray(this.colors, i * 3);
    this.mesh.instanceColor!.needsUpdate = true;
  }

  onStore(s: ClusterState, prev: ClusterState) {
    const t = now();
    if (s.section !== prev.section) {
      this.key = s.section;
      this.start = t;
      this.pulseAt = s.section === "contact" ? t + 1.5 : -Infinity;
    }
    if (s.reschedules !== prev.reschedules) {
      this.scatterUntil = t + SCATTER;
      this.start = t + SCATTER;
    }
  }

  /** Idle reschedule: a few pods hop (Pending, then Running). Returns false while a transition runs. */
  hop(): boolean {
    const t = now();
    const f = this.formations[this.key];
    if (t - this.start < 2.5 || f.visible === 0) return false;
    for (let k = 0; k < 3; k++) this.hops[Math.floor(Math.random() * f.visible)] = t + k * 0.12;
    return true;
  }

  setPointer(x: number, y: number) {
    this.pointer.set(x, y);
  }

  /** Advance one frame. Returns true while anything is still moving. */
  frame(camera: Camera, width: number, height: number, rawDelta: number): boolean {
    const dt = Math.min(rawDelta, 1 / 20);
    const t = now();
    const { focusProject, focusGroup } = clusterStore.getState();
    const f = this.formations[this.key];
    const colors = this.colors;
    const ease = 1 - Math.exp(-dt / 0.12);
    const scattering = t < this.scatterUntil;
    const elapsed = t - this.start;
    let moving = false;

    // Hover/focus on a DOM card raises its column; on a skill group, lifts its cluster.
    let focusTag = -1;
    let lift = 0;
    if (this.key === "work" && focusProject) {
      focusTag = this.projectIndex.get(focusProject) ?? -1;
      lift = 0.3;
    } else if (this.key === "stack" && focusGroup) {
      focusTag = this.groupIndex.get(focusGroup) ?? -1;
      lift = 0.5;
    }
    const pulseClock = t - this.pulseAt;
    const pulsing = this.key === "contact" && pulseClock > -0.5 && pulseClock < 1.6;

    for (let i = 0; i < this.count; i++) {
      const status = f.status[i];
      let x = f.positions[i * 3];
      let y = f.positions[i * 3 + 1];
      let z = f.positions[i * 3 + 2];
      let color = this.palette[status];
      const turn = scattering || elapsed >= i * STAGGER;

      if (scattering) {
        x += this.scatter[i * 3];
        y += this.scatter[i * 3 + 1];
        z += this.scatter[i * 3 + 2];
        color = this.palette[STATUS.pending];
      } else if (!turn) {
        moving = true; // waiting for its turn in the wave
        if (t < this.start) color = this.palette[STATUS.pending];
      }
      if (focusTag >= 0 && f.tag[i] === focusTag) {
        y += lift;
        color = this.palette[STATUS.pending];
      }
      const hopAge = t - this.hops[i];
      if (hopAge >= 0 && hopAge < HOP && status !== STATUS.hidden) {
        moving = true;
        if (hopAge < HOP * 0.45) {
          y += 0.9;
          color = this.palette[STATUS.pending];
        } else color = this.palette[STATUS.ready];
      }

      if (turn) {
        this.target.set(x, y, z);
        if (damp3(this.cur[i], this.target, SMOOTH, dt)) moving = true;
        const targetScale = status === STATUS.hidden ? 0 : 1;
        const ds = targetScale - this.scale[i];
        if (Math.abs(ds) > 0.001) {
          this.scale[i] += ds * ease;
          moving = true;
        } else this.scale[i] = targetScale;
      }

      // Colour: status tint, plus the one-shot green sweep around the "contact" ring.
      this.tint.copy(color);
      if (pulsing) {
        const d = Math.abs(pulseClock - this.angle[i] * 0.9);
        if (d < 0.3) this.tint.lerp(this.palette[STATUS.ready], 1 - d / 0.3);
        moving = true;
      }
      const o = i * 3;
      const dr = this.tint.r - colors[o];
      const dg = this.tint.g - colors[o + 1];
      const db = this.tint.b - colors[o + 2];
      if (Math.abs(dr) + Math.abs(dg) + Math.abs(db) > 0.003) {
        colors[o] += dr * ease;
        colors[o + 1] += dg * ease;
        colors[o + 2] += db * ease;
        moving = true;
      } else this.tint.toArray(colors, o);

      const s = this.scale[i];
      this.matrix.makeScale(s, s, s).setPosition(this.cur[i]);
      this.mesh.setMatrixAt(i, this.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor!.needsUpdate = true;

    // Node plates belong to the hero/about formations only.
    const plateTarget = this.key === "hero" || this.key === "about" ? 1 : 0;
    if (Math.abs(plateTarget - this.plateScale) > 0.001) {
      this.plateScale += (plateTarget - this.plateScale) * ease;
      moving = true;
    } else this.plateScale = plateTarget;
    const hp = this.formations.hero.plates;
    for (let k = 0; k < hp.length / 4; k++) {
      const s = this.plateScale;
      this.matrix.makeScale(hp[k * 4 + 2] * s, s, hp[k * 4 + 3] * s).setPosition(hp[k * 4], -0.04, hp[k * 4 + 1]);
      this.plates.setMatrixAt(k, this.matrix);
    }
    this.plates.instanceMatrix.needsUpdate = true;

    // Camera: fit the formation's screen bounds, ease toward it, ±0.5 parallax on fine pointers.
    if (damp3(this.look, lookAtView(f.view, this.target), CAMERA_SMOOTH, dt)) moving = true;
    const zoom = fitZoom(f.view, width, height);
    if (Math.abs(zoom - this.zoom) > 0.01) {
      this.zoom += (zoom - this.zoom) * (1 - Math.exp(-dt / CAMERA_SMOOTH));
      moving = true;
    } else this.zoom = zoom;
    if (damp3(this.parallax, this.target.set(this.pointer.x * 0.5, this.pointer.y * 0.5, 0), 0.25, dt)) moving = true;
    const { x: px, y: py } = this.parallax;
    camera.position.set(
      this.look.x + CAM_DIR[0] * CAM_DISTANCE + SCREEN_R[0] * px + SCREEN_U[0] * py,
      this.look.y + CAM_DIR[1] * CAM_DISTANCE + SCREEN_R[1] * px + SCREEN_U[1] * py,
      this.look.z + CAM_DIR[2] * CAM_DISTANCE + SCREEN_R[2] * px + SCREEN_U[2] * py,
    );
    camera.lookAt(this.look);
    const ortho = camera as OrthographicCamera;
    ortho.zoom = this.zoom;
    ortho.updateProjectionMatrix();
    return moving;
  }

  dispose() {
    this.group.removeFromParent();
    this.mesh.dispose();
    this.plates.dispose();
    this.geometry.dispose();
    this.material.dispose();
    this.matcap.dispose();
    this.plateGeometry.dispose();
    this.plateMaterial.dispose();
  }
}

function Pods({ data, count, variant, active, onReady }: Omit<SceneProps, "onFallback">) {
  const get = useThree((s) => s.get);
  const invalidate = useThree((s) => s.invalidate);
  const engineRef = useRef<ClusterEngine | null>(null);

  useEffect(() => {
    const { scene, size } = get();
    const engine = new ClusterEngine(data, count, POSTER_PRESETS[variant].layout, size.width, size.height);
    engineRef.current = engine;
    scene.add(engine.group);

    // Colours follow the theme: next-themes flips the html class.
    const mo = new MutationObserver(() => {
      engine.readTheme();
      invalidate();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    const unsubscribe = clusterStore.subscribe((s, prev) => {
      engine.onStore(s, prev);
      invalidate();
    });
    const fine = matchMedia("(pointer: fine)").matches;
    const onMove = (e: PointerEvent) => {
      engine.setPointer((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
      invalidate();
    };
    if (fine) window.addEventListener("pointermove", onMove, { passive: true });

    // Fade in once the first frame with pods is on screen.
    invalidate();
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => onReady(true));
    });
    return () => {
      cancelAnimationFrame(raf);
      mo.disconnect();
      unsubscribe();
      window.removeEventListener("pointermove", onMove);
      engine.dispose();
      engineRef.current = null;
    };
  }, [get, invalidate, data, count, variant, onReady]);

  useEffect(() => {
    if (!active) return;
    invalidate();
    const id = window.setInterval(() => {
      if (engineRef.current?.hop()) invalidate();
    }, HOP_EVERY);
    return () => window.clearInterval(id);
  }, [active, invalidate]);

  useFrame((state, delta) => {
    const engine = engineRef.current;
    if (engine?.frame(state.camera, state.size.width, state.size.height, delta)) state.invalidate();
  });

  return null;
}

export default function Scene({ data, count, variant, active, onReady, onFallback }: SceneProps) {
  const [dpr, setDpr] = useState<number | [number, number]>(variant === "band" ? [1, 1] : [1, 1.5]);
  const declines = useRef(0);

  // First decline drops to dpr 1; a third one falls back to the poster. (drei's own
  // `flipflops` also counts inclines, so a fast device would eventually "fall back".)
  const onDecline = useCallback(() => {
    declines.current += 1;
    if (declines.current === 1) setDpr(1);
    if (declines.current >= 3) onFallback();
  }, [onFallback]);

  // R3F force-loses the context when the canvas unmounts on purpose (3D toggled off):
  // only a loss while mounted means the GPU dropped us. A layout-effect cleanup runs in
  // the commit's mutation phase, before R3F's own teardown.
  const mountedRef = useRef(true);
  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  useEffect(() => () => onReady(false), [onReady]);

  return (
    <Canvas
      orthographic
      camera={{ position: [12, 10, 12], zoom: variant === "band" ? 44 : 56, near: 0.1, far: 400 }}
      dpr={dpr}
      frameloop={active ? "demand" : "never"}
      flat
      gl={{ antialias: false, powerPreference: "low-power", alpha: true }}
      style={{ pointerEvents: "none" }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        gl.domElement.addEventListener("webglcontextlost", () => mountedRef.current && onFallback(), { once: true });
      }}
    >
      <PerformanceMonitor onDecline={onDecline} />
      <Pods data={data} count={count} variant={variant} active={active} onReady={onReady} />
    </Canvas>
  );
}

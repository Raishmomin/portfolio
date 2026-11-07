"use client";

// The lazy WebGL stage (loaded only by stage-island.tsx via next/dynamic, ssr:false):
// one perspective <Canvas> behind the home page, the scroll director that blends the
// section scenes, the shared camera rig, theme palette, DOM focus delegation and the
// frame monitor. Decorative only: no text, no interaction in the canvas.
//
// Conventions for scene authors (scenes/<key>.tsx, default export, SceneProps):
// - Build around the world origin. Without a rig of its own a scene is framed by a
//   camera at (0, 0, DEFAULT_DISTANCE = 14) looking at the origin, vertical FOV 40°.
// - The rig sets camera.position/lookAt every frame BEFORE scenes run (useFrame
//   priority -1). A scene may add an absolute offset afterwards in its own useFrame.
// - `pointer` is a live, smoothed object: read pointer.x / pointer.y inside useFrame.
// - Return null and skip useFrame work while weight === 0.
// - Composition: the rig shifts the camera's view so the origin lands in the centre of the
//   free part of the viewport that the section's data-stage leaves (framing.ts); size the
//   scene with fitFree()/fitScale() so it fills that space and never sits under content.
//   A full-screen dimmer drawn last keeps the scene quiet wherever content sits.
// - Band sections are measured: the band runs down to where the content starts
//   ([data-stage-content], else the first h1/h2), and the camera frames the scene into it.
//   A scene that wants its OWN section's frame, unaffected by the blend with the previous
//   section, reads framing.sceneFrames[key] (free rect + section element) and may pass it
//   through framing.clearRect(), the visibility guard that shrinks a rect until no opaque
//   content covers it (the experience scene lays itself out this way).
import { Canvas, useFrame, useThree, type GLProps } from "@react-three/fiber";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ComponentType } from "react";
import {
  AddEquation,
  CustomBlending,
  OneMinusSrcAlphaFactor,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
  WebGLRenderer,
  ZeroFactor,
  type PerspectiveCamera,
} from "three";
import { SceneStore, type Frame } from "./director";
import { framing, zeroComposition, type Composition } from "./framing";
import { DEFAULT_DISTANCE, FOV, heroCamera, type CameraTarget } from "./hero-layout";
import { readPalette, samePalette } from "./palette";
import { contextOwner, nextIdle } from "./runtime";
import type { NeuralData, SceneKey, ScenePalette, SceneProps } from "./types";
import Hero from "./scenes/hero";
import Stack from "./scenes/stack";
import Experience from "./scenes/experience";
import Ai from "./scenes/ai";
import Work from "./scenes/work";
import Contact from "./scenes/contact";
import Ambient from "./scenes/ambient";

const SCENES: [SceneKey, ComponentType<SceneProps>][] = [
  ["hero", Hero],
  ["stack", Stack],
  ["experience", Experience],
  ["ai", Ai],
  ["work", Work],
  ["contact", Contact],
  ["ambient", Ambient],
];

const MIN_FPS = 30; // a 1 s window below this (back-to-back frames only) is a slow window
const SUSTAINED = 4; // this many slow windows in a row (already at low quality) fall back to the poster
const WARMUP_FRAMES = 90; // first frames compile shaders and build scenes: not measured
const IDLE_MS = 45_000; // no input for this long pauses the render loop until the next input
const INPUTS = ["scroll", "wheel", "pointerdown", "pointermove", "keydown", "touchstart"] as const;
const CAMERA_TAU = 0.45; // s
const POINTER_TAU = 0.18; // s

type StageProps = {
  data: NeuralData;
  active: boolean;
  onReady: (ready: boolean) => void;
  onFallback: () => void;
};

type Quality = SceneProps["quality"];

/** The renderer is created in its own idle period, outside React's commit task. */
const createRenderer: GLProps = async (defaults) => {
  await nextIdle(500);
  return new WebGLRenderer({ ...defaults, antialias: true, powerPreference: "high-performance", alpha: true });
};

/** Per-scene camera targets; scenes without an entry use the default framing. */
function cameraFor(key: SceneKey, aspect: number, progress: number, out: CameraTarget): CameraTarget {
  if (key === "hero") return heroCamera(aspect, progress, out);
  out.px = out.py = out.lx = out.ly = out.lz = 0;
  out.pz = DEFAULT_DISTANCE;
  return out;
}

// The dimmer: a full-screen pass drawn after every scene that scales down what the scenes
// drew (colour and alpha alike) wherever the composition puts content, so text always sits
// over a quiet scene: left / right halves, a uniform veil for "full", everything below the
// band, and on phones everything outside the section opening in view.
const DIM_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;
const DIM_FRAG = /* glsl */ `
uniform vec4 uMask; // left, right, full, band weights
uniform float uPhone;
uniform vec2 uBand;
uniform vec2 uOpen;
varying vec2 vUv;
float inside(float y, vec2 w) {
  return smoothstep(w.x - 0.04, w.x + 0.02, y) * (1.0 - smoothstep(w.y - 0.03, w.y + 0.05, y));
}
void main() {
  float x = vUv.x;
  float y = 1.0 - vUv.y;
  float a = uMask.x * 0.8 * (1.0 - smoothstep(0.34, 0.62, x))
    + uMask.y * 0.8 * smoothstep(0.38, 0.66, x)
    + uMask.z * 0.42
    + uMask.w * 0.82 * (1.0 - inside(y, uBand));
  a = mix(a, 0.68 * (1.0 - inside(y, uOpen)), uPhone);
  gl_FragColor = vec4(0.0, 0.0, 0.0, clamp(a, 0.0, 0.92));
}`;

class Dimmer {
  readonly geometry = new PlaneGeometry(2, 2);
  readonly material = new ShaderMaterial({
    vertexShader: DIM_VERT,
    fragmentShader: DIM_FRAG,
    uniforms: {
      uMask: { value: [0, 0, 0, 0] },
      uPhone: { value: 0 },
      uBand: { value: [0, 0] },
      uOpen: { value: [0, 0] },
    },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: ZeroFactor,
    blendDst: OneMinusSrcAlphaFactor,
    blendEquationAlpha: AddEquation,
    blendSrcAlpha: ZeroFactor,
    blendDstAlpha: OneMinusSrcAlphaFactor,
  });

  update(c: Composition, f: Frame) {
    const u = this.material.uniforms;
    const m = u.uMask.value as number[];
    m[0] = c.mL;
    m[1] = c.mR;
    m[2] = c.mF;
    m[3] = c.mB;
    u.uPhone.value = f.phone ? 1 : 0;
    const b = u.uBand.value as number[];
    b[0] = f.band.top;
    b[1] = f.band.bottom;
    const o = u.uOpen.value as number[];
    o[0] = f.open.top;
    o[1] = f.open.bottom;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

/** Mutable per-frame state (smoothed pointer, camera rig, frame monitor) outside React. */
class Rig {
  /** The live, smoothed pointer every scene receives. */
  readonly pointer = { x: 0, y: 0 };
  private readonly raw = { x: 0, y: 0 };
  private readonly pos = new Vector3();
  private readonly look = new Vector3();
  private readonly target: CameraTarget = { px: 0, py: 0, pz: 0, lx: 0, ly: 0, lz: 0 };
  private readonly sum: CameraTarget = { px: 0, py: 0, pz: 0, lx: 0, ly: 0, lz: 0 };
  private first = true;
  private last = 0;
  private frames = 0;
  private time = 0;
  private seen = 0;
  private slowRun = 0;
  private monitored: SceneKey | null = null;
  private quietUntil = 0;

  setPointer(x: number, y: number) {
    this.raw.x = x;
    this.raw.y = y;
  }

  /** Eased composition (free rect + dimmer weights). */
  readonly comp: Composition = zeroComposition();
  private appliedX = NaN;
  private appliedY = NaN;
  private appliedW = 0;
  private appliedH = 0;

  /** Advances one frame; returns how many 1 s windows in a row ran below MIN_FPS (0 = none / not yet). */
  frame(
    camera: PerspectiveCamera,
    rawDelta: number,
    aspect: number,
    store: SceneStore,
    size: { width: number; height: number },
    dim: Dimmer,
  ): number {
    const dt = Math.min(rawDelta, 0.1);
    const { pointer, raw, sum, pos, look } = this;
    const kp = 1 - Math.exp(-dt / POINTER_TAU);
    pointer.x += (raw.x - pointer.x) * kp;
    pointer.y += (raw.y - pointer.y) * kp;

    // Camera: weight-blended scene targets, eased, plus pointer parallax (none on phones).
    const { frame } = store;
    sum.px = sum.py = sum.pz = sum.lx = sum.ly = sum.lz = 0;
    let total = 0;
    for (const [key] of SCENES) {
      const w = frame.weight[key];
      if (w <= 0) continue;
      const t = cameraFor(key, aspect, frame.progress[key], this.target);
      sum.px += t.px * w;
      sum.py += t.py * w;
      sum.pz += t.pz * w;
      sum.lx += t.lx * w;
      sum.ly += t.ly * w;
      sum.lz += t.lz * w;
      total += w;
    }
    if (total === 0) {
      cameraFor("ambient", aspect, 0, sum);
      total = 1;
    }
    const k = this.first ? 1 : 1 - Math.exp(-dt / CAMERA_TAU);
    pos.x += (sum.px / total - pos.x) * k;
    pos.y += (sum.py / total - pos.y) * k;
    pos.z += (sum.pz / total - pos.z) * k;
    look.x += (sum.lx / total - look.x) * k;
    look.y += (sum.ly / total - look.y) * k;
    look.z += (sum.lz / total - look.z) * k;
    const par = frame.phone ? 0 : 1;
    camera.position.set(pos.x + pointer.x * 0.6 * par, pos.y + pointer.y * 0.35 * par, pos.z);
    camera.lookAt(look);

    // Composition: ease toward the sections' blend, then frame the view onto the free rect.
    const c = this.comp;
    const t = frame.comp;
    if (this.first) Object.assign(c, t);
    else for (const key of Object.keys(c) as (keyof Composition)[]) c[key] += (t[key] - c[key]) * k;
    this.first = false;
    framing.w = Math.max(0.2, c.w);
    framing.h = Math.max(0.2, c.h);
    framing.grow = c.grow;
    framing.phone = frame.phone;
    const ox = Math.round(-c.cx * size.width * 2) / 2;
    const oy = Math.round(-c.cy * size.height * 2) / 2;
    if (ox !== this.appliedX || oy !== this.appliedY || size.width !== this.appliedW || size.height !== this.appliedH) {
      if (ox !== 0 || oy !== 0) camera.setViewOffset(size.width, size.height, ox, oy, size.width, size.height);
      else camera.clearViewOffset();
      camera.zoom = 1;
      camera.updateProjectionMatrix();
      this.appliedX = ox;
      this.appliedY = oy;
      this.appliedW = size.width;
      this.appliedH = size.height;
    }
    dim.update(c, frame);

    // Frame monitor: only back-to-back frames count, after the warm-up, and not in the
    // first second after a scene switch (a scene's first frames upload its buffers).
    const now = performance.now();
    const gap = now - this.last;
    this.last = now;
    if (store.active !== this.monitored) {
      this.monitored = store.active;
      this.quietUntil = now + 1000;
      this.frames = 0;
      this.time = 0;
    }
    if (++this.seen < WARMUP_FRAMES || gap > 100 || now < this.quietUntil) return 0;
    this.frames += 1;
    this.time += gap;
    if (this.time < 1000) return 0;
    const slow = (this.frames * 1000) / this.time < MIN_FPS;
    this.frames = 0;
    this.time = 0;
    // Consecutive slow windows: a passing hitch (a busy scroll, GC, another app) resets.
    this.slowRun = slow ? this.slowRun + 1 : 0;
    return this.slowRun;
  }
}

const SceneSlot = memo(function SceneSlot({
  sceneKey,
  Scene,
  store,
  ...rest
}: Omit<SceneProps, "progress" | "weight"> & { sceneKey: SceneKey; Scene: ComponentType<SceneProps>; store: SceneStore }) {
  const snap = useSyncExternalStore(
    useCallback((l: () => void) => store.subscribe(sceneKey, l), [store, sceneKey]),
    () => store.get(sceneKey),
  );
  // Mount a scene the first time it is needed; afterwards it stays mounted (resources
  // and compiled programs survive) and simply receives weight 0.
  const [seen, setSeen] = useState(snap.weight > 0);
  if (!seen && snap.weight > 0) setSeen(true);
  if (!seen) return null;
  return <Scene {...rest} weight={snap.weight} progress={snap.progress} />;
});

function Director({
  data,
  quality,
  onReady,
  onDecline,
}: {
  data: NeuralData;
  quality: Quality;
  onReady: (ready: boolean) => void;
  onDecline: (slowRun: number) => void;
}) {
  const get = useThree((s) => s.get);
  const [store] = useState(() => {
    const s = new SceneStore();
    s.update();
    return s;
  });
  const [palette, setPalette] = useState<ScenePalette>(readPalette);
  const [focus, setFocus] = useState<string | null>(null);
  const [rig] = useState(() => new Rig());
  const dim = useMemo(() => new Dimmer(), []);
  useEffect(() => () => dim.dispose(), [dim]);

  // Scroll/resize → director (one rAF-throttled measurement per frame at most).
  useEffect(() => {
    let raf = 0;
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        store.update();
      });
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    // Sections that grow or appear later (fonts, images, client islands) shift the rects.
    const ro = new ResizeObserver(schedule);
    ro.observe(document.body);
    schedule();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      ro.disconnect();
    };
  }, [store]);

  // Theme: the theme toggle flips the html class.
  useEffect(() => {
    const mo = new MutationObserver(() => {
      const next = readPalette();
      setPalette((prev) => (samePalette(prev, next) ? prev : next));
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });
    return () => mo.disconnect();
  }, []);

  // Focus delegation: hovering or focusing a [data-focus-id] element highlights it in 3D.
  useEffect(() => {
    const idOf = (t: EventTarget | null) =>
      t instanceof Element ? (t.closest<HTMLElement>("[data-focus-id]")?.dataset.focusId ?? null) : null;
    const enter = (e: Event) => {
      const id = idOf(e.target);
      if (id) setFocus(id);
    };
    const leave = (e: Event) => {
      const from = idOf(e.target);
      const to = idOf((e as FocusEvent | PointerEvent).relatedTarget);
      if (from && from !== to) setFocus((cur) => (cur === from ? to : cur));
    };
    document.addEventListener("pointerover", enter, { passive: true });
    document.addEventListener("pointerout", leave, { passive: true });
    document.addEventListener("focusin", enter);
    document.addEventListener("focusout", leave);
    return () => {
      document.removeEventListener("pointerover", enter);
      document.removeEventListener("pointerout", leave);
      document.removeEventListener("focusin", enter);
      document.removeEventListener("focusout", leave);
    };
  }, []);

  // Exposed for QA: the focused DOM id and the render quality.
  useEffect(() => {
    const stage = document.querySelector("[data-neural-stage]");
    if (focus) stage?.setAttribute("data-focus", focus);
    else stage?.removeAttribute("data-focus");
    stage?.setAttribute("data-quality", quality);
  }, [focus, quality]);

  // Pointer: mouse/pen only; touch leaves it centred.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") rig.setPointer(0, 0);
      else rig.setPointer((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
    };
    const onLeave = () => rig.setPointer(0, 0);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, [rig]);

  // Warm-up: compile the visible programs in an idle period, then report ready after
  // two drawn frames, which starts the poster → canvas crossfade.
  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    (async () => {
      await nextIdle(500);
      if (cancelled) return;
      const { gl, scene, camera } = get();
      gl.debug.checkShaderErrors = process.env.NODE_ENV !== "production";
      await gl.compileAsync(scene, camera).catch(() => undefined);
      if (cancelled) return;
      raf = requestAnimationFrame(() => {
        raf = requestAnimationFrame(() => onReady(true));
      });
    })();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [get, onReady]);

  useFrame((state, delta) => {
    const aspect = state.size.width / Math.max(1, state.size.height);
    const slowRun = rig.frame(state.camera as PerspectiveCamera, delta, aspect, store, state.size, dim);
    if (slowRun) onDecline(slowRun);
  }, -1);

  return (
    <>
      <mesh geometry={dim.geometry} material={dim.material} frustumCulled={false} renderOrder={1e6} />
      {SCENES.map(([key, Scene]) => (
        <SceneSlot
          key={key}
          sceneKey={key}
          Scene={Scene}
          store={store}
          data={data}
          pointer={rig.pointer}
          focus={focus}
          palette={palette}
          quality={quality}
        />
      ))}
    </>
  );
}

let stages = 0;

export default function Stage({ data, active, onReady, onFallback }: StageProps) {
  const [quality, setQuality] = useState<Quality>(() => (matchMedia("(pointer: coarse)").matches ? "low" : "high"));
  const [token] = useState(() => `neural-${++stages}`);
  const [idle, setIdle] = useState(false);
  const declines = useRef(0);

  // A slow second drops to low quality (half the counts, dpr 1); only a device that stays
  // slow at low quality (SUSTAINED seconds in a row) falls back to the poster, so a few
  // passing hitches over a long visit never take the 3D away.
  const onDecline = useCallback(
    (slowRun: number) => {
      declines.current += 1;
      if (declines.current === 1) setQuality("low");
      else if (slowRun >= SUSTAINED) onFallback();
    },
    [onFallback],
  );

  // Idle pause: no input for IDLE_MS stops the render loop; any input resumes it.
  useEffect(() => {
    let last = performance.now();
    let paused = false;
    const onInput = () => {
      last = performance.now();
      if (paused) {
        paused = false;
        setIdle(false);
      }
    };
    const timer = window.setInterval(() => {
      if (!paused && performance.now() - last > IDLE_MS) {
        paused = true;
        setIdle(true);
      }
    }, 2000);
    for (const type of INPUTS) window.addEventListener(type, onInput, { passive: true, capture: true });
    return () => {
      window.clearInterval(timer);
      for (const type of INPUTS) window.removeEventListener(type, onInput, { capture: true });
    };
  }, []);

  // R3F force-loses the context when the canvas unmounts on purpose: only a loss while
  // mounted means the GPU dropped us (layout cleanup runs before R3F's teardown).
  const mountedRef = useRef(true);
  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  useEffect(
    () => () => {
      onReady(false);
      // The context-lost event frees the page's WebGL slot; this covers a teardown without one.
      window.setTimeout(() => {
        if (contextOwner.get() === token) contextOwner.set(null);
      }, 1500);
    },
    [onReady, token],
  );

  const running = active && !idle;
  // Scenes may assume complete data: a hot reload (or a partial payload) never crashes them.
  const safe = useMemo<NeuralData>(
    () => ({
      skills: data?.skills ?? [],
      links: data?.links ?? [],
      experience: data?.experience ?? [],
      ai: data?.ai ?? [],
      work: data?.work ?? [],
    }),
    [data],
  );

  return (
    <Canvas
      camera={{ fov: FOV, position: [0, 0, 15], near: 0.1, far: 200 }}
      dpr={quality === "low" ? 1 : [1, 1.5]}
      frameloop={running ? "always" : "never"}
      flat
      gl={createRenderer}
      style={{ pointerEvents: "none" }}
      data-neural-canvas=""
      data-running={running ? "" : undefined}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        contextOwner.set(token);
        gl.domElement.addEventListener(
          "webglcontextlost",
          () => {
            if (contextOwner.get() === token) contextOwner.set(null);
            if (mountedRef.current) onFallback();
          },
          { once: true },
        );
      }}
    >
      <Director data={safe} quality={quality} onReady={onReady} onDecline={onDecline} />
    </Canvas>
  );
}

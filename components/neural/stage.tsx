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
import { Canvas, useFrame, useThree, type GLProps } from "@react-three/fiber";
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ComponentType } from "react";
import { Vector3, WebGLRenderer, type PerspectiveCamera } from "three";
import { SceneStore } from "./director";
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

const SCENES: [SceneKey, ComponentType<SceneProps>][] = [
  ["hero", Hero],
  ["stack", Stack],
  ["experience", Experience],
  ["ai", Ai],
  ["work", Work],
  ["contact", Contact],
];

const MIN_FPS = 30; // sustained below this (back-to-back frames only) counts as a decline
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

  setPointer(x: number, y: number) {
    this.raw.x = x;
    this.raw.y = y;
  }

  /** Advances one frame; returns true when the last second ran below MIN_FPS. */
  frame(camera: PerspectiveCamera, rawDelta: number, aspect: number, store: SceneStore): boolean {
    const dt = Math.min(rawDelta, 0.1);
    const { pointer, raw, sum, pos, look } = this;
    const kp = 1 - Math.exp(-dt / POINTER_TAU);
    pointer.x += (raw.x - pointer.x) * kp;
    pointer.y += (raw.y - pointer.y) * kp;

    // Camera: weight-blended scene targets, eased, plus pointer parallax.
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
      cameraFor("hero", aspect, 0, sum);
      total = 1;
    }
    const k = this.first ? 1 : 1 - Math.exp(-dt / CAMERA_TAU);
    this.first = false;
    pos.x += (sum.px / total - pos.x) * k;
    pos.y += (sum.py / total - pos.y) * k;
    pos.z += (sum.pz / total - pos.z) * k;
    look.x += (sum.lx / total - look.x) * k;
    look.y += (sum.ly / total - look.y) * k;
    look.z += (sum.lz / total - look.z) * k;
    camera.position.set(pos.x + pointer.x * 0.6, pos.y + pointer.y * 0.35, pos.z);
    camera.lookAt(look);

    // Frame monitor: only back-to-back frames count, after the warm-up.
    const now = performance.now();
    const gap = now - this.last;
    this.last = now;
    if (++this.seen < WARMUP_FRAMES || gap > 100) return false;
    this.frames += 1;
    this.time += gap;
    if (this.time < 1000) return false;
    const slow = (this.frames * 1000) / this.time < MIN_FPS;
    this.frames = 0;
    this.time = 0;
    return slow;
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
  onDecline: () => void;
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
    if (rig.frame(state.camera as PerspectiveCamera, delta, aspect, store)) onDecline();
  }, -1);

  return (
    <>
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

  // First decline: low quality (half the counts, dpr 1); a third falls back to the poster.
  const onDecline = useCallback(() => {
    declines.current += 1;
    if (declines.current === 1) setQuality("low");
    if (declines.current >= 3) onFallback();
  }, [onFallback]);

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
      <Director data={data} quality={quality} onReady={onReady} onDecline={onDecline} />
    </Canvas>
  );
}

"use client";
// Work scene (tasks/neural-spec.md): one floating "app window" card per featured
// project (data.work), on a gently curved wall. Cards fly in from scattered poses as
// `progress` goes 0→0.3, then the wall turns slowly; `focus` (a project slug) lifts
// that card toward the viewer and lights its border. AI projects carry a tiny neural
// glyph, and each card shows one chip per technology the project really uses.
// One instanced draw call; titles are aria-hidden <Html> duplicates of the DOM cards.
import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import type { SceneProps } from "../types";
import { isLight, useAfterFirstFrame } from "./ai/shared";
import { CARD_H, CARD_W, columns, emptyWorkRegistry, WorkRig, type WorkRegistry } from "./work/rig";

/** CSS px per world unit of the card titles (drei Html transform: 400 / distanceFactor). */
const TITLE_DF = 4;

export default function WorkScene({ data, progress, weight, pointer, focus, palette }: SceneProps) {
  const work = data.work;
  const rig = useMemo(() => new WorkRig(work), [work]);
  useEffect(() => () => rig.dispose(), [rig]);
  useEffect(() => rig.setPalette(palette), [rig, palette]);

  const viewport = useThree((s) => s.viewport);
  const n = Math.max(1, work.length);
  const cols = columns(n, viewport.aspect < 0.85);
  const rows = Math.ceil(n / cols);
  useEffect(() => rig.setColumns(cols), [rig, cols]);
  const scale = Math.min(viewport.width / (cols * (CARD_W + 0.32) + 1.6), viewport.height / (rows * (CARD_H + 0.4) + 1.2), 1.15);
  const active = weight > 0;
  const showText = useAfterFirstFrame() && active;
  const light = isLight(palette.bg);

  const reg = useRef<WorkRegistry>(emptyWorkRegistry());
  useFrame((state, dt) => rig.frame(state, dt, { data: work, progress, weight, pointer, focus, scale }, reg.current));

  if (work.length === 0) return null;
  return (
    <group
      ref={(g) => {
        reg.current.root = g;
      }}
      visible={active}
    >
      <instancedMesh
        ref={(m) => {
          reg.current.mesh = m;
        }}
        args={[rig.geometry, rig.material, rig.n]}
        frustumCulled={false}
      />
      {showText
        ? work.map((w, i) => (
            <group
              key={w.slug}
              matrixAutoUpdate={false}
              ref={(g) => {
                reg.current.labels[i] = g;
              }}
            >
              <Html transform distanceFactor={TITLE_DF} position={[0, CARD_H / 2 - 0.52, 0.01]} zIndexRange={[20, 0]} pointerEvents="none">
                <div
                  aria-hidden="true"
                  ref={(el) => {
                    reg.current.titles[i] = el;
                  }}
                  className="pointer-events-none line-clamp-2 select-none text-[15px] font-semibold leading-snug"
                  style={{
                    opacity: 0,
                    width: (CARD_W - 0.32) * (400 / TITLE_DF),
                    height: 44,
                    color: palette.fg,
                    textShadow: light ? "none" : `0 0 18px color-mix(in srgb, ${palette.bg} 80%, transparent)`,
                  }}
                >
                  {w.title}
                </div>
              </Html>
            </group>
          ))
        : null}
    </group>
  );
}

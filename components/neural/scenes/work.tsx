"use client";
// Work scene (tasks/neural-spec.md): one floating "app window" card per featured
// project (data.work), on a gently curved wall. Cards fly in from scattered poses as
// `progress` goes 0→0.3, then the wall turns slowly; `focus` (a project slug) lifts
// that card toward the viewer and lights its border. AI projects carry a tiny neural
// glyph, and each card shows one chip per technology the project really uses.
// One instanced draw call and no text: the DOM cards carry the titles. The wall is
// fitted into the free part of the viewport the section's composition leaves it, so it
// never sits under the content.
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { fitFree } from "../framing";
import type { SceneProps } from "../types";
import { CARD_H, CARD_W, columns, emptyWorkRegistry, WorkRig, type WorkRegistry } from "./work/rig";

export default function WorkScene({ data, progress, weight, pointer, focus, palette }: SceneProps) {
  const work = useMemo(() => data.work ?? [], [data.work]);
  const rig = useMemo(() => new WorkRig(work), [work]);
  useEffect(() => () => rig.dispose(), [rig]);
  useEffect(() => rig.setPalette(palette), [rig, palette]);

  const portrait = useThree((s) => s.size.width / Math.max(1, s.size.height) < 0.85);
  const n = Math.max(1, work.length);
  const cols = columns(n, portrait);
  const rows = Math.ceil(n / cols);
  useEffect(() => rig.setColumns(cols), [rig, cols]);
  const active = weight > 0;

  const reg = useRef<WorkRegistry>(emptyWorkRegistry());
  useFrame((state, dt) => {
    if (!active) return;
    const scale = fitFree(state.camera, state.size, (cols * (CARD_W + 0.32) + 1.6) / 2, (rows * (CARD_H + 0.4) + 1.2) / 2, 1.15, 1.3);
    rig.frame(state, dt, { data: work, progress, weight, pointer, focus, scale }, reg.current);
  });

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
    </group>
  );
}

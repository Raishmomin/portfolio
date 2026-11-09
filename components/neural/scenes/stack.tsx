"use client";
// STACK scene: Raish's real skills as a 3D constellation (tasks/neural-spec.md).
// Each layer (ai, frontend, backend, data, devops) is a glowing plate of skill nodes,
// stacked like the layers of an application; node size ∝ projects using the skill;
// edges = skills shipped together in a project (brighter with more shared projects),
// with signals travelling along them. `focus` (a skill id hovered in the DOM) lights up
// that skill, its edges and neighbours and labels them. Labels are aria-hidden duplicates
// of the section's server-rendered text. Scroll `progress` orbits the stack; `weight`
// fades it in and stacks the plates apart (0 = nothing drawn, no per-frame work).
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import type { SceneProps } from "../types";
import { LabelLayer } from "./stack/labels";
import { layoutStack } from "./stack/layout";
import { StackRig } from "./stack/rig";

export default function StackScene({ data, progress, weight, pointer, focus, palette, quality }: SceneProps) {
  const host = useThree((s) => s.gl.domElement.parentElement);
  const layout = useMemo(() => layoutStack(data), [data]);
  const rig = useMemo(() => new StackRig(layout, quality), [layout, quality]);
  useEffect(() => () => rig.dispose(), [rig]);
  useEffect(() => {
    if (!host) return;
    const layer = new LabelLayer(host);
    rig.attachLabels(layer);
    return () => {
      rig.attachLabels(null);
      layer.dispose();
    };
  }, [rig, host]);
  useEffect(() => rig.setPalette(palette), [rig, palette]);

  useFrame((state, dt) => {
    if (rig.frame(state.clock.elapsedTime, dt, state.camera, state.size, progress, weight, pointer, focus)) state.invalidate();
  });

  return (
    <primitive object={rig.root}>
      <primitive object={rig.spin} />
    </primitive>
  );
}

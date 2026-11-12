"use client";

// Hero scene: the "neural core", a brain made of ~9,000 particle-neurons (half on low
// quality). Glowing neurons trace its folds, synapse arcs run over the cortex and through
// the core, and signals fire along them while cascades of activity sweep the surface.
// After mount the neurons swirl in from a scattered cloud (expo-out, ~1.6 s), then the
// arcs draw on and the signals start. The cursor turns the brain toward it and makes the
// neurons under it glow and fire (touch: a gentle auto-orbit with a wandering focus).
// Scrolling out of the hero streams the neurons toward the next scene. It lives in the
// hero's free side ([data-hero-core]), never under the text column.
// Three draw calls; all motion is in shaders; nothing allocates per frame.
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import type { PerspectiveCamera } from "three";
import { occluders } from "../occluders";
import type { SceneProps } from "../types";
import { HeroCore } from "./hero/core";

export default function Hero(props: SceneProps) {
  const { weight, palette, quality } = props;
  const gl = useThree((s) => s.gl);
  const core = useMemo(() => new HeroCore(quality), [quality]);
  useEffect(() => () => core.dispose(), [core]);
  useEffect(() => core.attach(), [core]);
  // Phones without a [data-hero-core] box fit the brain into the clear part of the
  // section's opening (framing.clearRect reads the occluder registry).
  useEffect(() => {
    occluders.retain();
    return () => occluders.release();
  }, []);
  useEffect(() => core.setPalette(palette), [core, palette]);

  useFrame((s, delta) => {
    if (props.weight === 0) return;
    core.frame(s.camera as PerspectiveCamera, gl.domElement, s.size, gl.domElement.height, delta, props);
  });

  // Stays mounted while hidden: re-attaching a primitive after an unmount is not reliable.
  return <primitive object={core.group} visible={weight > 0} />;
}

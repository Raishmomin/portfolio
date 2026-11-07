"use client";
// CONTACT scene: "where to reach me". A dotted Earth (real land, the real day/night
// terminator right now) with Raish's city lit in green, its availability beacon pulsing
// and its local time beside it; one satellite per contact channel (Email, GitHub,
// LinkedIn, X) on its own orbit. The page drives it: pointing at or focusing a channel
// link brings its satellite round and links it to the city; focusing the form draws the
// route a message takes; every keystroke, a copied email and a sent message fly a
// glowing packet from the page to the city, which lands with a shockwave. Labels are
// aria-hidden duplicates of the section's server-rendered text (contact/rig.ts).
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import type { SceneProps } from "../types";
import { ContactRig, type ContactSignal } from "./contact/rig";
import { LabelLayer } from "./stack/labels";

export default function ContactScene({ data, weight, pointer, focus, palette, quality }: SceneProps) {
  const host = useThree((s) => s.gl.domElement.parentElement);
  const rig = useMemo(() => new ContactRig(data, quality), [data, quality]);
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
  useEffect(() => rig.setFocus(focus), [rig, focus]);
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<ContactSignal>).detail;
      if (d && typeof d.kind === "string") rig.signal(d);
    };
    window.addEventListener("cp:contact", on);
    return () => window.removeEventListener("cp:contact", on);
  }, [rig]);

  useFrame((state, dt) => {
    if (rig.frame(state.clock.elapsedTime, dt, state.camera, state.size, state.gl.getPixelRatio(), weight, pointer)) state.invalidate();
  });

  return <primitive object={rig.root} />;
}

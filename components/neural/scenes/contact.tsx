"use client";
// CONTACT scene: "where to reach me". A dotted Earth (real land, the real day/night
// terminator right now) with Raish's city lit in green, its availability beacon pulsing
// and its local time beside it; one satellite per contact channel (Email, GitHub,
// LinkedIn, X) on its own orbit. The page drives it: pointing at or focusing a channel
// link brings its satellite round and links it to the city; focusing the form draws the
// route a message takes; every keystroke, a copied email and a sent message fly a
// glowing packet from the page to the city, which lands with a shockwave. Its labels are
// drawn in the canvas, behind the content, and duplicate the section's server-rendered
// text (contact/labels.ts).
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import type { SceneProps } from "../types";
import { ContactRig, type ContactSignal } from "./contact/rig";

export default function ContactScene({ data, weight, pointer, focus, palette, quality }: SceneProps) {
  // One rig per page: quality is applied in place (rig.setQuality), so a drop to "low"
  // mid-visit never rebuilds it (no replayed arrival, no lost hover or packet in flight).
  const rig = useMemo(() => new ContactRig(data), [data]);
  useEffect(() => () => rig.dispose(), [rig]);
  useEffect(() => rig.setQuality(quality), [rig, quality]);
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

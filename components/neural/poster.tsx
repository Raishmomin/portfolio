// Server-rendered SVG posters: the hero network behind the home page (what visitors
// without WebGL, or before the canvas fades in, see) and the shared CSS that animates
// signal pulses along their routes. No JS: the pulses are stroke-dashoffset keyframes
// that run only when motion is allowed (the tri-state 3D/motion contract,
// components/header/motion-toggle.tsx): html.js without data-motion="off" under
// prefers-reduced-motion: no-preference, or an explicit html[data-motion="on"].
import type { CSSProperties } from "react";
import { BASE_PITCH, BASE_YAW, FOV, HERO_DISTANCE, HERO_SHIFT, heroLayout, orient } from "./hero-layout";

const RUN = "nw-flow var(--nw-d,3.6s) linear infinite";
const CSS = [
  ":root{--nw-ai:#3F5BD9}.dark{--nw-ai:#7C9CFF}",
  ".nw-e{fill:none;stroke:var(--nw-ai);stroke-opacity:.28}.dark .nw-e{stroke-opacity:.2}",
  ".nw-h{fill:none;stroke:var(--nw-ai);stroke-linecap:round;stroke-opacity:.05}.dark .nw-h{stroke-opacity:.07}",
  ".nw-n{fill:none;stroke-linecap:round}.nw-i{stroke:hsl(var(--foreground))}.nw-a{stroke:var(--nw-ai)}.nw-o{stroke:hsl(var(--primary))}",
  ".nw-p{fill:none;stroke-linecap:round;stroke-dasharray:10 200;stroke-dashoffset:10;opacity:0}",
  ".nw-pa{stroke:var(--nw-ai)}.nw-po{stroke:hsl(var(--primary))}",
  "@keyframes nw-flow{to{stroke-dashoffset:-100}}",
  `@media (prefers-reduced-motion:no-preference){html.js:not([data-motion=off]) .nw-p{opacity:1;animation:${RUN}}}`,
  `html[data-motion=on] .nw-p{opacity:1;animation:${RUN}}`,
  "[data-paused] .nw-p{animation-play-state:paused}",
  `[data-neural-poster]>svg{position:absolute;inset:0;width:100%;height:100%;transform:translateX(${HERO_SHIFT * 50}%) scale(.9)}`,
  "@media (max-aspect-ratio:19/20){[data-neural-poster]>svg{inset:auto;left:50%;top:50%;width:100lvh;height:100vw;transform:translate(-50%,-50%) rotate(90deg) scale(1.3);opacity:.6}}",
].join("");

/** The posters' stylesheet; React hoists it into <head> once per page (href dedupes it). */
export function NeuralSvgStyle() {
  return (
    <style href="neural-svg" precedence="low">
      {CSS}
    </style>
  );
}

const W = 1600;
const H = 900;
const r1 = (v: number) => Math.round(v);

/** Projects the hero layout the way the scene's first frame shows it (camera centred; CSS shifts it). */
function project() {
  const layout = heroLayout();
  const dist = HERO_DISTANCE;
  const unit = H / 2 / (Math.tan(((FOV / 2) * Math.PI) / 180) * dist); // px per world unit at z = 0
  const count = layout.layer.length;
  const pts: { x: number; y: number; s: number }[] = [];
  for (let i = 0; i < count; i++) {
    const [x, y, z] = orient(layout.nodes[i * 3], layout.nodes[i * 3 + 1], layout.nodes[i * 3 + 2], BASE_YAW, BASE_PITCH);
    const s = dist / (dist - z);
    pts.push({ x: r1(W / 2 + x * unit * s), y: r1(H / 2 - y * unit * s), s });
  }
  return { layout, pts };
}

function dots(pts: { x: number; y: number }[], ids: number[]) {
  return ids.map((i) => `M${pts[i].x} ${pts[i].y}h0`).join("");
}

/** Full-viewport hero network poster (aria-hidden by its stage). ≈7 KB of markup. */
export function NeuralPoster() {
  const { layout, pts } = project();
  const { edges, routes, layer, layers } = layout;
  let d = "";
  for (let e = 0; e < edges.length; e += 2) {
    const a = pts[edges[e]];
    const b = pts[edges[e + 1]];
    d += `M${a.x} ${a.y}L${b.x} ${b.y}`;
  }
  const all = pts.map((_, i) => i);
  // Nodes by role (input / hidden / output) and by depth (near ones drawn larger).
  const groups: { cls: string; w: number; ids: number[] }[] = [];
  for (const [cls, test] of [
    ["nw-i", (l: number) => l === 0],
    ["nw-a", (l: number) => l > 0 && l < layers - 1],
    ["nw-o", (l: number) => l === layers - 1],
  ] as const) {
    const ids = all.filter((i) => test(layer[i]));
    groups.push({ cls, w: 9, ids: ids.filter((i) => pts[i].s < 1) }, { cls, w: 12, ids: ids.filter((i) => pts[i].s >= 1) });
  }
  // A dozen signal routes, staggered so a pulse is always in flight.
  const pulses = Array.from({ length: 12 }, (_, r) => {
    const route = Array.from(routes.subarray(r * layers, r * layers + layers));
    return {
      d: route.map((n, i) => `${i ? "L" : "M"}${pts[n].x} ${pts[n].y}`).join(""),
      cls: r % 3 === 2 ? "nw-po" : "nw-pa",
      style: { animationDelay: `${(-r * 0.31).toFixed(2)}s`, "--nw-d": `${(3.2 + (r % 4) * 0.35).toFixed(2)}s` },
    };
  });

  return (
    <div data-neural-poster="" className="absolute inset-0 transition-opacity duration-700">
      <NeuralSvgStyle />
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" fill="none">
        <path className="nw-e" strokeWidth="1" d={d} />
        <path className="nw-h" strokeWidth="34" d={dots(pts, all)} />
        <path className="nw-h" strokeWidth="18" d={dots(pts, all)} />
        {pulses.map((p, i) => (
          <path key={i} className={`nw-p ${p.cls}`} strokeWidth="3" pathLength={100} d={p.d} style={p.style as CSSProperties} />
        ))}
        {groups.map((g) =>
          g.ids.length ? <path key={`${g.cls}${g.w}`} className={`nw-n ${g.cls}`} strokeWidth={g.w} d={dots(pts, g.ids)} /> : null,
        )}
      </svg>
    </div>
  );
}

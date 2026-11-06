// Server-rendered SVG posters: what visitors without WebGL (or before the canvas fades
// in) see behind the page. The hero network on pages that open with the hero scene, the
// ambient field everywhere else (picked in CSS with :has(), no JS), plus the shared CSS
// that animates signal pulses along their routes. No JS: the pulses are
// stroke-dashoffset keyframes that run only when motion is allowed (the tri-state
// 3D/motion contract, components/reveal.tsx): html.js without
// data-motion="off" under prefers-reduced-motion: no-preference, or an explicit
// html[data-motion="on"].
import type { CSSProperties } from "react";
import { BASE_PITCH, BASE_YAW, FOV, HERO_DISTANCE, HERO_YZ, heroLayout, heroStretch, orient } from "./hero-layout";

const RUN = "nw-flow var(--nw-d,3.6s) linear infinite";
const HERO_SECTION = "[data-section=hero]:not([data-scene]),[data-scene=hero]";
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
  ".nw-f{fill:none;stroke:var(--nw-ai);stroke-opacity:.16}.dark .nw-f{stroke-opacity:.12}",
  "[data-neural-poster]>svg{position:absolute;inset:0;width:100%;height:100%}",
  // The hero network spans the width; the headline side stays quiet (like the canvas's dimmer).
  "[data-neural-poster=hero]>svg{-webkit-mask-image:linear-gradient(90deg,rgba(0,0,0,.25) 30%,#000 66%);mask-image:linear-gradient(90deg,rgba(0,0,0,.25) 30%,#000 66%)}",
  "@media (max-aspect-ratio:19/20){[data-neural-poster=hero]>svg{inset:auto;left:50%;top:50%;width:100lvh;height:100vw;transform:translate(-50%,-50%) rotate(90deg) scale(1.3);opacity:.45;-webkit-mask-image:none;mask-image:none}}",
  "[data-neural-poster=ambient]>svg{opacity:.6}",
  // Which poster: the hero network only on pages whose stage opens with the hero scene.
  `[data-neural-poster=ambient]{display:none}main:not(:has(${HERO_SECTION})) [data-neural-poster=ambient]{display:block}main:not(:has(${HERO_SECTION})) [data-neural-poster=hero]{display:none}`,
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

/** The hero section's scroll progress at the top of the page (the viewport centre is ~45% into it). */
const TOP_PROGRESS = 0.45;

/** Projects the hero layout the way the scene's first frame shows it (centred, stretched for a laptop screen). */
function project() {
  const layout = heroLayout();
  // Same pull-back and scroll turn as heroCamera / HeroNet at the top of the page.
  const dist = HERO_DISTANCE + TOP_PROGRESS * 7;
  const yaw = BASE_YAW + TOP_PROGRESS * 0.5;
  const unit = H / 2 / (Math.tan(((FOV / 2) * Math.PI) / 180) * dist); // px per world unit at z = 0
  const sx = heroStretch(1.6);
  const count = layout.layer.length;
  const pts: { x: number; y: number; s: number }[] = [];
  for (let i = 0; i < count; i++) {
    const n = layout.nodes;
    const [x, y, z] = orient(n[i * 3] * sx, n[i * 3 + 1] * HERO_YZ, n[i * 3 + 2] * HERO_YZ, yaw, BASE_PITCH);
    const s = dist / (dist - z);
    pts.push({ x: r1(W / 2 + x * unit * s), y: r1(H / 2 - y * unit * s), s });
  }
  return { layout, pts };
}

function dots(pts: { x: number; y: number }[], ids: number[]) {
  return ids.map((i) => `M${pts[i].x} ${pts[i].y}h0`).join("");
}

/** Both posters; CSS shows the one that matches the page (aria-hidden by its stage). */
export function NeuralPoster() {
  return (
    <>
      <HeroPoster />
      <AmbientPoster />
    </>
  );
}

/** mulberry32 (deterministic: the server always draws the same field). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The ambient field as an SVG: drifting-dot neurons, faint synapses, a few running signals. ≈4 KB. */
function AmbientPoster() {
  const rand = rng(23);
  const pts = Array.from({ length: 96 }, () => ({ x: r1(rand() * W), y: r1(rand() * H), z: rand() }));
  let d = "";
  const links: [number, number][] = [];
  pts.forEach((p, i) => {
    const near = pts
      .map((q, j) => ({ j, d: (q.x - p.x) ** 2 + (q.y - p.y) ** 2 }))
      .filter((o) => o.j !== i && o.d < 175 * 175)
      .sort((a, b) => a.d - b.d)
      .slice(0, 2);
    for (const o of near) {
      if (links.some(([a, b]) => (a === o.j && b === i) || (a === i && b === o.j))) continue;
      links.push([i, o.j]);
      d += `M${p.x} ${p.y}L${pts[o.j].x} ${pts[o.j].y}`;
    }
  });
  const near = pts.map((_, i) => i).filter((i) => pts[i].z >= 0.6);
  const far = pts.map((_, i) => i).filter((i) => pts[i].z < 0.6);
  const pulses = links.filter((_, k) => k % 9 === 4).slice(0, 10);
  return (
    <div data-neural-poster="ambient" className="absolute inset-0 transition-opacity duration-700">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" fill="none">
        <path className="nw-f" strokeWidth="1" d={d} />
        <path className="nw-h" strokeWidth="16" d={dots(pts, near)} />
        {pulses.map(([a, b], i) => (
          <path
            key={i}
            className={`nw-p ${i % 4 === 3 ? "nw-po" : "nw-pa"}`}
            strokeWidth="2"
            pathLength={100}
            d={`M${pts[a].x} ${pts[a].y}L${pts[b].x} ${pts[b].y}`}
            style={{ animationDelay: `${(-i * 0.7).toFixed(1)}s`, "--nw-d": `${(4.2 + (i % 3) * 0.6).toFixed(1)}s` } as CSSProperties}
          />
        ))}
        <path className="nw-n nw-a" strokeOpacity=".55" strokeWidth="4" d={dots(pts, far)} />
        <path className="nw-n nw-a" strokeOpacity=".8" strokeWidth="6" d={dots(pts, near)} />
      </svg>
    </div>
  );
}

/** Full-viewport hero network poster. ≈7 KB of markup. */
function HeroPoster() {
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
    <div data-neural-poster="hero" className="absolute inset-0 transition-opacity duration-700">
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

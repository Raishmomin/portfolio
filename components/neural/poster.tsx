// Server-rendered SVG posters: what visitors without WebGL (or before the canvas fades
// in) see behind the page. The hero network on pages that open with the hero scene, the
// ambient field everywhere else (picked in CSS with :has(), no JS), plus the shared CSS
// that animates signal pulses along their routes. No JS: the pulses are
// stroke-dashoffset keyframes that run only when motion is allowed (the tri-state
// 3D/motion contract, components/reveal.tsx): html.js without
// data-motion="off" under prefers-reduced-motion: no-preference, or an explicit
// html[data-motion="on"].
import type { CSSProperties } from "react";
import { BASE_PITCH, BASE_YAW, brainLayout, COUNTS, KIND, orient, VIEW_HALF } from "./hero-layout";

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
  // The hero brain fills the same box as the canvas's core ([data-hero-core] in the home
  // hero): the free right side on desktop, a band above the text on phones.
  "[data-neural-poster=hero]>svg{inset:auto;left:1rem;right:1rem;top:calc(4rem + 1px + 1rem);width:auto;height:calc(36svh - 1.5rem)}",
  "@media (min-width:1024px){[data-neural-poster=hero]>svg{left:calc(max(0px,(100% - 1280px)/2) + 47rem);top:calc(4rem + 1px + 1.5rem);height:calc(100svh - 4rem - 1px - 9.5rem)}}",
  ".nw-b{transform-box:view-box;transform-origin:50% 50%}",
  "@keyframes nw-breathe{50%{transform:scale(1.025) rotate(-1deg)}}",
  `@media (prefers-reduced-motion:no-preference){html.js:not([data-motion=off]) .nw-b{animation:nw-breathe 9s ease-in-out infinite}}`,
  "html[data-motion=on] .nw-b{animation:nw-breathe 9s ease-in-out infinite}",
  "[data-paused] .nw-b{animation-play-state:paused}",
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

/** Local brain units → poster units (the SVG is a 1:100 orthographic view of the resting pose). */
const U = 100;

/** Dots as one path in nearest-neighbour order with relative moves: short deltas, small markup. */
function nearDots(pts: { x: number; y: number }[], ids: number[]) {
  if (!ids.length) return "";
  const left = new Set(ids);
  let cur = ids[0];
  left.delete(cur);
  let d = `M${pts[cur].x} ${pts[cur].y}h0`;
  while (left.size) {
    let best = -1;
    let bd = Infinity;
    for (const j of left) {
      const dd = (pts[j].x - pts[cur].x) ** 2 + (pts[j].y - pts[cur].y) ** 2;
      if (dd < bd) {
        bd = dd;
        best = j;
      }
    }
    const dx = pts[best].x - pts[cur].x;
    const dy = pts[best].y - pts[cur].y;
    d += `m${dx}${dy < 0 ? dy : ` ${dy}`}h0`;
    left.delete(best);
    cur = best;
  }
  return d;
}

/** The hero's neural core as an SVG: the brain's folds and hub neurons, a few synapse arcs and running signals. ≈8 KB, CSS-animated. */
function HeroPoster() {
  const L = brainLayout(COUNTS.poster);
  const n = L.kind.length;
  const pts = Array.from({ length: n }, (_, i) => {
    const [x, y, z] = orient(L.pos[i * 3], L.pos[i * 3 + 1], L.pos[i * 3 + 2], BASE_YAW, BASE_PITCH);
    return { x: r1(x * U), y: r1(-y * U), z };
  });
  const proj = (o: number) => {
    const [x, y] = orient(L.arcs[o], L.arcs[o + 1], L.arcs[o + 2], BASE_YAW, BASE_PITCH);
    return `${r1(x * U)} ${r1(-y * U)}`;
  };
  const arc = (a: number) => `M${proj(a * 9)}Q${proj(a * 9 + 3)} ${proj(a * 9 + 6)}`;
  const ids = (test: (i: number) => boolean) => pts.map((_, i) => i).filter(test);
  const front = (i: number) => pts[i].z >= 0;
  let short = "";
  const long: string[] = [];
  for (let a = 0; a < L.arcKind.length; a++) {
    if (L.arcKind[a]) long.push(arc(a));
    else if (a % 2 === 0) short += arc(a);
  }
  const hw = r1(VIEW_HALF.w * U) + 6;
  const hh = r1(VIEW_HALF.h * U) + 6;
  return (
    <div data-neural-poster="hero" className="absolute inset-0 transition-opacity duration-700">
      <NeuralSvgStyle />
      <svg viewBox={`${-hw} ${-hh} ${hw * 2} ${hh * 2}`} fill="none">
        <defs>
          <radialGradient id="nw-aura">
            <stop offset="0" stopColor="var(--nw-ai)" stopOpacity=".2" />
            <stop offset="1" stopColor="var(--nw-ai)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle r={hw} fill="url(#nw-aura)" />
        <g className="nw-b">
          <path className="nw-e" strokeWidth=".5" d={short} />
          {long.map((d, i) => (
            <path key={`l${i}`} className="nw-e" strokeWidth=".4" d={d} />
          ))}
          <path className="nw-n nw-a" strokeOpacity=".4" strokeWidth="1.2" d={nearDots(pts, ids((i) => L.kind[i] === KIND.fold && !front(i)))} />
          <path className="nw-n nw-a" strokeOpacity=".9" strokeWidth="1.5" d={nearDots(pts, ids((i) => L.kind[i] === KIND.fold && front(i)))} />
          <path className="nw-h" strokeWidth="7" d={nearDots(pts, ids((i) => L.kind[i] === KIND.hub))} />
          {long.slice(0, 9).map((d, i) => (
            <path
              key={`p${i}`}
              className={`nw-p ${i % 3 === 1 ? "nw-po" : "nw-pa"}`}
              strokeWidth="1.6"
              pathLength={100}
              d={d}
              style={{ animationDelay: `${(-i * 0.43).toFixed(2)}s`, "--nw-d": `${(2.8 + (i % 4) * 0.4).toFixed(1)}s` } as CSSProperties}
            />
          ))}
          <path className="nw-n nw-i" strokeOpacity=".85" strokeWidth="2.4" d={nearDots(pts, ids((i) => L.kind[i] === KIND.hub))} />
        </g>
      </svg>
    </div>
  );
}

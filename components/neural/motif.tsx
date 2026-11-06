// Compact animated neural-network SVG for subpage headers. Server-only, no JS: the
// signal pulses are CSS keyframes gated by the same motion contract as the poster.
import type { CSSProperties } from "react";
import { NeuralSvgStyle } from "./poster";

const COLS = [
  { x: 24, ys: [30, 60, 90] },
  { x: 88, ys: [18, 46, 74, 102] },
  { x: 152, ys: [18, 46, 74, 102] },
  { x: 216, ys: [42, 78] },
];
const ROUTES = [
  [0, 1, 2, 0],
  [2, 3, 1, 1],
  [1, 0, 3, 0],
  [1, 2, 2, 1],
];

const pt = (c: number, n: number) => `${COLS[c].x} ${COLS[c].ys[n]}`;

export function NeuralMotif({ className }: { className?: string }) {
  let edges = "";
  for (let c = 0; c < COLS.length - 1; c++)
    for (let a = 0; a < COLS[c].ys.length; a++)
      for (let b = 0; b < COLS[c + 1].ys.length; b++) edges += `M${pt(c, a)}L${pt(c + 1, b)}`;
  const nodes = (c: number) => COLS[c].ys.map((_, n) => `M${pt(c, n)}h0`).join("");
  return (
    <>
      <NeuralSvgStyle />
      <svg aria-hidden="true" viewBox="0 0 240 120" className={className} fill="none">
        <path className="nw-e" strokeWidth="1" d={edges} />
        <path className="nw-h" strokeWidth="18" d={[0, 1, 2, 3].map(nodes).join("")} />
        {ROUTES.map((r, i) => (
          <path
            key={i}
            className={`nw-p ${i === 3 ? "nw-po" : "nw-pa"}`}
            strokeWidth="2.5"
            pathLength={100}
            d={r.map((n, c) => `${c ? "L" : "M"}${pt(c, n)}`).join("")}
            style={{ animationDelay: `${-i * 0.8}s`, "--nw-d": "3.2s" } as CSSProperties}
          />
        ))}
        <path className="nw-n nw-i" strokeWidth="7" d={nodes(0)} />
        <path className="nw-n nw-a" strokeWidth="7" d={nodes(1) + nodes(2)} />
        <path className="nw-n nw-o" strokeWidth="8" d={nodes(3)} />
      </svg>
    </>
  );
}

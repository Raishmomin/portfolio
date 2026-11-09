import { ImageResponse } from "next/og";
import { SITE, SITE_URL } from "@/lib/config";
import { experienceLabel } from "@/lib/profile";

export const alt = `${SITE.name} — Portfolio`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// The card prints the derived years figure, so it is regenerated like the home
// page (ISR, daily) instead of being fixed at build time.
export const revalidate = 86400;

// A small neural network (4 layers) as the card's visual, drawn with plain SVG.
const LAYERS = [3, 5, 5, 2];
const NODES: [number, number][] = LAYERS.flatMap((n, l) =>
  Array.from({ length: n }, (_, i) => [30 + l * 106.7, 190 + (i - (n - 1) / 2) * 68] as [number, number]),
);
const EDGES: [[number, number], [number, number]][] = [];
LAYERS.reduce((start, n, l) => {
  const next = start + n;
  if (l < LAYERS.length - 1)
    for (let i = start; i < next; i++) for (let j = next; j < next + LAYERS[l + 1]; j++) EDGES.push([NODES[i], NODES[j]]);
  return next;
}, 0);

export default async function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0E0F11",
          color: "#ECE7DC",
          display: "flex",
          padding: "72px 80px",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 64,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 22, color: "#8E9097", textTransform: "uppercase", letterSpacing: "0.18em" }}>
            <div style={{ width: 12, height: 12, borderRadius: 999, background: "#3BD68F" }} />
            Portfolio · {new URL(SITE_URL).host}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 112, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.04em" }}>{SITE.name}</div>
            <div style={{ marginTop: 22, fontSize: 36, color: "#8E9097", letterSpacing: "-0.01em" }}>{SITE.jobTitle}</div>
          </div>
          <div style={{ display: "flex", fontSize: 24, color: "#8E9097" }}>
            <span style={{ color: "#FF5B1F" }}>{experienceLabel()} years</span>
            <span>&nbsp;· Next.js · Node · AI products · DevOps</span>
          </div>
        </div>
        <svg width="380" height="380" viewBox="0 0 380 380" style={{ flexShrink: 0 }}>
          {EDGES.map(([a, b], i) => (
            <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={i % 7 === 0 ? "#FF5B1F" : "#7C9CFF"} strokeOpacity={i % 7 === 0 ? 0.8 : 0.28} strokeWidth={i % 7 === 0 ? 2 : 1.2} />
          ))}
          {NODES.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={x > 330 ? 9 : 6} fill={x > 330 ? "#FF5B1F" : "#ECE7DC"} />
          ))}
        </svg>
      </div>
    ),
    { ...size }
  );
}

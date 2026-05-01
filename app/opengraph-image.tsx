import { ImageResponse } from "next/og";
import { SITE } from "@/lib/config";

export const runtime = "edge";
export const alt = `${SITE.name} — Portfolio`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0F0F11",
          color: "#F5F5F5",
          display: "flex",
          flexDirection: "column",
          padding: "80px",
          justifyContent: "space-between",
          fontFamily: "Inter, sans-serif",
          letterSpacing: "-0.04em",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 22,
            color: "#A1A1AA",
            textTransform: "uppercase",
            letterSpacing: "0.2em",
          }}
        >
          <div style={{ width: 40, height: 1, background: "#A1A1AA" }} />
          Portfolio
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 140, fontWeight: 700, lineHeight: 1 }}>
            {SITE.name}
          </div>
          <div
            style={{
              marginTop: 24,
              fontSize: 36,
              color: "#A1A1AA",
              fontWeight: 400,
            }}
          >
            {SITE.jobTitle}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 22,
            color: "#A1A1AA",
          }}
        >
          <span>raish-portfolio.vercel.app</span>
          <span>4+ years · React · Node · DevOps</span>
        </div>
      </div>
    ),
    { ...size }
  );
}

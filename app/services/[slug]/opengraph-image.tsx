import { ImageResponse } from "next/og";
import { SITE } from "@/lib/config";
import { SERVICES } from "@/lib/services";

export const runtime = "nodejs";
export const alt = "Service — Raish Momin";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OG({ params }: { params: { slug: string } }) {
  const config = SERVICES[params.slug];
  const h1 = config?.h1 || "Services";
  const tagline = config?.tagline || "";

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
          Freelance service
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 96, fontWeight: 700, lineHeight: 1.05 }}>{h1}</div>
          <div
            style={{
              marginTop: 32,
              fontSize: 32,
              color: "#A1A1AA",
              fontWeight: 400,
              maxWidth: "900px",
              lineHeight: 1.3,
            }}
          >
            {tagline}
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
          <span>{SITE.name}</span>
          <span>Remote · Worldwide · Async-first</span>
        </div>
      </div>
    ),
    { ...size }
  );
}

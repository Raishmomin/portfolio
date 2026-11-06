import { ImageResponse } from "next/og";
import { SITE, SITE_URL } from "@/lib/config";
import { experienceLabel } from "@/lib/profile";
import { PORTRAIT_DATA_URL } from "@/lib/portrait-data";

export const alt = `${SITE.name} — Portfolio`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// The card prints the derived years figure, so it is regenerated like the home
// page (ISR, daily) instead of being fixed at build time.
export const revalidate = 86400;

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
        <img
          src={PORTRAIT_DATA_URL}
          alt=""
          width={400}
          height={400}
          style={{ width: 400, height: 400, borderRadius: 28, border: "2px solid #26292F", objectFit: "cover" }}
        />
      </div>
    ),
    { ...size }
  );
}

import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0F0F11",
          color: "#FAFAFA",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 110,
          fontWeight: 700,
          letterSpacing: "-0.05em",
          fontFamily: "Inter, sans-serif",
          borderRadius: 36,
        }}
      >
        R
      </div>
    ),
    { ...size }
  );
}

import { ImageResponse } from "next/og";

// PNG app icons for the web manifest (same mark as app/apple-icon.tsx).
// Only the listed sizes exist; both are prerendered at build time.
const SIZES = ["192", "512"] as const;

export const dynamicParams = false;

export function generateStaticParams() {
  return SIZES.map((size) => ({ size }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ size: string }> }
) {
  const px = Number((await params).size);
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
          fontSize: Math.round(px * 0.61),
          fontWeight: 700,
          letterSpacing: "-0.05em",
          fontFamily: "Inter, sans-serif",
          borderRadius: Math.round(px * 0.2),
        }}
      >
        R
      </div>
    ),
    { width: px, height: px }
  );
}

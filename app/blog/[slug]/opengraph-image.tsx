import { ImageResponse } from "next/og";
import clientPromise from "@/lib/mongodb";
import { SITE } from "@/lib/config";

export const runtime = "nodejs";
export const alt = "Blog post — Raish Momin";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function getPostMeta(slug: string): Promise<{
  title: string;
  tags: string[];
  publishedAt: string;
} | null> {
  try {
    const client = await clientPromise;
    const db = client.db("Portfolio");
    const post = await db
      .collection("blogs")
      .findOne({ slug }, { projection: { title: 1, tags: 1, publishedAt: 1 } });
    if (!post) return null;
    return {
      title: String(post.title || ""),
      tags: (post.tags as string[]) || [],
      publishedAt: new Date(post.publishedAt as Date).toISOString(),
    };
  } catch {
    return null;
  }
}

export default async function OG({ params }: { params: { slug: string } }) {
  const meta = await getPostMeta(params.slug);
  const title = meta?.title || "Blog post";
  const tag = meta?.tags?.[0] || "Engineering";
  const date = meta?.publishedAt
    ? new Date(meta.publishedAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

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
          {tag}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: title.length > 70 ? 60 : title.length > 40 ? 76 : 92,
            fontWeight: 700,
            lineHeight: 1.05,
            maxWidth: "100%",
          }}
        >
          {title}
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
          <span>{SITE.name} — Blog</span>
          <span>{date}</span>
        </div>
      </div>
    ),
    { ...size }
  );
}

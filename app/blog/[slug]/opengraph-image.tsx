import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { unstable_cache } from "next/cache";
import clientPromise from "@/lib/mongodb";
import { SITE } from "@/lib/config";
import { TAGS } from "@/lib/cache-tags";
import { LISTED_POSTS, postTags, postTitle } from "@/lib/blog";

export const runtime = "nodejs";
export const alt = "Blog post — Raish Momin";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// Built with the posts and revalidated like them, instead of a DB read and a
// Satori render on every crawler or social-scraper request.
export const revalidate = 3600;

// Same set as the post page's generateStaticParams (redirected slugs are 301s).
export async function generateStaticParams() {
  try {
    const client = await clientPromise;
    const posts = await client
      .db("Portfolio")
      .collection("blogs")
      .find(LISTED_POSTS, { projection: { slug: 1 } })
      .toArray();
    return posts.map((p) => ({ slug: p.slug as string }));
  } catch {
    return [];
  }
}

type PostMeta = { title: string; tags: string[]; publishedAt: string };

/**
 * null when there is no such (published) post. DB errors throw instead of falling
 * back to a generic card, so a failed revalidation keeps serving the last good image.
 */
function getPostMeta(slug: string): Promise<PostMeta | null> {
  return unstable_cache(
    async (): Promise<PostMeta | null> => {
      const client = await clientPromise;
      const post = await client
        .db("Portfolio")
        .collection("blogs")
        .findOne(
          { slug, published: { $ne: false } },
          { projection: { title: 1, tags: 1, publishedAt: 1 } }
        );
      if (!post) return null;
      return {
        title: postTitle(String(post.title || "")),
        tags: postTags(post.tags as string[] | undefined),
        publishedAt: new Date(post.publishedAt as Date).toISOString(),
      };
    },
    ["blog-og-meta", slug],
    { tags: [TAGS.blogs, TAGS.blog(slug)], revalidate: 3600 }
  )();
}

export default async function OG({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const meta = await getPostMeta(slug);
  // Unknown slugs 404 like the page does.
  if (!meta) notFound();
  const title = meta.title || "Blog post";
  const tag = meta.tags[0] || "Engineering";
  const date = meta.publishedAt
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

import { unstable_cache } from "next/cache";
import clientPromise from "@/lib/mongodb";
import { SITE, SITE_URL } from "@/lib/config";
import { TAGS } from "@/lib/cache-tags";
import type { BlogPostSummary } from "@/lib/blog-types";
import { LISTED_POSTS, POST_SUMMARY_PROJECTION, plainExcerpt, postTitle } from "@/lib/blog";

export const revalidate = 3600;

// DB errors throw (never cached), so a failed ISR revalidation keeps the last good output.
const getFeedPosts = unstable_cache(
  async (): Promise<BlogPostSummary[]> => {
    const client = await clientPromise;
    const db = client.db("Portfolio");
    const posts = await db
      .collection("blogs")
      .find(LISTED_POSTS, { projection: POST_SUMMARY_PROJECTION })
      .sort({ publishedAt: -1 })
      .limit(50)
      .toArray();
    return JSON.parse(JSON.stringify(posts));
  },
  ["rss-feed-posts"],
  { tags: [TAGS.blogs], revalidate: 3600 }
);

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toRFC822(date: string | Date): string {
  return new Date(date).toUTCString();
}

export async function GET() {
  const posts = await getFeedPosts();
  const now = new Date().toUTCString();
  const feedUrl = `${SITE_URL}/feed.xml`;

  const items = posts
    .map((p) => {
      const url = `${SITE_URL}/blog/${p.slug}`;
      const pubDate = toRFC822(p.publishedAt);
      const categories = (p.tags || [])
        .map((t) => `      <category>${escapeXml(t)}</category>`)
        .join("\n");
      return `    <item>
      <title>${escapeXml(postTitle(p.title))}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <description><![CDATA[${plainExcerpt(p.excerpt).replace(/]]>/g, "]]]]><![CDATA[>")}]]></description>
${categories}
      <dc:creator><![CDATA[${SITE.name}]]></dc:creator>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${escapeXml(SITE.name)} — Blog</title>
    <link>${SITE_URL}/blog</link>
    <atom:link href="${feedUrl}" rel="self" type="application/rss+xml"/>
    <description>${escapeXml(SITE.description)}</description>
    <language>en-US</language>
    <lastBuildDate>${now}</lastBuildDate>
    <managingEditor>${escapeXml(SITE.email)} (${escapeXml(SITE.name)})</managingEditor>
    <webMaster>${escapeXml(SITE.email)} (${escapeXml(SITE.name)})</webMaster>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}

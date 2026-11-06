// The newest listed posts for the home "Writing" section. Same listing rules as the
// blog index (LISTED_POSTS: published, never a consolidated/redirected slug).
// DB errors throw (never cached), so a failed ISR revalidation keeps the last good page.
import { unstable_cache } from "next/cache";
import clientPromise from "@/lib/mongodb";
import { TAGS } from "@/lib/cache-tags";
import { LISTED_POSTS, postTitle } from "@/lib/blog";

export type PostRow = { title: string; slug: string; publishedAt: string; readTime: number | null };

export const getLatestPosts = unstable_cache(
  async (limit: number): Promise<PostRow[]> => {
    const client = await clientPromise;
    const docs = await client
      .db("Portfolio")
      .collection("blogs")
      .find(LISTED_POSTS, { projection: { title: 1, slug: 1, publishedAt: 1, readTime: 1 } })
      .sort({ publishedAt: -1 })
      .limit(limit)
      .toArray();
    return docs.map((d) => ({
      title: postTitle(String(d.title ?? "")),
      slug: String(d.slug ?? ""),
      publishedAt: new Date(d.publishedAt as string | Date).toISOString(),
      readTime: Number(d.readTime) || null,
    }));
  },
  ["home-latest-posts"],
  { tags: [TAGS.blogs], revalidate: 3600 }
);

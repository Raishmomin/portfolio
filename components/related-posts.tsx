import Link from "next/link";
import { unstable_cache } from "next/cache";
import clientPromise from "@/lib/mongodb";
import { TAGS } from "@/lib/cache-tags";
import { LISTED_POSTS, plainExcerpt, postTitle } from "@/lib/blog";
import { reveal, split } from "./pages/motion";

type RelatedPost = { title: string; slug: string; excerpt: string };

// DB errors throw (never cached), so a failed ISR revalidation keeps the last good output.
const getRelated = unstable_cache(
  async (currentSlug: string, tags: string[]): Promise<RelatedPost[]> => {
    if (!tags || tags.length === 0) return [];
    const client = await clientPromise;
    const db = client.db("Portfolio");
    const posts = await db
      .collection("blogs")
      .find(
        { $and: [LISTED_POSTS, { slug: { $ne: currentSlug }, tags: { $in: tags } }] },
        { projection: { title: 1, slug: 1, excerpt: 1 } }
      )
      .sort({ publishedAt: -1 })
      .limit(3)
      .toArray();
    return JSON.parse(JSON.stringify(posts));
  },
  ["related-posts"],
  { tags: [TAGS.blogs], revalidate: 3600 }
);

export async function RelatedPosts({
  currentSlug,
  tags,
}: {
  currentSlug: string;
  tags: string[];
}) {
  const posts = await getRelated(currentSlug, tags);
  if (posts.length === 0) return null;

  return (
    <section className="mt-16" aria-labelledby="related-posts">
      <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">keep reading</p>
      <h2 {...split} id="related-posts" className="mt-3 text-2xl font-semibold tracking-[-0.02em] text-foreground">
        Related reading
      </h2>
      <ul className="mt-6 border-b border-border">
        {posts.map((p, i) => (
          <li key={p.slug} className="border-t border-border" {...reveal(i)}>
            <Link
              href={`/blog/${p.slug}`}
              className="group block py-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <h3 className="text-base font-semibold leading-snug tracking-tight text-foreground transition-colors duration-150 group-hover:text-primary md:text-lg">
                {postTitle(p.title)}
              </h3>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{plainExcerpt(p.excerpt)}</p>
              <span className="mt-3 inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.14em] text-foreground">
                Read post
                <span aria-hidden="true" className="inline-block text-muted-foreground transition-[transform,color] duration-150 group-hover:translate-x-0.5 group-hover:text-primary">
                  →
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { unstable_cache } from "next/cache";
import clientPromise from "@/lib/mongodb";
import { TAGS } from "@/lib/cache-tags";

type RelatedPost = { title: string; slug: string; excerpt: string };

const getRelated = unstable_cache(
  async (currentSlug: string, tags: string[]): Promise<RelatedPost[]> => {
    if (!tags || tags.length === 0) return [];
    try {
      const client = await clientPromise;
      const db = client.db("Portfolio");
      const posts = await db
        .collection("blogs")
        .find(
          {
            published: { $ne: false },
            slug: { $ne: currentSlug },
            tags: { $in: tags },
          },
          { projection: { title: 1, slug: 1, excerpt: 1 } }
        )
        .sort({ publishedAt: -1 })
        .limit(3)
        .toArray();
      return JSON.parse(JSON.stringify(posts));
    } catch {
      return [];
    }
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
    <section className="mt-16 pt-12 border-t border-border" aria-label="Related posts">
      <h2 className="text-xl md:text-2xl font-semibold tracking-tight text-foreground mb-8">
        Related reading
      </h2>
      <ul className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {posts.map((p) => (
          <li key={p.slug}>
            <Link
              href={`/blog/${p.slug}`}
              className="group block h-full p-5 rounded-xl border border-border bg-card hover:border-foreground/40 transition-colors"
            >
              <h3 className="text-sm md:text-base font-semibold tracking-tight text-foreground mb-2 group-hover:text-foreground/80 transition-colors line-clamp-2">
                {p.title}
              </h3>
              <p className="text-xs md:text-sm text-muted-foreground leading-relaxed line-clamp-3 mb-3">
                {p.excerpt}
              </p>
              <span className="inline-flex items-center gap-1.5 text-xs text-foreground/80">
                Read post
                <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

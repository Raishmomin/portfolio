// Blog index cards: date · title · excerpt · tags · read time. Each title is a real <a>
// stretched over its card, so the accessible name stays just the title. The newest post
// is featured across two columns; the grid zooms in as a wave.
import Link from "next/link";
import type { BlogPostSummary } from "@/lib/blog-types";
import { plainExcerpt, postTitle } from "@/lib/blog";
import { shortDate } from "@/lib/derive";
import { cn } from "@/lib/utils";
import { card, lit, part } from "../ui";

/** Generated tags sometimes end with a stray period ("Edge Runtime."). */
export const cleanTag = (tag: string) => tag.trim().replace(/\.+$/, "");

export function PostList({ posts }: { posts: BlogPostSummary[] }) {
  return (
    <ol data-card-group="" className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:gap-5 xl:grid-cols-3">
      {posts.map((post, i) => {
        const featured = i === 0;
        return (
          <li key={post.slug} {...card(featured ? "rise" : "zoom")} className={cn("flex", featured && "md:col-span-2")}>
            <article
              {...lit}
              className="panel group relative flex w-full flex-col p-6 transition-colors duration-150 hover:border-foreground/30 md:p-7"
            >
              <p {...part} className="flex items-center justify-between gap-4 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground tabular-nums">
                <time dateTime={new Date(post.publishedAt).toISOString()}>{shortDate(post.publishedAt)}</time>
                <span>{post.readTime} min read</span>
              </p>
              <h3
                {...part}
                className={cn(
                  "mt-4 font-semibold leading-snug tracking-[-0.015em] text-foreground",
                  featured ? "text-[clamp(1.5rem,2.6vw,2rem)] leading-tight" : "text-xl",
                )}
              >
                <Link
                  href={`/blog/${post.slug}`}
                  className="rounded-sm transition-colors duration-150 after:absolute after:inset-0 after:content-[''] group-hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
                >
                  {postTitle(post.title)}
                </Link>
              </h3>
              <p {...part} className={cn("mt-3 text-[15px] leading-6 text-muted-foreground", featured ? "line-clamp-3 max-w-[68ch]" : "line-clamp-3")}>
                {plainExcerpt(post.excerpt)}
              </p>
              <div {...part} className="mt-auto flex items-end justify-between gap-4 pt-5">
                {post.tags?.length ? (
                  <ul aria-label="Tags" className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                    {post.tags.slice(0, 3).map((tag) => (
                      <li key={tag}>#{cleanTag(tag)}</li>
                    ))}
                  </ul>
                ) : (
                  <span />
                )}
                <span aria-hidden="true" className="inline-block text-muted-foreground transition-[transform,color] duration-150 group-hover:translate-x-1 group-hover:text-primary">
                  →
                </span>
              </div>
            </article>
          </li>
        );
      })}
    </ol>
  );
}

/** Topics ticker: the most written-about tags with their real post counts (static wrapped row without motion). */
export function TopicTicker({ posts, limit = 16 }: { posts: BlogPostSummary[]; limit?: number }) {
  const counts = new Map<string, { label: string; n: number }>();
  for (const p of posts)
    for (const t of new Set((p.tags ?? []).map(cleanTag))) {
      const key = t.toLowerCase();
      if (!key) continue;
      const hit = counts.get(key);
      if (hit) hit.n += 1;
      else counts.set(key, { label: t, n: 1 });
    }
  const topics = [...counts.values()].sort((a, b) => b.n - a.n || a.label.localeCompare(b.label)).slice(0, limit);
  if (topics.length < 4) return null;
  return (
    <div data-marquee="" role="group" aria-label="Topics" className="mt-10">
      <ul className="flex flex-wrap justify-center">
        {topics.map((t) => (
          <li key={t.label} className="px-1 py-1">
            <span className="pill whitespace-nowrap">
              #{t.label} <span className="ml-1 text-foreground tabular-nums">{t.n}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

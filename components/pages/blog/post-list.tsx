// Blog index rows: date · title · excerpt · tags · read time. Each title is a real <a>
// stretched over its row, so the accessible name stays just the title.
import Link from "next/link";
import type { BlogPostSummary } from "@/lib/blog-types";
import { plainExcerpt, postTitle } from "@/lib/blog";
import { shortDate } from "@/lib/derive";
import { reveal } from "../motion";

/** Generated tags sometimes end with a stray period ("Edge Runtime."). */
export const cleanTag = (tag: string) => tag.trim().replace(/\.+$/, "");

export function PostList({ posts }: { posts: BlogPostSummary[] }) {
  return (
    <ol className="border-b border-border">
      {posts.map((post, i) => (
        <li key={post.slug} className="group relative border-t border-border first:border-t-0" {...reveal(i % 3)}>
          <article className="grid gap-3 py-8 md:grid-cols-12 md:gap-8 md:py-10">
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground tabular-nums md:col-span-2 md:pt-1.5">
              <time dateTime={new Date(post.publishedAt).toISOString()}>{shortDate(post.publishedAt)}</time>
            </p>
            <div className="min-w-0 md:col-span-8">
              <h2 className="text-xl font-semibold leading-snug tracking-[-0.015em] text-foreground md:text-2xl">
                <Link
                  href={`/blog/${post.slug}`}
                  className="rounded-sm transition-colors duration-150 after:absolute after:inset-0 after:content-[''] group-hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
                >
                  {postTitle(post.title)}
                </Link>
              </h2>
              <p className="mt-3 line-clamp-2 max-w-[68ch] text-[15px] leading-6 text-muted-foreground">
                {plainExcerpt(post.excerpt)}
              </p>
              {post.tags?.length ? (
                <ul aria-label="Tags" className="mt-4 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  {post.tags.slice(0, 3).map((tag) => (
                    <li key={tag}>#{cleanTag(tag)}</li>
                  ))}
                </ul>
              ) : null}
            </div>
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground tabular-nums md:col-span-2 md:pt-1.5 md:text-right">
              {post.readTime} min read
              <span aria-hidden="true" className="ml-2 inline-block transition-[transform,color] duration-150 group-hover:translate-x-0.5 group-hover:text-primary">
                →
              </span>
            </p>
          </article>
        </li>
      ))}
    </ol>
  );
}

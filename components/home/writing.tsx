// Home Writing section. Server Component.
import Link from "next/link";
import { Accent } from "../ui/primitives";
import { shortDate } from "@/lib/derive";
import { cn } from "@/lib/utils";
import type { PostRow } from "./latest-posts";
import { HomeSection, SectionHead, panel } from "./ui";

/**
 * "band" composition: the writing scene owns the band above the cards (on phones, the
 * section opening): one glass page per post, standing right above its card, typed by a
 * light-cursor from a running build terminal. data-focus-id="post:<slug>" lets a hovered
 * or focused card bring its page forward; the scene reads titles/dates from these cards.
 * The post cards zoom in as a wave.
 */
export function WritingSection({ posts }: { posts: PostRow[] }) {
  if (!posts.length) return null;
  return (
    <HomeSection id="writing" section="writing" stage="band" scene labelledBy="writing-heading">
      <div data-card="" className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
        <SectionHead
          id="writing-heading"
          index="06"
          kicker="writing"
          title={
            <>
              Notes from <Accent>the build.</Accent>
            </>
          }
          scene="The glass pages above are these posts, one above each card, typed line by line from a running build. Hover a post to bring its page forward."
        />
        <Link
          href="/blog"
          className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-primary"
        >
          All posts <span aria-hidden="true">→</span>
        </Link>
      </div>
      <ul data-card-group="" className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {posts.map((p, i) => (
          <li key={p.slug} data-card="zoom" className="flex">
            <Link
              href={`/blog/${p.slug}`}
              data-focus-id={`post:${p.slug}`}
              data-tilt="4"
              data-spotlight=""
              className={cn(panel, "group flex w-full flex-col p-5 transition-colors duration-150 hover:border-foreground/30")}
            >
              <span
                data-card-part=""
                className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground tabular-nums"
              >
                {String(i + 1).padStart(2, "0")} · <time dateTime={p.publishedAt}>{shortDate(p.publishedAt)}</time>
                {p.readTime ? ` · ${p.readTime} min read` : null}
              </span>
              <h3
                data-card-part=""
                className="mt-4 text-[17px] font-medium leading-6 tracking-[-0.01em] text-foreground transition-colors duration-150 group-hover:text-primary"
              >
                {p.title}
              </h3>
              <span data-card-part="" className="mt-auto inline-flex items-center gap-1 pt-6 text-sm text-muted-foreground">
                Read
                <span aria-hidden="true" className="transition-[translate] duration-200 group-hover:translate-x-2">
                  →
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </HomeSection>
  );
}

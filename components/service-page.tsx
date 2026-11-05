import Link from "next/link";
import { unstable_cache } from "next/cache";
import { FAQSection } from "./faq-section";
import { Crumbs } from "./pages/projects/subpage-header";
import { ButtonLink, Container, Kicker, Pill } from "./ui/primitives";
import { TAGS } from "@/lib/cache-tags";
import clientPromise from "@/lib/mongodb";
import { SERVICE_SLUGS, type ServiceConfig } from "@/lib/services";
import type { BlogPost } from "@/lib/blog-types";
import { LISTED_POSTS, plainExcerpt, postTitle } from "@/lib/blog";

// DB errors throw (never cached), so a failed ISR revalidation keeps the last good output.
const getRelatedPosts = unstable_cache(
  async (tags: string[]): Promise<Pick<BlogPost, "title" | "slug" | "excerpt">[]> => {
    if (!tags.length) return [];
    const client = await clientPromise;
    const db = client.db("Portfolio");
    const posts = await db
      .collection("blogs")
      .find(
        { ...LISTED_POSTS, tags: { $in: tags } },
        { projection: { title: 1, slug: 1, excerpt: 1 } }
      )
      .sort({ publishedAt: -1 })
      .limit(4)
      .toArray();
    return JSON.parse(JSON.stringify(posts));
  },
  ["service-related-posts"],
  { tags: [TAGS.blogs], revalidate: 3600 }
);

export async function ServicePage({ config }: { config: ServiceConfig }) {
  const relatedPosts = await getRelatedPosts(config.relatedBlogTags);
  const position = SERVICE_SLUGS.indexOf(config.slug) + 1;
  const nn = (n: number) => String(n).padStart(2, "0");

  return (
    <article>
      {/* Hero */}
      <Container className="pb-14 pt-28 md:pb-20 md:pt-36">
        <Crumbs
          items={[
            { name: "Home", href: "/" },
            { name: "Services", href: "/services" },
            { name: config.h1 },
          ]}
        />
        <div className="mt-10 grid gap-12 md:mt-14 lg:grid-cols-12 lg:gap-8">
          <header className="lg:col-span-7">
            <Kicker>
              service · {nn(position)} / {nn(SERVICE_SLUGS.length)}
            </Kicker>
            <h1 className="mt-4 text-[clamp(2.5rem,6vw,4.75rem)] font-semibold leading-[0.98] tracking-[-0.035em] text-foreground">
              {config.h1}
            </h1>
            <p className="mt-6 max-w-[56ch] text-lg leading-8 text-muted-foreground">{config.tagline}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/contact">
                {config.ctaText}
                <span aria-hidden="true">→</span>
              </ButtonLink>
              <ButtonLink href="/services" variant="ghost">
                All services
              </ButtonLink>
            </div>
          </header>

          <aside
            aria-labelledby="engagement"
            className="self-start rounded-lg border border-border bg-card lg:col-span-4 lg:col-start-9"
          >
            <p className="border-b border-border px-5 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              spec · engagement
            </p>
            <div className="p-5 md:p-6">
              <h2 id="engagement" className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Engagement model
              </h2>
              <p className="mt-3 text-[clamp(1.5rem,2.6vw,2rem)] font-semibold leading-tight tracking-[-0.02em] text-foreground tabular-nums">
                From {config.pricing.from}
              </p>
              <p className="mt-2 text-[15px] leading-6 text-muted-foreground">{config.pricing.model}</p>
              <dl className="mt-6 divide-y divide-border border-t border-border text-sm">
                <div className="flex justify-between gap-4 py-3">
                  <dt className="font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground">Type</dt>
                  <dd className="text-right text-foreground">{config.serviceType}</dd>
                </div>
                <div className="flex justify-between gap-4 py-3">
                  <dt className="font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground">Area</dt>
                  <dd className="text-right text-foreground">Worldwide · remote</dd>
                </div>
                <div className="flex justify-between gap-4 py-3">
                  <dt className="font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground">Status</dt>
                  <dd className="inline-flex items-center gap-2 text-right text-foreground">
                    <span aria-hidden="true" className="h-2 w-2 rounded-full bg-ok" />
                    Open to freelance
                  </dd>
                </div>
              </dl>
            </div>
          </aside>
        </div>
      </Container>

      {/* Problem / solution */}
      <section aria-label="Problem and approach" className="border-t border-border">
        <Container className="grid md:grid-cols-2">
          <div className="border-b border-border py-10 md:border-b-0 md:border-r md:py-14 md:pr-10">
            <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">The problem</h2>
            <p className="mt-4 text-lg leading-8 text-foreground/90">{config.hero.problem}</p>
          </div>
          <div className="py-10 md:py-14 md:pl-10">
            <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-primary">How I solve it</h2>
            <p className="mt-4 text-lg leading-8 text-foreground/90">{config.hero.solution}</p>
          </div>
        </Container>
      </section>

      {/* Content sections (approach, process, trade-offs) */}
      <section aria-label="How the engagement works" className="border-t border-border">
        <Container className="space-y-14 py-16 md:space-y-20 md:py-24">
          {config.sections.map((s, i) => (
            <div key={s.heading} className="grid gap-4 md:grid-cols-12 md:gap-8">
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground tabular-nums md:col-span-3 md:pt-3">
                <span className="text-primary">{nn(i + 1)}</span> / {nn(config.sections.length)}
              </p>
              <div className="min-w-0 md:col-span-9 lg:col-span-7">
                <h2 className="text-[clamp(1.5rem,3vw,2.25rem)] font-semibold leading-[1.1] tracking-[-0.025em] text-foreground">
                  {s.heading}
                </h2>
                <p className="mt-5 text-[17px] leading-7 text-muted-foreground">{s.body}</p>
                {s.bullets && s.bullets.length > 0 ? (
                  <ol className="mt-6 divide-y divide-border border-y border-border">
                    {s.bullets.map((b, j) => (
                      <li key={b} className="flex gap-4 py-3 text-[15px] leading-6 text-foreground/90">
                        <span className="w-6 shrink-0 font-mono text-xs leading-6 text-primary tabular-nums" aria-hidden="true">
                          {nn(j + 1)}
                        </span>
                        <span className="min-w-0">{b}</span>
                      </li>
                    ))}
                  </ol>
                ) : null}
              </div>
            </div>
          ))}
        </Container>
      </section>

      {/* Deliverables + stack */}
      <section aria-labelledby="deliverables" className="border-t border-border">
        <Container className="grid gap-14 py-16 md:grid-cols-12 md:gap-8 md:py-24">
          <div className="md:col-span-7">
            <Kicker>deliverables</Kicker>
            <h2
              id="deliverables"
              className="mt-3 text-[clamp(1.875rem,4.5vw,3.25rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-foreground"
            >
              What you get
            </h2>
            <ul className="mt-8 divide-y divide-border border-y border-border">
              {config.deliverables.map((d) => (
                <li key={d} className="flex gap-4 py-3.5 text-base leading-7 text-foreground/90">
                  <span aria-hidden="true" className="shrink-0 font-mono text-sm leading-7 text-ok">
                    ✓
                  </span>
                  <span className="min-w-0">{d}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="md:col-span-4 md:col-start-9">
            <Kicker>stack</Kicker>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.02em] text-foreground">Tech stack</h2>
            <ul className="mt-6 flex flex-wrap gap-2">
              {config.techStack.map((t) => (
                <li key={t}>
                  <Pill className="normal-case tracking-normal text-xs">{t}</Pill>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      {/* Related blog posts */}
      {relatedPosts.length > 0 && (
        <section aria-labelledby="service-writing" className="border-t border-border">
          <Container className="py-16 md:py-24">
            <Kicker>writing</Kicker>
            <h2
              id="service-writing"
              className="mt-3 text-[clamp(1.875rem,4.5vw,3.25rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-foreground"
            >
              Recent writing on this stack
            </h2>
            <ul className="mt-10 grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-2">
              {relatedPosts.map((p) => (
                <li key={p.slug} className="bg-background">
                  <Link
                    href={`/blog/${p.slug}`}
                    className="group flex h-full flex-col p-6 transition-colors duration-150 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <h3 className="text-base font-semibold leading-snug tracking-tight text-foreground">
                      {postTitle(p.title)}
                    </h3>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{plainExcerpt(p.excerpt)}</p>
                    <span className="mt-4 font-mono text-xs uppercase tracking-[0.14em] text-foreground">
                      Read post{" "}
                      <span aria-hidden="true" className="inline-block text-primary transition-transform duration-150 group-hover:translate-x-0.5">
                        →
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Container>
        </section>
      )}

      {/* FAQ (mirrors the FAQPage JSON-LD) */}
      <div className="border-t border-border">
        <FAQSection faqs={config.faqs} heading={`${config.h1} — FAQ`} />
      </div>

      {/* CTA */}
      <section aria-labelledby="service-cta" className="border-t border-border">
        <Container className="grid gap-8 py-20 md:grid-cols-12 md:items-end md:py-28">
          <div className="md:col-span-8">
            <Kicker>next step</Kicker>
            <h2
              id="service-cta"
              className="mt-3 text-[clamp(1.875rem,4.5vw,3.25rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-foreground"
            >
              Ready to start?
            </h2>
            <p className="mt-4 max-w-[56ch] text-[17px] leading-7 text-muted-foreground">
              Tell me about your project and timeline. I&apos;ll reply within one business day with a proposed scope,
              milestones, and a fixed price.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 md:col-span-4 md:justify-end">
            <ButtonLink href="/contact">
              {config.ctaText}
              <span aria-hidden="true">→</span>
            </ButtonLink>
          </div>
        </Container>
      </section>
    </article>
  );
}

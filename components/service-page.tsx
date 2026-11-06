import Link from "next/link";
import { unstable_cache } from "next/cache";
import { FaqSection } from "./pages/about/faq-list";
import { Accent, ButtonLink, Kicker } from "./ui/primitives";
import { TEXT_LINK } from "./pages/about/subpage";
import { CtaSection } from "./pages/cta";
import { PageIntro, PageSection, PopPills, SectionHead, card, column, lit, nn, part } from "./pages/ui";
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

/** "Next.js Development Services" -> ["Next.js ", "Development Services"]: one serif clause per headline, same words. */
function splitHeadline(text: string): [string, string] {
  const words = text.split(" ");
  if (words.length < 3) return ["", text];
  return [`${words.slice(0, -2).join(" ")} `, words.slice(-2).join(" ")];
}

/**
 * One service page in the home design language: intro (left, the stack network), the brief
 * as three floating cards (full), the approach as steps on a drawn line (right),
 * deliverables under a band of shipped projects (band, the work wall), related writing
 * (left), FAQ (right) and the closing call to action (full).
 */
export async function ServicePage({ config }: { config: ServiceConfig }) {
  const relatedPosts = await getRelatedPosts(config.relatedBlogTags);
  const position = SERVICE_SLUGS.indexOf(config.slug) + 1;
  const [headLead, headAccent] = splitHeadline(config.h1);
  let n = 0;
  const next = () => nn(++n);

  return (
    <article>
      <PageIntro
        crumbs={[{ name: "Home", href: "/" }, { name: "Services", href: "/services" }, { name: config.h1 }]}
        kicker={`service · ${nn(position)} / ${nn(SERVICE_SLUGS.length)}`}
        scene="stack"
        note="The network on the right is the stack I build with: one node per skill, one ring per layer, linked wherever two tools shipped together."
        wide
        title={
          <>
            {headLead}
            <Accent>{headAccent}</Accent>
          </>
        }
        lead={config.tagline}
      >
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/contact" data-magnetic="">
            {config.ctaText}
            <span aria-hidden="true">→</span>
          </ButtonLink>
          <ButtonLink href="/services" variant="ghost">
            All services
          </ButtonLink>
        </div>
        <p className="mt-7 flex items-center gap-2.5 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-ok" />
          From {config.pricing.from} · Worldwide · remote
        </p>
      </PageIntro>

      {/* The brief: problem, approach, engagement model */}
      <PageSection id="brief" section="brief" scene="ambient" stage="full" labelledBy="brief-heading">
        <SectionHead
          id="brief-heading"
          index={next()}
          kicker="brief"
          center
          title={
            <>
              The problem, <Accent>and the fix.</Accent>
            </>
          }
        />
        <div data-card-group="" className="mt-12 grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-5">
          <div {...card()} className="flex">
            <section aria-labelledby="problem" {...lit} className="panel w-full p-6 md:p-8">
              <h3 {...part} id="problem" className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
                The problem
              </h3>
              <p {...part} className="mt-4 text-lg leading-8 text-foreground/90">
                {config.hero.problem}
              </p>
            </section>
          </div>
          <div {...card()} className="flex">
            <section aria-labelledby="solution" {...lit} className="panel w-full p-6 md:p-8">
              <h3 {...part} id="solution" className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
                How I solve it
              </h3>
              <p {...part} className="mt-4 text-lg leading-8 text-foreground/90">
                {config.hero.solution}
              </p>
            </section>
          </div>
          <div {...card("zoom")} className="flex">
            <aside aria-labelledby="engagement" {...lit} className="panel w-full">
              <p className="border-b border-border px-5 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                spec · engagement
              </p>
              <div className="p-5 md:p-6">
                <h3 {...part} id="engagement" className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  Engagement model
                </h3>
                <p {...part} className="mt-3 text-[clamp(1.5rem,2.6vw,2rem)] font-semibold leading-tight tracking-[-0.02em] text-foreground tabular-nums">
                  From {config.pricing.from}
                </p>
                <p {...part} className="mt-2 text-[15px] leading-6 text-muted-foreground">
                  {config.pricing.model}
                </p>
                <dl {...part} className="mt-6 divide-y divide-border border-t border-border text-sm">
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
        </div>
      </PageSection>

      {/* Approach, process, trade-offs: steps on one drawn line */}
      <PageSection id="approach" section="approach" scene="ambient" stage="right" labelledBy="approach-heading">
        <div className={column.right}>
          <div {...card()} className="panel p-6 md:p-8">
            <SectionHead
              id="approach-heading"
              index={next()}
              kicker="approach"
              title={
                <>
                  How the engagement <Accent>works.</Accent>
                </>
              }
            />
          </div>
          <ol data-card-group="" className="relative mt-4 space-y-4 pl-8">
            <svg
              aria-hidden="true"
              data-draw=""
              viewBox="0 0 2 100"
              preserveAspectRatio="none"
              className="absolute bottom-6 left-[5px] top-6 h-[calc(100%-3rem)] w-[2px] text-primary/60"
            >
              <line x1="1" y1="0" x2="1" y2="100" stroke="currentColor" strokeWidth="2" />
            </svg>
            {config.sections.map((sec, i) => (
              <li key={sec.heading} {...card()} className="relative">
                <span aria-hidden="true" className="absolute -left-8 top-7 h-3 w-3 rounded-full border border-primary bg-background shadow-[0_0_0_5px_hsl(var(--primary)/0.12)]" />
                <div {...lit} className="panel p-6 md:p-7">
                  <p {...part} className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground tabular-nums">
                    <span className="text-foreground">{nn(i + 1)}</span> / {nn(config.sections.length)}
                  </p>
                  <h3 {...part} className="mt-3 text-balance text-[clamp(1.375rem,2.4vw,1.875rem)] font-semibold leading-[1.1] tracking-[-0.025em] text-foreground">
                    {sec.heading}
                  </h3>
                  <p {...part} className="mt-4 text-[17px] leading-7 text-muted-foreground">
                    {sec.body}
                  </p>
                  {sec.bullets && sec.bullets.length > 0 ? (
                    <ol {...part} className="mt-5 divide-y divide-border border-y border-border">
                      {sec.bullets.map((b, j) => (
                        <li key={b} className="flex gap-4 py-3 text-[15px] leading-6 text-foreground/90">
                          <span className="w-6 shrink-0 font-mono text-xs leading-6 text-muted-foreground tabular-nums" aria-hidden="true">
                            {nn(j + 1)}
                          </span>
                          <span className="min-w-0">{b}</span>
                        </li>
                      ))}
                    </ol>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </PageSection>

      {/* Deliverables + stack */}
      <PageSection id="deliverables-section" section="deliverables" scene="work" stage="band" labelledBy="deliverables">
        <div data-card-group="" className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
          <div {...card()} className="panel p-6 md:p-8 lg:col-span-7">
            <SectionHead
              id="deliverables"
              index={next()}
              kicker="deliverables"
              title={
                <>
                  What you <Accent>get.</Accent>
                </>
              }
              scene="The floating windows above are projects I have shipped end to end: the same kind of work you get."
            />
            <ul className="mt-8 divide-y divide-border border-y border-border">
              {config.deliverables.map((d) => (
                <li key={d} {...part} className="flex gap-4 py-3.5 text-base leading-7 text-foreground/90">
                  <span aria-hidden="true" className="shrink-0 font-mono text-sm leading-7 text-ok">
                    ✓
                  </span>
                  <span className="min-w-0">{d}</span>
                </li>
              ))}
            </ul>
          </div>
          <div {...card("flip")} className="panel self-start p-6 md:p-8 lg:col-span-5">
            <Kicker>stack</Kicker>
            <h3 className="mt-3 text-2xl font-semibold tracking-[-0.02em] text-foreground">Tech stack</h3>
            <PopPills items={config.techStack} className="mt-6 gap-2" pillClassName="normal-case tracking-normal text-xs" />
          </div>
        </div>
      </PageSection>

      {/* Related blog posts */}
      {relatedPosts.length > 0 && (
        <PageSection id="writing" section="writing" scene="ambient" stage="left" labelledBy="service-writing">
          <div className={column.left}>
            <div {...card()} className="panel p-6 md:p-8">
              <SectionHead
                id="service-writing"
                index={next()}
                kicker="writing"
                title={
                  <>
                    Recent writing <Accent>on this stack.</Accent>
                  </>
                }
              />
            </div>
            <ul data-card-group="" className="mt-4 grid grid-cols-1 gap-4">
              {relatedPosts.map((p) => (
                <li key={p.slug} {...card("zoom")}>
                  <Link
                    href={`/blog/${p.slug}`}
                    {...lit}
                    className="panel group flex h-full flex-col p-6 transition-colors duration-150 hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <h3 {...part} className="text-base font-semibold leading-snug tracking-tight text-foreground group-hover:text-primary">
                      {postTitle(p.title)}
                    </h3>
                    <p {...part} className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                      {plainExcerpt(p.excerpt)}
                    </p>
                    <span {...part} className="mt-4 font-mono text-xs uppercase tracking-[0.14em] text-foreground">
                      Read post{" "}
                      <span aria-hidden="true" className="inline-block text-muted-foreground transition-[transform,color] duration-150 group-hover:translate-x-0.5 group-hover:text-primary">
                        →
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </PageSection>
      )}

      {/* FAQ (the same array feeds the FAQPage JSON-LD) */}
      <FaqSection
        faqs={config.faqs}
        id="service-faq"
        index={config.faqs.length ? next() : ""}
        stage="right"
        title={<>{config.h1} — FAQ</>}
      />

      <CtaSection
        id="service-cta"
        stage="full"
        index={next()}
        title={
          <>
            Ready to <Accent>start?</Accent>
          </>
        }
        lead="Tell me about your project and timeline. I'll reply within one business day with a proposed scope, milestones, and a fixed price."
        primary={{ href: "/contact", label: config.ctaText }}
        secondary={{ href: "/services", label: "All services" }}
      >
        <p className="mx-auto mt-4 max-w-[56ch] text-[15px] leading-7 text-muted-foreground">
          I also build interactive, 3D web experiences with React Three Fiber and WebGL. This site is one: its home page is
          an animated 3D neural network.{" "}
          <Link href="/contact" className={`whitespace-nowrap ${TEXT_LINK}`}>
            Ask about a 3D site
          </Link>
          .
        </p>
      </CtaSection>
    </article>
  );
}

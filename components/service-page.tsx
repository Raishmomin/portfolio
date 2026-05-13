import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { unstable_cache } from "next/cache";
import { FAQSection } from "./faq-section";
import { TAGS } from "@/lib/cache-tags";
import clientPromise from "@/lib/mongodb";
import type { ServiceConfig } from "@/lib/services";
import type { BlogPost } from "@/lib/blog-types";

const getRelatedPosts = unstable_cache(
  async (tags: string[]): Promise<Pick<BlogPost, "title" | "slug" | "excerpt">[]> => {
    if (!tags.length) return [];
    try {
      const client = await clientPromise;
      const db = client.db("Portfolio");
      const posts = await db
        .collection("blogs")
        .find(
          { published: { $ne: false }, tags: { $in: tags } },
          { projection: { title: 1, slug: 1, excerpt: 1 } }
        )
        .sort({ publishedAt: -1 })
        .limit(4)
        .toArray();
      return JSON.parse(JSON.stringify(posts));
    } catch {
      return [];
    }
  },
  ["service-related-posts"],
  { tags: [TAGS.blogs], revalidate: 3600 }
);

export async function ServicePage({ config }: { config: ServiceConfig }) {
  const relatedPosts = await getRelatedPosts(config.relatedBlogTags);

  return (
    <article className="relative pt-24">
      {/* Hero */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div className="text-center mb-12">
          <span className="inline-flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-muted-foreground mb-8">
            <span className="h-px w-8 bg-muted-foreground/40" />
            Service
            <span className="h-px w-8 bg-muted-foreground/40" />
          </span>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-foreground mb-6 leading-[1.1]">
            {config.h1}
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {config.tagline}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 md:gap-8 mt-16">
          <div className="rounded-2xl border border-border bg-card p-7 md:p-8">
            <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4">
              The problem
            </h2>
            <p className="text-base text-foreground/90 leading-relaxed">{config.hero.problem}</p>
          </div>
          <div className="rounded-2xl border border-foreground/20 bg-foreground/[0.02] p-7 md:p-8">
            <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4">
              How I solve it
            </h2>
            <p className="text-base text-foreground/90 leading-relaxed">{config.hero.solution}</p>
          </div>
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
          >
            {config.ctaText}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Content sections */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 space-y-16">
        {config.sections.map((s, i) => (
          <div key={i}>
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground mb-5">
              {s.heading}
            </h2>
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed">{s.body}</p>
            {s.bullets && s.bullets.length > 0 && (
              <ul className="mt-6 space-y-3">
                {s.bullets.map((b, j) => (
                  <li key={j} className="flex items-start gap-3 text-base text-muted-foreground">
                    <Check className="w-4 h-4 mt-1 shrink-0 text-foreground/70" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </section>

      {/* Deliverables */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground mb-8 text-center">
          What you get
        </h2>
        <ul className="grid md:grid-cols-2 gap-4">
          {config.deliverables.map((d, i) => (
            <li
              key={i}
              className="flex items-start gap-3 p-5 rounded-xl border border-border bg-card"
            >
              <Check className="w-4 h-4 mt-1 shrink-0 text-foreground/70" />
              <span className="text-sm md:text-base text-foreground/90 leading-relaxed">{d}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Tech stack */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground mb-8 text-center">
          Tech stack
        </h2>
        <div className="flex flex-wrap justify-center gap-2">
          {config.techStack.map((t) => (
            <span
              key={t}
              className="text-sm px-4 py-2 rounded-full border border-border text-muted-foreground"
            >
              {t}
            </span>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="rounded-2xl border border-border bg-card p-8 md:p-10 text-center">
          <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">
            Engagement model
          </h2>
          <p className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground mb-3">
            From {config.pricing.from}
          </p>
          <p className="text-sm md:text-base text-muted-foreground max-w-xl mx-auto">
            {config.pricing.model}
          </p>
        </div>
      </section>

      {/* Related blog posts */}
      {relatedPosts.length > 0 && (
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground mb-8 text-center">
            Recent writing on this stack
          </h2>
          <ul className="grid md:grid-cols-2 gap-4">
            {relatedPosts.map((p) => (
              <li key={p.slug}>
                <Link
                  href={`/blog/${p.slug}`}
                  className="group block p-6 rounded-xl border border-border bg-card hover:border-foreground/40 transition-colors"
                >
                  <h3 className="text-base font-semibold tracking-tight text-foreground mb-2 group-hover:text-foreground/80 transition-colors">
                    {p.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                    {p.excerpt}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* FAQ */}
      <FAQSection faqs={config.faqs} heading={`${config.h1} — FAQ`} />

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 text-center">
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground mb-6">
          Ready to start?
        </h2>
        <p className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto mb-8 leading-relaxed">
          Tell me about your project and timeline. I&apos;ll reply within one business day with a
          proposed scope, milestones, and a fixed price.
        </p>
        <Link
          href="/contact"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
        >
          {config.ctaText}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </section>
    </article>
  );
}

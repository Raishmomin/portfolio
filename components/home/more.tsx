// Home sections after the work scene: services, the 3D-site call to action, writing,
// FAQ and contact (contact owns the final 3D scene). Server Components; the contact form
// and "copy email" are the only client islands. Sections without a scene keep the
// previous scene, dimmed, behind their panels.
import { Suspense } from "react";
import Link from "next/link";
import { Accent, ButtonLink } from "../ui/primitives";
import { ContactForm } from "../contact-form";
import type { ServiceConfig } from "@/lib/services";
import type { FAQ } from "@/lib/seo";
import { PROFILE } from "@/lib/profile";
import { shortDate } from "@/lib/derive";
import { cn } from "@/lib/utils";
import { CopyEmail } from "../copy-email";
import type { PostRow } from "./latest-posts";
import { HomeSection, NeuralGlyph, SectionHead, aiText, panel, reveal } from "./ui";

const rowLink =
  "group grid grid-cols-[2.25rem_1fr_auto] items-baseline gap-x-3 py-5 transition-colors duration-150";

export function ServicesSection({ services }: { services: ServiceConfig[] }) {
  return (
    <HomeSection id="services" section="services" labelledBy="services-heading">
      <div className={cn(panel, "p-6 md:p-8 lg:max-w-[46rem]")} {...reveal()}>
        <SectionHead
          id="services-heading"
          index="05"
          kicker="services"
          title={
            <>
              Ways to <Accent>work together.</Accent>
            </>
          }
        />
        <ul className="mt-8 border-t border-border">
          {services.map((s, i) => (
            <li key={s.slug} className="border-b border-border last:border-b-0">
              <Link href={`/services/${s.slug}`} className={rowLink}>
                <span className="font-mono text-xs text-muted-foreground tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                <span className="min-w-0">
                  <h3 className="text-lg font-semibold leading-6 tracking-[-0.015em] text-foreground group-hover:text-primary">
                    {s.h1}
                  </h3>
                  <span className="mt-1 block text-[15px] leading-6 text-muted-foreground">{s.tagline}</span>
                </span>
                <span aria-hidden="true" className="text-muted-foreground transition-[translate] duration-150 group-hover:translate-x-0.5">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </HomeSection>
  );
}

/** "Want a 3D site like this?" — the page itself is the portfolio piece. */
export function ThreeDCtaSection() {
  return (
    <HomeSection id="build-3d" section="cta" labelledBy="build-3d-heading">
      <div className={cn(panel, "relative overflow-hidden p-6 md:p-10 lg:max-w-[52rem]")} {...reveal()}>
        <div
          aria-hidden="true"
          data-parallax="-0.3"
          className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[radial-gradient(closest-side,rgb(63_91_217/0.22),transparent)] dark:bg-[radial-gradient(closest-side,rgb(124_156_255/0.22),transparent)]"
        />
        <p className={cn("relative inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.14em]", aiText)}>
          <NeuralGlyph />
          Interactive 3D web
        </p>
        <h2
          id="build-3d-heading"
          data-split=""
          className="relative mt-4 text-balance text-[clamp(2rem,5vw,3.75rem)] font-semibold leading-[1.02] tracking-[-0.035em] text-foreground"
        >
          Want a 3D site <Accent>like this one?</Accent>
        </h2>
        <p className="relative mt-5 max-w-[56ch] text-[17px] leading-7 text-muted-foreground">
          I build interactive 3D web experiences. The neural network on this page is drawn live in your browser with
          WebGL (Three.js and React Three Fiber), while every word stays server-rendered HTML, so search engines and
          AI assistants read it all.
        </p>
        <div className="relative mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/contact" data-magnetic="">
            Start a 3D project <span aria-hidden="true">→</span>
          </ButtonLink>
          <ButtonLink href="/services" variant="ghost">
            See all services
          </ButtonLink>
        </div>
      </div>
    </HomeSection>
  );
}

export function WritingSection({ posts }: { posts: PostRow[] }) {
  if (!posts.length) return null;
  return (
    <HomeSection id="writing" section="writing" labelledBy="writing-heading">
      <div className={cn(panel, "p-6 md:p-8 lg:max-w-[46rem]")} {...reveal()}>
        <SectionHead
          id="writing-heading"
          index="06"
          kicker="writing"
          title={
            <>
              Notes from <Accent>the build.</Accent>
            </>
          }
        />
        <ul className="mt-8 border-t border-border">
          {posts.map((p) => (
            <li key={p.slug} className="border-b border-border">
              <Link href={`/blog/${p.slug}`} className="group block py-5">
                <h3 className="text-[17px] font-medium leading-6 tracking-[-0.01em] text-foreground group-hover:text-primary">
                  {p.title}
                </h3>
                <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground tabular-nums">
                  <time dateTime={p.publishedAt}>{shortDate(p.publishedAt)}</time>
                  {p.readTime ? ` · ${p.readTime} min read` : null}
                </p>
              </Link>
            </li>
          ))}
        </ul>
        <Link
          href="/blog"
          className="mt-6 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-primary"
        >
          All posts <span aria-hidden="true">→</span>
        </Link>
      </div>
    </HomeSection>
  );
}

export function FaqSection({ faqs }: { faqs: FAQ[] }) {
  return (
    <HomeSection id="faq" section="faq" labelledBy="faq-heading">
      <div className={cn(panel, "p-6 md:p-8 lg:max-w-[46rem]")} {...reveal()}>
        <SectionHead
          id="faq-heading"
          index="07"
          kicker="faq"
          title={
            <>
              Questions, <Accent>answered.</Accent>
            </>
          }
        />
        <ul className="mt-8 border-t border-border">
          {faqs.map((f) => (
            <li key={f.q} className="border-b border-border last:border-b-0">
              <details className="group">
                <summary className="flex min-h-12 cursor-pointer list-none items-start justify-between gap-6 py-4 [&::-webkit-details-marker]:hidden">
                  <h3 className="text-[17px] font-medium leading-6 tracking-[-0.01em] text-foreground">{f.q}</h3>
                  <span aria-hidden="true" className="mt-0.5 font-mono text-lg leading-5 text-muted-foreground transition-transform duration-200 group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="max-w-[62ch] pb-5 text-[15px] leading-6 text-muted-foreground">{f.a}</p>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </HomeSection>
  );
}

const SOCIALS = [
  { label: "GitHub", href: PROFILE.social.github },
  { label: "LinkedIn", href: PROFILE.social.linkedin },
  { label: "X", href: PROFILE.social.x },
] as const;

export function ContactSection() {
  return (
    <HomeSection id="contact" section="contact" labelledBy="contact-heading" scene>
      <div className={cn(panel, "p-6 md:p-8 lg:max-w-[40rem]")} {...reveal()}>
        <SectionHead
          id="contact-heading"
          index="08"
          kicker="contact"
          title={
            <>
              Have a product to ship? <Accent>Let&apos;s talk.</Accent>
            </>
          }
          scene="The whole network converges into one bright node, with a line drawn out to you: a direct line to me."
        />
        <dl className="mt-8 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
          <div className="bg-background p-5 sm:col-span-2">
            <dt className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">Email</dt>
            <dd className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
              <a
                href={`mailto:${PROFILE.email}`}
                className="inline-flex min-h-11 items-center break-all text-[clamp(1.125rem,2.2vw,1.5rem)] font-medium tracking-[-0.015em] text-foreground underline decoration-border underline-offset-4 hover:decoration-primary"
              >
                {PROFILE.email}
              </a>
              <CopyEmail email={PROFILE.email} />
            </dd>
          </div>
          <div className="bg-background p-5">
            <dt className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">Availability</dt>
            <dd className="mt-2 text-[15px] leading-6 text-foreground">Open to {PROFILE.availability}</dd>
          </div>
          <div className="bg-background p-5">
            <dt className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">Timezone</dt>
            <dd className="mt-2 text-[15px] leading-6 text-foreground">
              IST (UTC+5:30) · {PROFILE.location.locality}, {PROFILE.location.country}
            </dd>
          </div>
          <div className="bg-background p-5 sm:col-span-2">
            <dt className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">Elsewhere</dt>
            <dd className="mt-1 flex flex-wrap gap-x-6">
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer me"
                  className="inline-flex min-h-11 min-w-11 items-center gap-1 text-[15px] text-foreground underline decoration-border underline-offset-4 hover:decoration-primary"
                >
                  {s.label}
                  <span aria-hidden="true">↗</span>
                </a>
              ))}
            </dd>
          </div>
        </dl>
        <div className="mt-10">
          {/* Below the fold: the boundary lets React hydrate the form in its own low-priority pass. */}
          <Suspense>
            <ContactForm />
          </Suspense>
        </div>
      </div>
    </HomeSection>
  );
}

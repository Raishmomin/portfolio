// Home sections after the work scene: services, the 3D-site call to action, writing,
// FAQ and contact (contact owns the final 3D scene). Server Components; the contact form
// and "copy email" are the only client islands. Each declares its own composition
// (data-stage) so the rhythm alternates; sections without a scene get the stage's calm
// ambient field.
import { Suspense } from "react";
import Link from "next/link";
import { Accent } from "../ui/primitives";
import { ContactForm } from "../contact-form";
import type { ServiceConfig } from "@/lib/services";
import type { FAQ } from "@/lib/seo";
import { PROFILE } from "@/lib/profile";
import { shortDate } from "@/lib/derive";
import { cn } from "@/lib/utils";
import { CopyEmail } from "../copy-email";
import type { PostRow } from "./latest-posts";
import { HomeSection, SectionHead, column, panel } from "./ui";

/** "AWS (EC2, ECS, …)" -> "AWS": a short chip label for a service's stack entry. */
const chipLabel = (t: string) => t.replace(/\s*\(.*?\)/g, "").trim();

/** "right" composition over the ambient field: four service cards flip in from depth. */
export function ServicesSection({ services }: { services: ServiceConfig[] }) {
  return (
    <HomeSection id="services" section="services" stage="right" labelledBy="services-heading">
      <div className={column.right}>
        <div data-card="" className={cn(panel, "p-6 md:p-8")}>
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
        </div>
        <ul data-card-group="" className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {services.map((s, i) => (
            <li key={s.slug} data-card="flip" className="flex">
              <Link
                href={`/services/${s.slug}`}
                data-tilt="4"
                data-spotlight=""
                className={cn(panel, "group flex w-full flex-col p-5 transition-colors duration-150 hover:border-foreground/30")}
              >
                <span data-card-part="" className="font-mono text-xs text-muted-foreground tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3
                  data-card-part=""
                  className="mt-3 text-lg font-semibold leading-6 tracking-[-0.015em] text-foreground transition-colors duration-150 group-hover:text-primary"
                >
                  {s.h1}
                </h3>
                <span data-card-part="" className="mt-2 block text-[15px] leading-6 text-muted-foreground">
                  {s.tagline}
                </span>
                <span data-card-part="pop" className="mt-4 flex flex-wrap gap-1.5">
                  {s.techStack.slice(0, 3).map((t) => (
                    <span key={t} className="pill">
                      {chipLabel(t)}
                    </span>
                  ))}
                </span>
                <span
                  data-card-part=""
                  className="mt-auto inline-flex items-center gap-1 pt-5 text-sm font-medium text-foreground"
                >
                  Explore
                  <span aria-hidden="true" className="transition-[translate] duration-200 group-hover:translate-x-2">
                    →
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </HomeSection>
  );
}

/** "band" composition: the ambient field owns the top; the post cards zoom in as a wave. */
export function WritingSection({ posts }: { posts: PostRow[] }) {
  if (!posts.length) return null;
  return (
    <HomeSection id="writing" section="writing" stage="band" labelledBy="writing-heading">
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

/** "left" composition: each question is its own card; answers open smoothly. */
export function FaqSection({ faqs }: { faqs: FAQ[] }) {
  return (
    <HomeSection id="faq" section="faq" stage="left" labelledBy="faq-heading">
      <div className={column.left}>
        <div data-card="" className={cn(panel, "p-6 md:p-8")}>
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
        </div>
        <ul data-card-group="" className="mt-4 grid grid-cols-1 gap-3">
          {faqs.map((f) => (
            <li key={f.q} data-card="">
              <details data-spotlight="" className={cn(panel, "faq group px-5")}>
                <summary className="flex min-h-12 cursor-pointer list-none items-start justify-between gap-6 py-4 [&::-webkit-details-marker]:hidden">
                  <h3 className="text-[17px] font-medium leading-6 tracking-[-0.01em] text-foreground">{f.q}</h3>
                  <span
                    aria-hidden="true"
                    className="mt-0.5 font-mono text-lg leading-5 text-muted-foreground transition-transform duration-300 group-open:rotate-45 group-open:text-primary"
                  >
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

/** "full" composition: the network converges behind the centred contact card. */
export function ContactSection() {
  return (
    <HomeSection id="contact" section="contact" stage="full" scene labelledBy="contact-heading">
      <div data-card="">
        <SectionHead
          center
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
      </div>
      <div data-card="zoom" className={cn(panel, "mx-auto mt-10 max-w-[52rem] p-6 md:p-8 lg:mt-14")}>
        <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
          <div data-card-part="" className="bg-background p-5 sm:col-span-2">
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
          <div data-card-part="" className="bg-background p-5">
            <dt className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">Availability</dt>
            <dd className="mt-2 text-[15px] leading-6 text-foreground">Open to {PROFILE.availability}</dd>
          </div>
          <div data-card-part="" className="bg-background p-5">
            <dt className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">Timezone</dt>
            <dd className="mt-2 text-[15px] leading-6 text-foreground">
              IST (UTC+5:30) · {PROFILE.location.locality}, {PROFILE.location.country}
            </dd>
          </div>
          <div data-card-part="" className="bg-background p-5 sm:col-span-2">
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
        <div data-card-part="" className="mt-10">
          {/* Below the fold: the boundary lets React hydrate the form in its own low-priority pass. */}
          <Suspense>
            <ContactForm />
          </Suspense>
        </div>
      </div>
    </HomeSection>
  );
}

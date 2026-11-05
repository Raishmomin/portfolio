// Home sections 05–08: services teaser, writing, FAQ, contact. Server Components;
// the contact form and "copy email" are the only client islands.
import Link from "next/link";
import { Accent, Section, SectionHeader } from "../ui/primitives";
import { revealProps } from "../reveal";
import { ContactForm } from "../contact-form";
import type { ServiceConfig } from "@/lib/services";
import type { FAQ } from "@/lib/seo";
import { PROFILE } from "@/lib/profile";
import { CopyEmail } from "./copy-email";
import type { PostRow } from "./latest-posts";

const rowLink =
  "group grid grid-cols-[2.25rem_1fr_auto] items-baseline gap-x-3 py-5 transition-colors duration-150";

export function ServicesSection({ services }: { services: ServiceConfig[] }) {
  return (
    <section id="services" aria-labelledby="services-heading" className="scroll-mt-24 border-t border-border py-20 md:py-28">
      <SectionHeader
        id="services-heading"
        kicker="05 · services"
        title={
          <>
            Ways to <Accent>work together.</Accent>
          </>
        }
      />
      <ul className="mt-10 border-t border-border" {...revealProps()}>
        {services.map((s, i) => (
          <li key={s.slug} className="border-b border-border">
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
    </section>
  );
}

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export function WritingSection({ posts }: { posts: PostRow[] }) {
  if (!posts.length) return null;
  return (
    <section id="writing" aria-labelledby="writing-heading" className="scroll-mt-24 border-t border-border py-20 md:py-28">
      <SectionHeader
        id="writing-heading"
        kicker="06 · writing"
        title={
          <>
            Notes from <Accent>the build.</Accent>
          </>
        }
      />
      <ul className="mt-10 border-t border-border" {...revealProps()}>
        {posts.map((p) => (
          <li key={p.slug} className="border-b border-border">
            <Link href={`/blog/${p.slug}`} className="group block py-5">
              <h3 className="text-[17px] font-medium leading-6 tracking-[-0.01em] text-foreground group-hover:text-primary">
                {p.title}
              </h3>
              <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground tabular-nums">
                <time dateTime={p.publishedAt}>{dateFmt.format(new Date(p.publishedAt))}</time>
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
    </section>
  );
}

export function FaqSection({ faqs }: { faqs: FAQ[] }) {
  return (
    <section id="faq" aria-labelledby="faq-heading" className="scroll-mt-24 border-t border-border py-20 md:py-28">
      <SectionHeader
        id="faq-heading"
        kicker="07 · faq"
        title={
          <>
            Questions, <Accent>answered.</Accent>
          </>
        }
      />
      <ul className="mt-10 border-t border-border">
        {faqs.map((f) => (
          <li key={f.q} className="border-b border-border">
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
    </section>
  );
}

const SOCIALS = [
  { label: "GitHub", href: PROFILE.social.github },
  { label: "LinkedIn", href: PROFILE.social.linkedin },
  { label: "X", href: PROFILE.social.x },
] as const;

export function ContactSection() {
  return (
    <Section id="contact" section="contact" aria-labelledby="contact-heading" className="pb-24 md:pb-32">
      <SectionHeader
        id="contact-heading"
        kicker="08 · contact"
        title={
          <>
            Have a product to ship? <Accent>Let&apos;s talk.</Accent>
          </>
        }
      />
      <div {...revealProps()}>
        <dl className="mt-10 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
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
                  className="inline-flex min-h-11 items-center gap-1 text-[15px] text-foreground underline decoration-border underline-offset-4 hover:decoration-primary"
                >
                  {s.label}
                  <span aria-hidden="true">↗</span>
                </a>
              ))}
            </dd>
          </div>
        </dl>
        <div className="mt-12">
          <ContactForm />
        </div>
      </div>
    </Section>
  );
}

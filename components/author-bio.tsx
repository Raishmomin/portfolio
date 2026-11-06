import Link from "next/link";
import { Portrait } from "./ui/portrait";
import { SITE } from "@/lib/config";
import { LOCATION_LABEL, experienceLabel } from "@/lib/profile";
import { card, part } from "./pages/ui";

// Identity facts come only from profile.ts (via SITE/PROFILE); nothing here is typed by hand.

const serviceLink =
  "text-foreground underline decoration-foreground/30 decoration-1 underline-offset-[3px] transition-colors duration-150 hover:decoration-primary focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const chip =
  "inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border px-4 font-mono text-xs uppercase tracking-[0.12em] text-foreground transition-colors duration-150 hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function AuthorBio() {
  return (
    <aside className="mt-16 rounded-lg border border-border bg-card" aria-labelledby="author-bio" {...card()} data-spotlight="">
      <p className="flex items-center justify-between gap-4 border-b border-border px-5 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        <span>author</span>
        <span className="truncate">{LOCATION_LABEL}</span>
      </p>
      <div className="flex items-start gap-5 p-5 md:p-6">
        <Portrait size={56} decorative className="rounded-full ring-1 ring-border" />
        <div className="min-w-0 flex-1">
          <h2 {...part} id="author-bio" className="text-lg font-semibold tracking-tight text-foreground">
            Written by {SITE.name}
          </h2>
          <p className="mt-1 font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground">{SITE.jobTitle}</p>
          <p {...part} className="mt-3 text-[15px] leading-6 text-muted-foreground">
            {experienceLabel()} years shipping production Next.js, Node.js, and AWS infrastructure for SaaS,
            e-commerce, and internal platforms. Available for freelance{" "}
            <Link href="/services/nextjs-development" className={serviceLink}>
              Next.js
            </Link>
            ,{" "}
            <Link href="/services/mern-stack-development" className={serviceLink}>
              MERN
            </Link>
            ,{" "}
            <Link href="/services/devops-aws-consulting" className={serviceLink}>
              DevOps
            </Link>
            , and{" "}
            <Link href="/services/api-backend-development" className={serviceLink}>
              API
            </Link>{" "}
            engagements.
          </p>
          <div {...part} className="mt-5 flex flex-wrap gap-2">
            <Link
              href="/contact"
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Work with me
              <span aria-hidden="true">→</span>
            </Link>
            {SITE.github ? (
              <a href={SITE.github} target="_blank" rel="noopener noreferrer" className={chip}>
                GitHub<span aria-hidden="true">↗</span>
              </a>
            ) : null}
            {SITE.linkedin ? (
              <a href={SITE.linkedin} target="_blank" rel="noopener noreferrer" className={chip}>
                LinkedIn<span aria-hidden="true">↗</span>
              </a>
            ) : null}
            {SITE.email ? (
              <a href={`mailto:${SITE.email}`} className={chip}>
                Email
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </aside>
  );
}

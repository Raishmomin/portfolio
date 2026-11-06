import Link from "next/link";
import { SITE, PAGES } from "@/lib/config";
import { PROFILE } from "@/lib/profile";
import { RSS_URL } from "@/lib/seo";

const SOCIALS = [
  { label: "GitHub", href: PROFILE.social.github },
  { label: "LinkedIn", href: PROFILE.social.linkedin },
  { label: "X", href: PROFILE.social.x },
] as const;

const linkClass =
  "inline-flex min-h-11 min-w-11 items-center text-[15px] text-muted-foreground transition-colors duration-150 hover:text-foreground";
const headingClass = "font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground";

/**
 * Site footer (every page; no props). Server Component: wordmark, every page, socials, RSS.
 * The three columns rise in as one wave (data-card-group); static without motion.
 */
export function Footer() {
  return (
    <footer className="relative border-t border-border bg-background">
      <div data-card-group="" className="mx-auto grid w-full max-w-[1280px] grid-cols-1 gap-10 px-4 pb-10 pt-16 sm:grid-cols-2 md:px-8 lg:grid-cols-12 lg:gap-8">
        <div data-card="" className="lg:col-span-6">
          <Link href="/" className="inline-flex min-h-11 items-center font-mono text-sm font-medium text-foreground">
            raish<span className="text-primary">.</span>momin
          </Link>
          <p className="mt-3 max-w-sm text-[15px] leading-6 text-muted-foreground">
            {PROFILE.jobTitle}, based in {PROFILE.location.locality}, {PROFILE.location.country}. Open to{" "}
            {PROFILE.availability}.
          </p>
          <a
            href={`mailto:${PROFILE.email}`}
            className="mt-4 inline-flex min-h-11 items-center text-[15px] text-foreground underline decoration-border underline-offset-4 transition-colors duration-150 hover:decoration-primary"
          >
            {PROFILE.email}
          </a>
        </div>

        <nav aria-label="Footer" data-card="" className="lg:col-span-3">
          <h2 className={headingClass}>Pages</h2>
          <ul className="mt-3 grid grid-cols-2 gap-x-6 sm:grid-cols-1">
            {PAGES.map((p) => (
              <li key={p.path}>
                <Link href={p.path} className={linkClass}>
                  {p.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div data-card="" className="lg:col-span-3">
          <h2 className={headingClass}>Elsewhere</h2>
          <ul className="mt-3">
            {SOCIALS.map((s) => (
              <li key={s.label}>
                <a href={s.href} target="_blank" rel="noopener noreferrer me" className={linkClass}>
                  {s.label}
                  <span aria-hidden="true" className="ml-1">↗</span>
                </a>
              </li>
            ))}
            <li>
              <a href={RSS_URL} className={linkClass}>
                RSS feed
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-2 px-4 py-6 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground sm:flex-row sm:items-center sm:justify-between md:px-8">
          <p>Built with Next.js · React Three Fiber</p>
          <p>
            © {new Date().getFullYear()} {SITE.name}
          </p>
        </div>
      </div>
    </footer>
  );
}

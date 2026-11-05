import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "../components/navbar";
import { Footer } from "../components/footer";

// 404s must not inherit the layout's robots (index,follow) or its canonical (the
// home page). Next also adds its own <meta name="robots" content="noindex"> to
// every 404 response, so two robots tags appear; both say noindex, which is
// consistent. Dropping this one would leave "index, follow" next to Next's tag.
export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
  alternates: { canonical: null },
};

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/projects", label: "Projects" },
  { href: "/services", label: "Services" },
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Contact" },
];

export default function NotFound() {
  return (
    <>
      <Navbar />
      <main id="main" tabIndex={-1} className="relative pt-24 outline-none">
        <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32 text-center">
          <span className="inline-flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-muted-foreground mb-6">
            <span className="h-px w-8 bg-muted-foreground/40" />
            404
            <span className="h-px w-8 bg-muted-foreground/40" />
          </span>
          <h1 className="heading-fluid font-semibold text-foreground">Page not found.</h1>
          <p className="mt-6 text-base md:text-lg text-muted-foreground leading-relaxed">
            This page doesn&apos;t exist or has moved. Try one of these instead:
          </p>
          <nav aria-label="Suggested pages" className="mt-10">
            <ul className="flex flex-wrap justify-center gap-2">
              {LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="inline-flex h-11 items-center px-5 rounded-full border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </section>
      </main>
      <Footer />
    </>
  );
}

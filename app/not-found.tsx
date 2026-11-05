import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "../components/navbar";
import { Footer } from "../components/footer";
import { Container, Kicker } from "../components/ui/primitives";

// 404s must not inherit the layout's robots (index,follow) or its canonical (the
// home page). `robots: null` drops the layout's tag; Next adds its own
// <meta name="robots" content="noindex"> to every 404, so exactly one robots tag remains.
export const metadata: Metadata = {
  title: "Page not found",
  robots: null,
  alternates: { canonical: null },
};

const LINKS = [
  { href: "/", label: "Home", cmd: "cd ~" },
  { href: "/projects", label: "Projects", cmd: "get projects" },
  { href: "/blog", label: "Blog", cmd: "get posts" },
  { href: "/services", label: "Services", cmd: "get services" },
  { href: "/contact", label: "Contact", cmd: "contact" },
];

export default function NotFound() {
  return (
    <>
      <Navbar />
      <main id="main" tabIndex={-1} className="relative outline-none">
        <Container className="grid gap-12 pb-24 pt-28 md:pb-32 md:pt-40 lg:grid-cols-12 lg:gap-8">
          <div className="min-w-0 lg:col-span-7">
            <Kicker>
              kubectl get page · <span className="text-primary">NotFound</span>
            </Kicker>
            <h1 className="mt-4 text-[clamp(2.75rem,7vw,6.5rem)] font-semibold leading-[0.95] tracking-[-0.035em] text-foreground">
              Page not found.
            </h1>
            <p className="mt-6 max-w-[52ch] text-[17px] leading-7 text-muted-foreground">
              This page doesn&apos;t exist or has moved. Try one of these instead:
            </p>
          </div>

          <div className="min-w-0 self-end rounded-lg border border-border bg-card lg:col-span-5">
            <p
              aria-hidden="true"
              className="border-b border-border px-5 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground"
            >
              terminal · 404
            </p>
            <div className="p-5 font-mono text-[13px] leading-6" aria-hidden="true">
              <p className="text-foreground">
                <span className="text-primary">$</span> kubectl get page
              </p>
              <p className="break-words text-muted-foreground">Error from server (NotFound): page not found</p>
            </div>
            <nav aria-label="Suggested pages" className="border-t border-border">
              <ul className="divide-y divide-border">
                {LINKS.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="group flex min-h-11 items-center justify-between gap-4 px-5 py-3 transition-colors duration-150 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      <span className="text-[15px] font-medium text-foreground">{l.label}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {l.cmd}{" "}
                        <span aria-hidden="true" className="inline-block text-primary transition-transform duration-150 group-hover:translate-x-0.5">
                          →
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}

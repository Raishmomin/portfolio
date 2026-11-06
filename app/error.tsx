"use client";

// Segment error boundary under the root layout. A client render error on any page lands
// here instead of escaping to Next's root boundary, which would re-create <html> on the
// client (and make React warn about the layout's head script). Build-time and ISR
// render errors still fail the render, so the last good page keeps being served.
// It ships in every page's initial JS: plain class strings and next/link only (no
// primitives/cn import, which would pull tailwind-merge into the initial bundle).
import Link from "next/link";
import { useEffect } from "react";

const button =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main" tabIndex={-1} className="relative outline-none">
      <div className="mx-auto w-full max-w-[1280px] px-4 pb-24 pt-28 md:px-8 md:pb-32 md:pt-40">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground tabular-nums">
          error · <span className="text-primary">render failed</span>
        </p>
        <h1 className="mt-4 text-[clamp(2.5rem,6vw,5rem)] font-semibold leading-[0.95] tracking-[-0.035em] text-foreground">
          Something went wrong.
        </h1>
        <p className="mt-6 max-w-[52ch] text-[17px] leading-7 text-muted-foreground">
          This part of the page failed to load. Try again, or head back to the home page.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button type="button" onClick={reset} className={`${button} bg-primary text-primary-foreground hover:bg-primary/90`}>
            Try again
          </button>
          <Link href="/" className={`${button} border border-border text-foreground hover:border-foreground/40 hover:bg-accent`}>
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}

import Link from "next/link";
import { NavLinks } from "./header/nav-links";
import { MobileMenu } from "./header/mobile-menu";
import { ThemeToggle } from "./header/theme-toggle";
import { MotionToggle } from "./header/motion-toggle";

/**
 * Site header (every page; no props). A Server Component: the wordmark and layout are
 * static HTML, and only the nav list (pathname-aware), the two toggles and the mobile
 * disclosure are client islands. Sticky and opaque (no translucency, so nothing
 * scrolled under it bleeds through); html scroll-padding-top keeps focus and anchor
 * targets below it.
 */
export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background">
      <div className="relative mx-auto flex h-16 w-full max-w-[1280px] items-center justify-between gap-4 px-4 md:px-8">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center font-mono text-sm font-medium tracking-[0.02em] text-foreground"
        >
          raish<span className="text-primary">.</span>momin
        </Link>

        <nav aria-label="Primary" className="hidden lg:block">
          <NavLinks />
        </nav>

        <div className="flex items-center gap-1">
          <MotionToggle />
          <ThemeToggle />
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}

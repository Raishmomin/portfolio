"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { resolveNav } from "./nav-items";
import { NavLink } from "./nav-links";

/**
 * Mobile nav (<1024px) as a native <details> disclosure, so it opens and closes
 * without JS too (the summary is exposed as a button with its expanded state).
 * With JS it also closes on Escape (focus returns to the summary), when focus moves
 * to something outside it, on a pointer press outside it or on the scrim, and on
 * client navigation.
 */
export function MobileMenu() {
  const pathname = usePathname() ?? "";
  const items = resolveNav(pathname);
  const [open, setOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(pathname);
  const rootRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);

  // Close on client navigation (adjusting state during render, no effect needed).
  if (open && openedAt !== pathname) {
    setOpen(false);
    setOpenedAt(pathname);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        summaryRef.current?.focus();
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <details
      ref={rootRef}
      open={open}
      onToggle={(e) => {
        const next = e.currentTarget.open;
        if (next) setOpenedAt(pathname);
        setOpen(next);
      }}
      onBlur={(e) => {
        // Keyboard focus left the menu (Tab past the last link, Shift+Tab before the
        // summary): close it so it never covers the focused element. A null
        // relatedTarget (a press on non-focusable space) is the pointer handler's job.
        const to = e.relatedTarget as Node | null;
        if (open && to && !e.currentTarget.contains(to)) setOpen(false);
      }}
      className="group lg:hidden"
    >
      <summary
        ref={summaryRef}
        className="inline-flex h-11 min-w-11 cursor-pointer list-none items-center justify-center gap-2 rounded-md px-2 font-mono text-xs uppercase tracking-[0.14em] text-foreground hover:bg-accent [&::-webkit-details-marker]:hidden"
      >
        <span aria-hidden="true" className="relative block h-3 w-4">
          <span className="absolute left-0 top-0 block h-px w-4 bg-current transition-transform duration-200 group-open:top-1.5 group-open:rotate-45" />
          <span className="absolute left-0 top-1.5 block h-px w-4 bg-current group-open:opacity-0" />
          <span className="absolute left-0 top-3 block h-px w-4 bg-current transition-transform duration-200 group-open:top-1.5 group-open:-rotate-45" />
        </span>
        Menu
      </summary>
      {/* Scrim: marks the panel as a layer over the page; a press on it closes the menu. */}
      <div
        aria-hidden="true"
        onClick={() => setOpen(false)}
        className="js-only fixed inset-x-0 bottom-0 top-[calc(4rem+1px)] bg-background/80"
      />
      <nav
        id="mobile-nav"
        aria-label="Primary"
        className="absolute inset-x-0 top-[calc(100%+1px)] border-b border-border bg-background shadow-[0_24px_48px_-24px_rgb(0_0_0/0.45)]"
      >
        <ul className="mx-auto max-w-[1280px] px-4 py-2 md:px-8">
          {items.map((item) => (
            <li key={item.label} className="border-b border-border last:border-b-0">
              <NavLink
                item={item}
                onClick={() => setOpen(false)}
                className="flex min-h-12 items-center justify-between py-2 text-lg font-medium tracking-tight text-foreground aria-[current=page]:text-primary aria-[current=true]:text-primary"
              />
            </li>
          ))}
        </ul>
      </nav>
    </details>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { resolveNav } from "./nav-items";
import { NavLink } from "./nav-links";

/**
 * Mobile nav (<1024px) as an accessible disclosure: a real <button> with
 * aria-expanded/aria-controls toggling a panel. Escape closes it and returns focus.
 * Without JS the footer still links every page.
 */
export function MobileMenu() {
  const pathname = usePathname() ?? "";
  const items = resolveNav(pathname);
  const [open, setOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(pathname);
  const buttonRef = useRef<HTMLButtonElement>(null);

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
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls="mobile-nav"
        onClick={() => {
          setOpenedAt(pathname);
          setOpen((v) => !v);
        }}
        className="inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-md px-2 font-mono text-xs uppercase tracking-[0.14em] text-foreground hover:bg-accent"
      >
        <span aria-hidden="true" className="relative block h-3 w-4">
          <span className={`absolute left-0 block h-px w-4 bg-current transition-transform duration-200 ${open ? "top-1.5 rotate-45" : "top-0"}`} />
          <span className={`absolute left-0 top-1.5 block h-px w-4 bg-current ${open ? "opacity-0" : ""}`} />
          <span className={`absolute left-0 block h-px w-4 bg-current transition-transform duration-200 ${open ? "top-1.5 -rotate-45" : "top-3"}`} />
        </span>
        Menu
      </button>
      <nav
        id="mobile-nav"
        aria-label="Primary"
        hidden={!open}
        className="absolute inset-x-0 top-full border-b border-border bg-background"
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
    </div>
  );
}

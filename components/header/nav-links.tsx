"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/lib/cx";
import { resolveNav, type ResolvedNavItem } from "./nav-items";

/**
 * One header link. Home anchors are plain <a> (in-page jumps) whose aria-current is
 * owned by the home NavSpy (components/home/nav-spy.tsx), so React never renders that attribute for them.
 */
export function NavLink({
  item,
  className,
  onClick,
}: {
  item: ResolvedNavItem;
  className?: string;
  onClick?: () => void;
}) {
  if (item.anchor) {
    return (
      <a href={item.href} data-nav-section={item.section} className={className} onClick={onClick}>
        {item.label}
      </a>
    );
  }
  return (
    <Link
      href={item.href}
      aria-current={item.current ? "page" : undefined}
      className={className}
      onClick={onClick}
    >
      {item.label}
    </Link>
  );
}

/** Desktop nav list (≥1024px). */
export function NavLinks() {
  const items = resolveNav(usePathname() ?? "");
  return (
    <ul className="hidden items-center lg:flex">
      {items.map((item) => (
        <li key={item.label}>
          <NavLink
            item={item}
            className={cx(
              "nav-link relative inline-flex min-h-11 items-center px-3 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground",
              // Hover: the active rule's 1px orange line grows in at half strength (the active item keeps 40px).
              "hover:after:w-6 hover:after:opacity-60 focus-visible:after:w-6 focus-visible:after:opacity-60",
              "aria-[current=page]:text-foreground aria-[current=true]:text-foreground",
            )}
          />
        </li>
      ))}
    </ul>
  );
}

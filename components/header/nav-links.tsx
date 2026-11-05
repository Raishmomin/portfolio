"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { resolveNav, type ResolvedNavItem } from "./nav-items";

/**
 * One header link. Home anchors are plain <a> (in-page jumps) whose aria-current is
 * owned by the cluster SectionSpy, so React never renders that attribute for them.
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
            className={cn(
              "nav-link relative inline-flex min-h-11 items-center px-3 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground",
              "aria-[current=page]:text-foreground aria-[current=true]:text-foreground",
            )}
          />
        </li>
      ))}
    </ul>
  );
}

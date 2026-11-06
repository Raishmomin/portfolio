// Header navigation (tasks/design-spec.md §3). On "/" the items with a home section
// become in-page anchors carrying data-nav-section (the cluster SectionSpy sets
// aria-current on them); everywhere else every item is a real page link.

export type NavItem = {
  label: string;
  /** The page this item stands for on subpages (also its active-state prefix). */
  page: string;
  /** Home section id (a cluster FormationKey) used as the anchor on "/". */
  section?: "about" | "experience" | "work" | "contact";
};

export const NAV_ITEMS: readonly NavItem[] = [
  { label: "Work", page: "/projects", section: "work" },
  { label: "Experience", page: "/experience", section: "experience" },
  { label: "Services", page: "/services" },
  { label: "Blog", page: "/blog" },
  { label: "About", page: "/about", section: "about" },
  { label: "Contact", page: "/contact", section: "contact" },
];

export type ResolvedNavItem = {
  label: string;
  href: string;
  /** In-page anchor on the home page (plain <a>, data-nav-section). */
  anchor: boolean;
  section?: string;
  current: boolean;
};

export function resolveNav(pathname: string): ResolvedNavItem[] {
  const home = pathname === "/";
  return NAV_ITEMS.map((item) => {
    const anchor = home && Boolean(item.section);
    return {
      label: item.label,
      href: anchor ? `#${item.section}` : item.page,
      anchor,
      section: anchor ? item.section : undefined,
      current: !home && (pathname === item.page || pathname.startsWith(`${item.page}/`)),
    };
  });
}

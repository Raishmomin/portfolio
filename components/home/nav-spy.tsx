"use client";

// Home scroll-spy for the header: the [data-section] crossing the middle of the viewport
// sets aria-current="true" on the nav anchor with the same data-nav-section key and
// clears it everywhere else (a section without a nav item clears it). The 3D stage
// tracks sections on its own; this works with or without it. Renders nothing.
import { useEffect } from "react";

function markNav(section: string) {
  document.querySelectorAll<HTMLElement>("[data-nav-section]").forEach((link) => {
    if (link.dataset.navSection === section) link.setAttribute("aria-current", "true");
    else link.removeAttribute("aria-current");
  });
}

export function NavSpy() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) markNav((entry.target as HTMLElement).dataset.section ?? "");
        }
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    document.querySelectorAll("main [data-section]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return null;
}

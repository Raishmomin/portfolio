"use client";

// One IntersectionObserver over the page's sections drives the monitor's formation
// and the header's aria-current; document-level delegation maps hover/focus on project
// cards and skill groups to scene focus. Renders nothing.
//
// Sections: [data-section] (formation keys) plus any other <section id> in <main>
// (services, writing, faq). Every centred section re-marks the nav, so one without a
// nav item clears aria-current; one without a formation keeps the formation of the
// nearest formation section above it (document order, so the result never depends on
// scroll direction).
import { useEffect } from "react";
import { clusterStore } from "./store";
import { FORMATION_KEYS, type FormationKey, type SkillGroupKey } from "./types";

const SECTIONS = new Set<string>(FORMATION_KEYS);
const GROUPS = new Set<string>(["frontend", "backend", "database", "devops"] satisfies SkillGroupKey[]);

function markNav(section: string) {
  document.querySelectorAll<HTMLElement>("[data-nav-section]").forEach((link) => {
    if (link.dataset.navSection === section) link.setAttribute("aria-current", "true");
    else link.removeAttribute("aria-current");
  });
}

function focusFrom(target: EventTarget | null) {
  const el = target instanceof Element ? target : null;
  const focusProject = el?.closest<HTMLElement>("[data-project-slug]")?.dataset.projectSlug ?? null;
  const group = el?.closest<HTMLElement>("[data-skill-group]")?.dataset.skillGroup;
  const focusGroup = group && GROUPS.has(group) ? (group as SkillGroupKey) : null;
  const s = clusterStore.getState();
  if (s.focusProject !== focusProject || s.focusGroup !== focusGroup) {
    clusterStore.setState({ focusProject, focusGroup });
  }
}

export function SectionSpy() {
  useEffect(() => {
    const formationOf = new Map<Element, FormationKey>();
    const navKey = new Map<Element, string>();
    let last: FormationKey = "hero";
    for (const el of document.querySelectorAll<HTMLElement>("[data-section], main section[id]")) {
      const key = el.dataset.section ?? el.id;
      if (SECTIONS.has(key)) last = key as FormationKey;
      formationOf.set(el, last);
      navKey.set(el, key);
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const section = formationOf.get(entry.target);
          if (section && clusterStore.getState().section !== section) clusterStore.setState({ section });
          markNav(navKey.get(entry.target) ?? "");
        }
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    formationOf.forEach((_, el) => io.observe(el));

    const enter = (e: Event) => focusFrom(e.target);
    // relatedTarget is where the pointer/focus went: null or outside a card clears the focus.
    const leave = (e: Event) => focusFrom((e as PointerEvent | FocusEvent).relatedTarget);
    document.addEventListener("pointerover", enter, { passive: true });
    document.addEventListener("pointerout", leave, { passive: true });
    document.addEventListener("focusin", enter);
    document.addEventListener("focusout", leave);
    return () => {
      io.disconnect();
      document.removeEventListener("pointerover", enter);
      document.removeEventListener("pointerout", leave);
      document.removeEventListener("focusin", enter);
      document.removeEventListener("focusout", leave);
    };
  }, []);
  return null;
}

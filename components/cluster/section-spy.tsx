"use client";

// One IntersectionObserver over [data-section] drives the monitor's formation and
// the header's aria-current; document-level delegation maps hover/focus on project
// cards and skill groups to scene focus. Renders nothing.
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
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const key = (entry.target as HTMLElement).dataset.section;
          if (!entry.isIntersecting || !key || !SECTIONS.has(key)) continue;
          if (clusterStore.getState().section !== key) clusterStore.setState({ section: key as FormationKey });
          markNav(key);
        }
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    document.querySelectorAll("[data-section]").forEach((el) => io.observe(el));

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

"use client";

import { useSyncExternalStore } from "react";

/*
 * Color theme without a provider: the head script (components/reveal.tsx) applies the
 * saved choice before first paint — localStorage "theme" = "light" | "dark" | "system",
 * default dark — as the html class plus color-scheme. This toggle reads the class,
 * writes both and persists the choice. The 3D scene follows the html class on its own.
 */
const KEY = "theme";
type Theme = "light" | "dark";

function apply(theme: Theme) {
  const root = document.documentElement;
  // Switch without animating every color transition on the page.
  const freeze = document.createElement("style");
  freeze.textContent = "*,*::before,*::after{transition:none!important}";
  document.head.appendChild(freeze);
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  root.style.colorScheme = theme;
  window.getComputedStyle(document.body).getPropertyValue("opacity"); // flush styles while transitions are off
  setTimeout(() => freeze.remove(), 1);
}

function subscribe(onChange: () => void) {
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  // Another tab changed the theme.
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY && (e.newValue === "light" || e.newValue === "dark")) apply(e.newValue);
  };
  window.addEventListener("storage", onStorage);
  return () => {
    mo.disconnect();
    window.removeEventListener("storage", onStorage);
  };
}
const getSnapshot = () => document.documentElement.classList.contains("dark");
// The server cannot know the theme: aria-pressed is set once hydrated (no mismatch).
const getServerSnapshot = () => null;

/** Dark-theme switch: a toggle button whose pressed state is the dark theme. Icons swap with the `dark` class. */
export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggle() {
    const next: Theme = document.documentElement.classList.contains("dark") ? "light" : "dark";
    apply(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // storage blocked: the choice still applies to this page view
    }
  }

  return (
    <button
      type="button"
      aria-label="Dark theme"
      aria-pressed={dark ?? undefined}
      title={dark === null ? "Toggle color theme" : dark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={toggle}
      className="js-only inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
    >
      {/* sun: shown in dark mode (switch to light) */}
      <svg aria-hidden="true" viewBox="0 0 24 24" className="hidden h-4 w-4 dark:block" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
      {/* moon: shown in light mode */}
      <svg aria-hidden="true" viewBox="0 0 24 24" className="block h-4 w-4 dark:hidden" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
      </svg>
    </button>
  );
}

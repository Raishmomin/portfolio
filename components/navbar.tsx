"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from "framer-motion";
import { Moon, Sun, Menu, X, Github, Linkedin, Mail } from "lucide-react";
import { useTheme } from "next-themes";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { usePersonalStore } from "@/lib/zutand";
import { NAV_SECTIONS, PAGES, SITE } from "@/lib/config";
import { cn } from "@/lib/utils";

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState<string>("home");
  const [hovered, setHovered] = useState<string | null>(null);
  const { theme, setTheme } = useTheme();
  const { value } = usePersonalStore();
  const { scrollY } = useScroll();
  const pathname = usePathname();
  const isHome = pathname === "/";

  useEffect(() => setMounted(true), []);

  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 24));

  // Hash-based active detection — only on home page
  useEffect(() => {
    if (!isHome) return;
    const sections = NAV_SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean);
    if (!sections.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(e.target.id);
        });
      },
      { rootMargin: "-40% 0px -55% 0px", threshold: 0 }
    );
    sections.forEach((s) => s && observer.observe(s));
    return () => observer.disconnect();
  }, [isHome]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const github = value?.personalData?.[0]?.git_hub || SITE.github;
  const linkedin = value?.personalData?.[0]?.linkdin || SITE.linkedin;
  const email = value?.personalData?.[0]?.email || SITE.email;

  const toggleTheme = () =>
    setTheme(theme === "dark" ? "light" : "dark");

  // Determine nav items based on current page
  const navItems = isHome
    ? NAV_SECTIONS.map((s) => ({ href: `#${s.id}`, label: s.label, key: s.id }))
    : PAGES.map((p) => ({ href: p.path, label: p.label, key: p.path }));

  const isActive = (key: string) => {
    if (isHome) return active === key;
    return pathname === key;
  };

  return (
    <>
      <motion.nav
        role="navigation"
        aria-label="Main"
        initial={{ y: -64, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="fixed top-0 inset-x-0 z-50 flex justify-center pointer-events-none"
      >
        <motion.div
          animate={{
            paddingTop: scrolled ? 12 : 24,
            paddingBottom: scrolled ? 12 : 24,
          }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-6xl px-4 sm:px-6 lg:px-8 pointer-events-auto"
        >
          <motion.div
            animate={{
              backgroundColor: scrolled
                ? "hsl(var(--background) / 0.7)"
                : "hsl(var(--background) / 0)",
              borderColor: scrolled
                ? "hsl(var(--border))"
                : "hsl(var(--border) / 0)",
            }}
            transition={{ duration: 0.3 }}
            className={cn(
              "flex items-center justify-between gap-4 px-4 py-3 rounded-full border backdrop-blur-xl"
            )}
          >
            <Link
              href="/"
              className="flex items-center gap-3 group"
              aria-label={`${SITE.name} — home`}
            >
              <span className="grid place-items-center w-8 h-8 rounded-lg bg-foreground text-background font-bold text-sm tracking-tight">
                R
              </span>
              <span className="font-semibold tracking-tight text-sm hidden sm:block">
                {SITE.name}
              </span>
            </Link>

            <ul className="hidden md:flex items-center gap-1 relative">
              {navItems.map((item) => {
                const itemActive = isActive(item.key);
                const isHover = hovered === item.key;
                const Tag = isHome ? "a" : Link;
                return (
                  <li key={item.key} className="relative">
                    <Tag
                      href={item.href}
                      onMouseEnter={() => setHovered(item.key)}
                      onMouseLeave={() => setHovered(null)}
                      className={cn(
                        "relative inline-flex items-center px-3 py-1.5 text-sm transition-colors duration-200 rounded-md",
                        itemActive
                          ? "text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {isHover && (
                        <motion.span
                          layoutId="nav-hover"
                          className="absolute inset-0 rounded-md bg-muted"
                          transition={{ type: "spring", stiffness: 350, damping: 30 }}
                        />
                      )}
                      <span className="relative z-10">{item.label}</span>
                      {itemActive && (
                        <motion.span
                          layoutId="nav-active-dot"
                          className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-foreground"
                          transition={{ type: "spring", stiffness: 400, damping: 32 }}
                        />
                      )}
                    </Tag>
                  </li>
                );
              })}
            </ul>

            <div className="flex items-center gap-1">
              <a
                href={github}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
                className="hidden sm:grid place-items-center w-9 h-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <Github className="w-4 h-4" />
              </a>
              <a
                href={linkedin}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                className="hidden sm:grid place-items-center w-9 h-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <Linkedin className="w-4 h-4" />
              </a>
              <button
                onClick={toggleTheme}
                aria-label="Toggle theme"
                className="grid place-items-center w-9 h-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                {mounted && theme === "dark" ? (
                  <Sun className="w-4 h-4" />
                ) : (
                  <Moon className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={() => setIsOpen(true)}
                aria-label="Open menu"
                aria-expanded={isOpen}
                className="md:hidden grid place-items-center w-9 h-9 rounded-md text-foreground hover:bg-muted transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      </motion.nav>

      {/* Mobile drawer */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="md:hidden fixed inset-0 z-[55] bg-background/80 backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
            />
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label="Mobile menu"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 280, damping: 32 }}
              className="md:hidden fixed top-0 right-0 bottom-0 z-[56] w-full max-w-sm bg-background border-l border-border flex flex-col"
            >
              <div className="flex items-center justify-between p-6 border-b border-border">
                <span className="font-semibold tracking-tight">Menu</span>
                <button
                  onClick={() => setIsOpen(false)}
                  aria-label="Close menu"
                  className="grid place-items-center w-9 h-9 rounded-md hover:bg-muted transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="flex-1 p-6">
                <ul className="space-y-1">
                  {navItems.map((item, i) => {
                    const Tag = isHome ? "a" : Link;
                    return (
                      <motion.li
                        key={item.key}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 + i * 0.05, duration: 0.4 }}
                      >
                        <Tag
                          href={item.href}
                          onClick={() => setIsOpen(false)}
                          className={cn(
                            "flex items-center justify-between py-4 text-2xl font-semibold tracking-tight border-b border-border/50 transition-colors",
                            isActive(item.key)
                              ? "text-foreground"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <span>{item.label}</span>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                        </Tag>
                      </motion.li>
                    );
                  })}
                </ul>
              </nav>

              <div className="p-6 border-t border-border flex items-center gap-3">
                <a
                  href={github}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="GitHub"
                  className="grid place-items-center w-10 h-10 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <Github className="w-4 h-4" />
                </a>
                <a
                  href={linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn"
                  className="grid place-items-center w-10 h-10 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <Linkedin className="w-4 h-4" />
                </a>
                <a
                  href={`mailto:${email}`}
                  aria-label="Email"
                  className="grid place-items-center w-10 h-10 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <Mail className="w-4 h-4" />
                </a>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

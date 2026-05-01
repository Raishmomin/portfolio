"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Github, Linkedin, Mail, ArrowUp } from "lucide-react";
import { usePersonalStore } from "@/lib/zutand";
import { SITE, NAV_SECTIONS } from "@/lib/config";

export function Footer() {
  const { value } = usePersonalStore();
  const reduce = useReducedMotion();

  const github = value?.personalData?.[0]?.git_hub || SITE.github;
  const linkedin = value?.personalData?.[0]?.linkdin || SITE.linkedin;
  const email = value?.personalData?.[0]?.email || SITE.email;

  return (
    <footer
      role="contentinfo"
      className="relative border-t border-border overflow-hidden"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 mb-16">
          <div className="md:col-span-6">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-6">
              Currently
            </p>
            <p className="text-2xl md:text-3xl font-medium tracking-tight max-w-md leading-snug">
              Open to senior engineering roles, freelance, and meaningful
              collaborations.
            </p>
            <a
              href={`mailto:${email}`}
              className="mt-8 inline-flex items-center gap-2 text-sm border-b border-foreground/40 pb-1 hover:border-foreground transition-colors"
            >
              <Mail className="w-4 h-4" aria-hidden="true" />
              {email}
            </a>
          </div>

          <nav
            aria-label="Footer"
            className="md:col-span-3 md:col-start-8"
          >
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-6">
              Sitemap
            </p>
            <ul className="space-y-3">
              {NAV_SECTIONS.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="md:col-span-3">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-6">
              Elsewhere
            </p>
            <ul className="space-y-3">
              <li>
                <a
                  href={github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Github className="w-3.5 h-3.5" aria-hidden="true" />
                  GitHub
                </a>
              </li>
              <li>
                <a
                  href={linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Linkedin className="w-3.5 h-3.5" aria-hidden="true" />
                  LinkedIn
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${email}`}
                  className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Mail className="w-3.5 h-3.5" aria-hidden="true" />
                  Email
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>
            © {new Date().getFullYear()} {SITE.name}. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <span className="inline-flex items-center gap-2">
              <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              Available
            </span>
            <a
              href="#home"
              className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors group"
              aria-label="Back to top"
            >
              <span>Back to top</span>
              <ArrowUp
                className="w-3.5 h-3.5 transition-transform group-hover:-translate-y-0.5"
                aria-hidden="true"
              />
            </a>
          </div>
        </div>
      </div>

      <motion.div
        aria-hidden="true"
        initial={reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.1 }}
        transition={{ duration: reduce ? 0 : 1.2, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full overflow-hidden select-none"
      >
        <div
          aria-hidden
          className="pointer-events-none select-none overflow-hidden leading-none h-[14vw] md:h-[11vw] relative"
        >
          <div
            className="absolute left-1/2 -translate-x-1/2 bottom-[-6vw] md:bottom-[-5vw] whitespace-nowrap text-[22vw] md:text-[18vw] font-bold tracking-[-0.04em] text-transparent bg-clip-text"
            style={{
              backgroundImage:
                "linear-gradient(180deg, hsl(var(--foreground) / 0.8), hsl(var(--foreground) / 0.01))",
            }}
          >
            {SITE.name}
          </div>
        </div>
      </motion.div>
    </footer>
  );
}

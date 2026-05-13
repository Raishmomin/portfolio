import Link from "next/link";
import { Github, Linkedin, Mail, ArrowRight } from "lucide-react";
import { SITE } from "@/lib/config";

export function AuthorBio() {
  return (
    <aside
      className="mt-16 p-6 md:p-8 rounded-2xl border border-border bg-card"
      aria-label="About the author"
    >
      <div className="flex items-start gap-5">
        <div
          aria-hidden="true"
          className="shrink-0 grid place-items-center w-14 h-14 rounded-full bg-foreground text-background font-semibold text-xl tracking-tight"
        >
          R
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base md:text-lg font-semibold tracking-tight text-foreground">
            Written by {SITE.name}
          </h2>
          <p className="mt-2 text-sm md:text-base text-muted-foreground leading-relaxed">
            {SITE.jobTitle}. 4+ years shipping production Next.js, Node.js, and AWS infrastructure
            for SaaS, e-commerce, and internal platforms. Available for freelance{" "}
            <Link
              href="/services/nextjs-development"
              className="text-foreground underline underline-offset-4 hover:text-foreground/70"
            >
              Next.js
            </Link>
            ,{" "}
            <Link
              href="/services/mern-stack-development"
              className="text-foreground underline underline-offset-4 hover:text-foreground/70"
            >
              MERN
            </Link>
            ,{" "}
            <Link
              href="/services/devops-aws-consulting"
              className="text-foreground underline underline-offset-4 hover:text-foreground/70"
            >
              DevOps
            </Link>
            , and{" "}
            <Link
              href="/services/api-backend-development"
              className="text-foreground underline underline-offset-4 hover:text-foreground/70"
            >
              API
            </Link>{" "}
            engagements.
          </p>
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <Link
              href="/contact"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-foreground text-background text-xs font-medium hover:opacity-90 transition-opacity"
            >
              Work with me
              <ArrowRight className="w-3 h-3" />
            </Link>
            {SITE.github && (
              <a
                href={SITE.github}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
                className="grid place-items-center w-9 h-9 rounded-full border border-border text-muted-foreground hover:text-foreground transition-colors"
              >
                <Github className="w-3.5 h-3.5" />
              </a>
            )}
            {SITE.linkedin && (
              <a
                href={SITE.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                className="grid place-items-center w-9 h-9 rounded-full border border-border text-muted-foreground hover:text-foreground transition-colors"
              >
                <Linkedin className="w-3.5 h-3.5" />
              </a>
            )}
            {SITE.email && (
              <a
                href={`mailto:${SITE.email}`}
                aria-label="Email"
                className="grid place-items-center w-9 h-9 rounded-full border border-border text-muted-foreground hover:text-foreground transition-colors"
              >
                <Mail className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

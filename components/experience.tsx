import { Section, RevealHeading } from "./section";
import { ExperienceCarousel } from "./experience-carousel";
import { cn } from "@/lib/utils";
import type { ExperienceItem } from "@/lib/data";

type ExperienceProps = {
  items: ExperienceItem[];
  headingAs?: "h1" | "h2";
};

export function Experience({ items, headingAs = "h2" }: ExperienceProps) {
  // Keep the outline continuous: h1 page -> h2 roles, h2 section -> h3 roles.
  const RoleHeading = headingAs === "h1" ? "h2" : "h3";

  return (
    <Section id="experience" ariaLabel="Experience" reveal={headingAs !== "h1"}>
      <ExperienceCarousel
        itemCount={items.length}
        heading={
          <RevealHeading
            as={headingAs}
            id="experience"
            eyebrow="Experience"
            title="A working timeline."
            description="Roles, projects, and the through-line that connects them."
            className="mb-0"
          />
        }
      >
        {items.map((exp, i) => (
          <article
            key={i}
            className={cn(
              "snap-start shrink-0 w-[88vw] sm:w-[440px] rounded-2xl border border-border bg-card p-8 flex flex-col gap-6",
              "transition-colors hover:border-foreground/40"
            )}
          >
            <header className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
                  {exp.company}
                </div>
                <RoleHeading className="text-xl font-semibold tracking-tight text-foreground">
                  {exp.title}
                </RoleHeading>
              </div>
              <div className="text-3xl font-semibold tracking-tight tabular-nums shrink-0 text-foreground/40">
                {String(i + 1).padStart(2, "0")}
              </div>
            </header>

            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              {exp.period}
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              {exp.description}
            </p>

            {exp.achievements.length > 0 && (
              <ul className="space-y-2 pl-0 text-sm text-foreground/80">
                {exp.achievements.slice(0, 3).map((a, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="mt-2 block w-3 h-px bg-foreground/40 shrink-0" />
                    <span className="leading-relaxed">{a}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-wrap gap-1.5 mt-auto pt-4 border-t border-border">
              {exp.technologies.map((t, idx) => (
                <span
                  key={idx}
                  className="text-[11px] px-2.5 py-1 rounded-full border border-border text-muted-foreground"
                >
                  {t}
                </span>
              ))}
            </div>
          </article>
        ))}
      </ExperienceCarousel>
    </Section>
  );
}

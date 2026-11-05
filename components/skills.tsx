import { Section, RevealHeading } from "./section";
import { Reveal } from "./reveal";
import type { SkillGroup } from "@/lib/data";

type SkillsProps = {
  groups: SkillGroup[];
  headingAs?: "h1" | "h2";
};

export function Skills({ groups, headingAs = "h2" }: SkillsProps) {
  // Keep the outline continuous: h1 page -> h2 groups, h2 section -> h3 groups.
  const GroupHeading = headingAs === "h1" ? "h2" : "h3";

  return (
    <Section
      id="skills"
      ariaLabel="Skills"
      className="bg-muted/30"
      reveal={headingAs !== "h1"}
    >
      <RevealHeading
        as={headingAs}
        id="skills"
        eyebrow="Skills"
        title="Tools I reach for."
        description="A working stack honed across years of shipping. Comfortable across the stack, opinionated where it matters."
      />

      <div className="space-y-6 mask-edge-x">
        {groups.map(({ category, skills }, idx) => {
          const doubled = [...skills, ...skills];
          const isReverse = idx % 2 === 1;
          return (
            <Reveal key={category} delay={idx * 0.08} className="group relative">
              <div className="flex items-baseline justify-between mb-3">
                <GroupHeading className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                  {category}
                </GroupHeading>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {String(skills.length).padStart(2, "0")} tools
                </span>
              </div>
              <div className="overflow-hidden border-y border-border py-4">
                {/* Reduced motion is handled by the global prefers-reduced-motion rule. */}
                <div
                  className="flex gap-4 will-change-transform hover:[animation-play-state:paused]"
                  // Longhands, not the `animation` shorthand: the shorthand would reset
                  // animation-play-state inline and defeat the hover-pause class.
                  style={{
                    width: "max-content",
                    animationName: "marquee",
                    animationDuration: `${30 + idx * 6}s`,
                    animationTimingFunction: "linear",
                    animationIterationCount: "infinite",
                    animationDirection: isReverse ? "reverse" : "normal",
                  }}
                >
                  {doubled.map((s, i) => (
                    <SkillChip
                      key={`${s.name}-${i}`}
                      name={s.name}
                      level={s.level}
                      hidden={i >= skills.length}
                    />
                  ))}
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </Section>
  );
}

function SkillChip({ name, level, hidden }: { name: string; level: number; hidden: boolean }) {
  return (
    <div
      aria-hidden={hidden || undefined}
      className="group/chip flex items-center gap-3 px-5 py-3 rounded-full border border-border bg-background hover:bg-foreground hover:text-background hover:border-foreground transition-colors duration-300 whitespace-nowrap"
    >
      <span className="text-sm font-medium tracking-tight">{name}</span>
      <span className="text-[10px] tabular-nums text-muted-foreground group-hover/chip:text-background/70">
        {level}
      </span>
    </div>
  );
}

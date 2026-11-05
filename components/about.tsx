import { Section, RevealHeading } from "./section";
import { CountUp } from "./count-up";
import { Tilt } from "./tilt-card";
import { Reveal } from "./reveal";
import { SITE } from "@/lib/config";
import type { Personal } from "@/lib/data";

type AboutProps = {
  personal: Personal;
  projectCount: number;
  headingAs?: "h1" | "h2";
};

export function About({ personal, projectCount, headingAs = "h2" }: AboutProps) {
  const stats = [
    { label: "Years experience", value: personal.years, suffix: "+" },
    { label: "Projects shipped", value: projectCount, suffix: "+" },
    { label: "Happy clients", value: 10, suffix: "+" },
    { label: "Coffee · ∞", value: 0, suffix: "", static: "∞" },
  ];

  return (
    <Section id="about" ariaLabel="About" reveal={headingAs !== "h1"}>
      <RevealHeading
        as={headingAs}
        id="about"
        eyebrow="About"
        title="A developer obsessed with detail."
        description="Curious by default, methodical by training. I care about how things feel as much as how they ship."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
        <div className="lg:col-span-7 space-y-8">
          <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
            {personal.about}
          </p>
          <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
            Whether it&apos;s architecting backend systems, tuning database queries, or
            polishing pixel-perfect interfaces — I bring the same attention to every layer.
          </p>

          <div className="grid grid-cols-2 gap-px bg-border mt-12">
            {stats.map((s, i) => (
              <Reveal key={i} y={12} delay={i * 0.08} className="bg-background p-6">
                <div className="text-3xl md:text-5xl font-semibold tracking-tight tabular-nums">
                  {s.static ? (
                    s.static
                  ) : (
                    <CountUp to={s.value} suffix={s.suffix} />
                  )}
                </div>
                <div className="mt-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  {s.label}
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5">
          <Tilt className="relative">
            <div className="relative rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30" />
                <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30" />
                <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30" />
                <span className="ml-3 text-xs text-muted-foreground font-mono">
                  ~/developer.ts
                </span>
              </div>
              <pre className="p-6 font-mono text-[13px] leading-relaxed text-muted-foreground overflow-x-auto">
                <code>{`const developer = {
  name: '${SITE.name}',
  role: '${SITE.jobTitle}',
  stack: ['React', 'Node', 'TypeScript', 'AWS'],
  status: 'open to work',
  shipping: true,
};

export default developer;`}</code>
              </pre>
              <div className="px-6 py-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-foreground opacity-50" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-foreground" />
                  </span>
                  Available
                </span>
                <span className="font-mono">v4.2.0</span>
              </div>
            </div>
          </Tilt>
        </div>
      </div>
    </Section>
  );
}

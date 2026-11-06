import Link from "next/link";
import { Accent, Container, Section } from "../../ui/primitives";
import { Portrait } from "../../ui/portrait";
import { SubsectionHeading, TEXT_LINK } from "./subpage";
import { count, reveal } from "../motion";
import type { Personal } from "@/lib/data";

/** Bio from the DB plus three stats computed from real data (the server HTML holds the final figures). */
export function AboutBio({
  personal,
  projectCount,
  skillCount,
}: {
  personal: Personal;
  projectCount: number;
  skillCount: number;
}) {
  const stats = [
    { value: personal.yearsLabel, n: personal.years, label: "Years experience" },
    { value: String(projectCount), n: projectCount, label: "Projects shipped" },
    { value: String(skillCount), n: skillCount, label: "Technologies in the stack" },
  ];

  return (
    <Section section="about" id="bio" aria-labelledby="bio-heading">
      <Container className="grid gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="min-w-0 lg:col-span-7">
          <SubsectionHeading kicker="01 · bio" id="bio-heading">
            From interface <Accent>to infrastructure.</Accent>
          </SubsectionHeading>
          <div className="mt-6 max-w-[68ch] space-y-5 text-[17px] leading-7 text-muted-foreground" {...reveal(1)}>
            <p className="text-foreground">{personal.about}</p>
            <p>
              Whether it&apos;s architecting backend systems, tuning database queries, or polishing
              pixel-perfect interfaces — I bring the same attention to every layer.
            </p>
          </div>
        </div>

        <div className="min-w-0 lg:col-span-5" {...reveal(2)}>
          <figure className="mb-6 overflow-hidden rounded-xl border border-border bg-card">
            <Portrait size={400} sizes="(min-width: 1024px) 400px, 100vw" className="aspect-square h-auto w-full" />
            <figcaption className="border-t border-border px-4 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Raish Momin · Ahmedabad, India
            </figcaption>
          </figure>
          <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-border bg-border">
            {stats.map((s) => (
              <div key={s.label} className="flex min-w-0 flex-col-reverse justify-end gap-2 bg-background p-3 sm:p-4 md:p-6">
                <dt className="font-mono text-[10px] uppercase leading-4 tracking-[0.08em] text-muted-foreground sm:text-[11px] sm:tracking-[0.12em]">
                  {s.label}
                </dt>
                <dd className="text-3xl font-semibold tabular-nums tracking-[-0.03em] text-foreground md:text-5xl" {...count(s.n)}>
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <Link href="/projects" className={`inline-flex min-h-11 items-center ${TEXT_LINK}`}>
              All {projectCount} projects →
            </Link>
            <Link href="/skills" className={`inline-flex min-h-11 items-center ${TEXT_LINK}`}>
              The stack map →
            </Link>
          </p>
        </div>
      </Container>
    </Section>
  );
}

// /services list: one editorial row per service, linking to /services/<slug>.
import Link from "next/link";
import type { ServiceConfig } from "@/lib/services";
import { Container, PillList } from "../../ui/primitives";

const lastWord = (text: string) => text.slice(text.lastIndexOf(" ") + 1);
const lead = (text: string) => text.slice(0, text.lastIndexOf(" ") + 1);

export function ServiceIndex({ services }: { services: ServiceConfig[] }) {
  return (
    <section aria-label="Services" className="border-t border-border">
      <Container>
        <ol>
          {services.map((s, i) => (
            <li
              key={s.slug}
              className="relative grid gap-5 border-b border-border py-10 md:grid-cols-12 md:gap-8 md:py-12"
            >
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground tabular-nums md:col-span-1">
                {String(i + 1).padStart(2, "0")}
              </p>
              <div className="min-w-0 md:col-span-7">
                <h2 className="text-[clamp(1.5rem,3vw,2.25rem)] font-semibold leading-[1.1] tracking-[-0.025em] text-foreground">
                  <Link
                    href={`/services/${s.slug}`}
                    className="group/link rounded-sm after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
                  >
                    {lead(s.h1)}
                    {/* The last word and the arrow never wrap apart. */}
                    <span className="whitespace-nowrap">
                      {lastWord(s.h1)}
                      <span
                        aria-hidden="true"
                        className="ml-2 inline-block text-muted-foreground transition-[transform,color] duration-150 group-hover/link:translate-x-0.5 group-hover/link:text-primary"
                      >
                        →
                      </span>
                    </span>
                  </Link>
                </h2>
                <p className="mt-3 max-w-[60ch] text-[17px] leading-7 text-muted-foreground">{s.tagline}</p>
                <PillList items={s.techStack.slice(0, 6)} label={`${s.h1} stack`} className="mt-5" />
              </div>
              <dl className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground md:col-span-4 md:text-right">
                <dt>From</dt>
                <dd className="mt-1 text-base normal-case tracking-normal text-foreground tabular-nums">{s.pricing.from}</dd>
                <dt className="sr-only">Engagement model</dt>
                <dd className="mt-2 font-sans text-sm normal-case leading-6 tracking-normal md:ml-auto md:max-w-[34ch]">{s.pricing.model}</dd>
              </dl>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

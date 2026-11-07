// /services list, "right" composition: the engagements run down the right column while the
// services scene builds the one at the reading line (or under the pointer / keyboard focus)
// as a working system on the left; the [data-arch] spy lights that card, so the two always
// agree. Each title is a real link stretched over its card. Without motion: a plain list.
import Link from "next/link";
import type { ServiceConfig } from "@/lib/services";
import { Accent } from "../../ui/primitives";
import { PageSection, PopPills, SectionHead, card, column, lit, nn, part, type PageScene } from "../ui";

const lastWord = (text: string) => text.slice(text.lastIndexOf(" ") + 1);
const lead = (text: string) => text.slice(0, text.lastIndexOf(" ") + 1);
/** The services scene (a stage scene key the shared PageScene type does not list yet). */
export const SERVICES_SCENE = "services" as PageScene;

export function ServiceIndex({ services }: { services: ServiceConfig[] }) {
  return (
    <PageSection id="engagements" section="engagements" scene={SERVICES_SCENE} stage="right" labelledBy="engagements-heading">
      <div className={column.right}>
        <div {...card()} className="panel p-6 md:p-8">
          <SectionHead
            id="engagements-heading"
            index="01"
            kicker="engagements"
            title={
              <>
                {services.length} ways to <Accent>work together.</Accent>
              </>
            }
            scene="The 3D scene builds each engagement as the system it delivers. Scroll the list or point at one to switch."
            lead="Each one has a fixed starting price and a clear scope. Pick the closest fit; the details page shows the process, deliverables and FAQ."
          />
        </div>
        <ol data-arch="" data-card-group="" className="svc-list svc-list-r mt-4 grid grid-cols-1 gap-4">
          {services.map((s, i) => (
            <li key={s.slug} {...card()} data-arch-item="" data-focus-id={`service:${s.slug}`} className="svc-item relative flex">
              <article {...lit} className="panel group relative flex w-full flex-col p-6 transition-colors duration-150 hover:border-foreground/30 md:p-8">
                <span aria-hidden="true" className="svc-bar" />
                <p {...part} className="flex items-baseline justify-between gap-4 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground tabular-nums">
                  <span className="svc-num">
                    <span className="text-foreground">{nn(i + 1)}</span> / {nn(services.length)}
                  </span>
                  <span>{s.serviceType}</span>
                </p>
                <h3 {...part} className="mt-5 text-[clamp(1.5rem,2.6vw,2rem)] font-semibold leading-[1.1] tracking-[-0.025em] text-foreground">
                  <Link
                    href={`/services/${s.slug}`}
                    className="rounded-sm after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
                  >
                    {lead(s.h1)}
                    {/* The last word and the arrow never wrap apart. */}
                    <span className="whitespace-nowrap">
                      {lastWord(s.h1)}
                      <span
                        aria-hidden="true"
                        className="ml-2 inline-block text-muted-foreground transition-[transform,color] duration-150 group-hover:translate-x-1 group-hover:text-primary"
                      >
                        →
                      </span>
                    </span>
                  </Link>
                </h3>
                <p {...part} className="mt-3 text-[17px] leading-7 text-muted-foreground">
                  {s.tagline}
                </p>
                <PopPills items={s.techStack.slice(0, 6)} label={`${s.h1} stack`} className="mb-6 mt-5" pillClassName="svc-chip" />
                <dl {...part} className="mt-auto flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-border pt-5">
                  <div className="flex items-baseline gap-2">
                    <dt className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">From</dt>
                    <dd className="text-base text-foreground tabular-nums">{s.pricing.from}</dd>
                  </div>
                  <dt className="sr-only">Engagement model</dt>
                  <dd className="text-sm leading-6 text-muted-foreground">{s.pricing.model}</dd>
                </dl>
              </article>
              <span aria-hidden="true" className="svc-wire" />
            </li>
          ))}
        </ol>
      </div>
    </PageSection>
  );
}

// Home Services section (lane-owned: fm3-services). Server Component.
import Link from "next/link";
import type { CSSProperties } from "react";
import { Accent } from "../ui/primitives";
import type { ServiceConfig } from "@/lib/services";
import { cn } from "@/lib/utils";
import { HomeSection, SectionHead, column, panel } from "./ui";

/** "AWS (EC2, ECS, …)" -> "AWS": a short chip label for a service's stack entry. */
const chipLabel = (t: string) => t.replace(/\s*\(.*?\)/g, "").trim();
const nn = (n: number) => String(n).padStart(2, "0");

/**
 * "right" composition: the cards run down the right column while the services scene builds
 * each engagement as a working system on the left. The [data-arch] spy marks the card at the
 * reading line (or under the pointer / keyboard focus) as active: the scene shows that
 * service and the card lights up, so the two always agree. Without motion it is a plain list.
 */
export function ServicesSection({ services }: { services: ServiceConfig[] }) {
  return (
    <HomeSection id="services" section="services" stage="right" scene labelledBy="services-heading">
      <div className={column.right}>
        <div data-card="" className={cn(panel, "p-6 md:p-8")}>
          <SectionHead
            id="services-heading"
            index="05"
            kicker="services"
            title={
              <>
                Ways to <Accent>work together.</Accent>
              </>
            }
            scene="The 3D scene builds each service as the system it delivers. Scroll the list or point at a card to switch."
          />
        </div>
        <ul data-arch="" data-card-group="" className="svc-list svc-list-r mt-4 grid grid-cols-1 gap-4">
          {services.map((s, i) => (
            <li key={s.slug} data-card="flip" data-arch-item="" data-focus-id={`service:${s.slug}`} className="svc-item relative flex">
              <Link
                href={`/services/${s.slug}`}
                data-tilt="3"
                data-spotlight=""
                className={cn(panel, "group flex w-full flex-col p-5 transition-colors duration-150 hover:border-foreground/30 md:p-6")}
              >
                <span aria-hidden="true" className="svc-bar" />
                <span data-card-part="" className="flex items-baseline justify-between gap-4 font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground tabular-nums">
                  <span className="svc-num shrink-0 whitespace-nowrap">
                    {nn(i + 1)} / {nn(services.length)}
                  </span>
                  <span className="min-w-0 truncate">{s.serviceType}</span>
                </span>
                <h3
                  data-card-part=""
                  className="mt-3 text-[clamp(1.25rem,1.9vw,1.5rem)] font-semibold leading-tight tracking-[-0.02em] text-foreground transition-colors duration-150 group-hover:text-primary"
                >
                  {s.h1}
                </h3>
                <span data-card-part="" className="mt-2 block text-[15px] leading-6 text-muted-foreground">
                  {s.tagline}
                </span>
                <span className="mt-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
                  <span data-card-part="pop" className="flex flex-wrap gap-1.5">
                    {s.techStack.slice(0, 4).map((t, k) => (
                      <span key={t} className="pill svc-chip" style={{ "--k": k } as CSSProperties}>
                        {chipLabel(t)}
                      </span>
                    ))}
                  </span>
                  <span data-card-part="" className="inline-flex items-center gap-1 text-sm font-medium text-foreground">
                    Explore
                    <span aria-hidden="true" className="transition-[translate] duration-200 group-hover:translate-x-2">
                      →
                    </span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </HomeSection>
  );
}

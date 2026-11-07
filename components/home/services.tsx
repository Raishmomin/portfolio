// Home Services section (lane-owned: fm3-services). Server Component.
import Link from "next/link";
import { Accent } from "../ui/primitives";
import type { ServiceConfig } from "@/lib/services";
import { cn } from "@/lib/utils";
import { HomeSection, SectionHead, column, panel } from "./ui";

/** "AWS (EC2, ECS, …)" -> "AWS": a short chip label for a service's stack entry. */
const chipLabel = (t: string) => t.replace(/\s*\(.*?\)/g, "").trim();

/** "right" composition over the ambient field: four service cards flip in from depth. */
export function ServicesSection({ services }: { services: ServiceConfig[] }) {
  return (
    <HomeSection id="services" section="services" stage="right" labelledBy="services-heading">
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
          />
        </div>
        <ul data-card-group="" className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {services.map((s, i) => (
            <li key={s.slug} data-card="flip" className="flex">
              <Link
                href={`/services/${s.slug}`}
                data-tilt="4"
                data-spotlight=""
                className={cn(panel, "group flex w-full flex-col p-5 transition-colors duration-150 hover:border-foreground/30")}
              >
                <span data-card-part="" className="font-mono text-xs text-muted-foreground tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3
                  data-card-part=""
                  className="mt-3 text-lg font-semibold leading-6 tracking-[-0.015em] text-foreground transition-colors duration-150 group-hover:text-primary"
                >
                  {s.h1}
                </h3>
                <span data-card-part="" className="mt-2 block text-[15px] leading-6 text-muted-foreground">
                  {s.tagline}
                </span>
                <span data-card-part="pop" className="mt-4 flex flex-wrap gap-1.5">
                  {s.techStack.slice(0, 3).map((t) => (
                    <span key={t} className="pill">
                      {chipLabel(t)}
                    </span>
                  ))}
                </span>
                <span
                  data-card-part=""
                  className="mt-auto inline-flex items-center gap-1 pt-5 text-sm font-medium text-foreground"
                >
                  Explore
                  <span aria-hidden="true" className="transition-[translate] duration-200 group-hover:translate-x-2">
                    →
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

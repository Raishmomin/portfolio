import Link from "next/link";
import { Accent } from "../../ui/primitives";
import { Portrait } from "../../ui/portrait";
import { TEXT_LINK } from "./subpage";
import { PageSection, SectionHead, card, lit, part } from "../ui";
import type { Personal } from "@/lib/data";

/**
 * Bio, "full" composition: the bio card and the portrait float over the
 * centred hero network as separate cards that enter as one wave.
 */
export function AboutBio({
  personal,
  projectCount,
  skillCount,
}: {
  personal: Personal;
  projectCount: number;
  skillCount: number;
}) {
  return (
    <PageSection id="bio" section="bio" scene="hero" stage="full" labelledBy="bio-heading">
      <div data-card-group="" className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
        <article {...card()} className="panel flex min-w-0 flex-col justify-center p-6 md:p-10 lg:col-span-7">
          <SectionHead
            id="bio-heading"
            index="01"
            kicker="bio"
            title={
              <>
                From interface <Accent>to infrastructure.</Accent>
              </>
            }
          />
          <div className="mt-6 max-w-[64ch] space-y-5 text-[17px] leading-7 text-muted-foreground">
            <p {...part} className="text-foreground">
              {personal.about}
            </p>
            <p {...part}>
              Whether it&apos;s architecting backend systems, tuning database queries, or polishing pixel-perfect
              interfaces — I bring the same attention to every layer.
            </p>
          </div>
          <p {...part} className="mt-6 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <Link href="/projects" className={`inline-flex min-h-11 items-center ${TEXT_LINK}`}>
              All {projectCount} projects →
            </Link>
            <Link href="/skills" className={`inline-flex min-h-11 items-center ${TEXT_LINK}`}>
              The stack map: {skillCount} technologies →
            </Link>
          </p>
        </article>

        <figure {...card("flip")} className="panel min-w-0 overflow-hidden lg:col-span-5">
          <div {...lit} className="overflow-hidden">
            <Portrait size={400} sizes="(min-width: 1024px) 400px, 100vw" className="aspect-square h-auto w-full object-cover sm:aspect-[4/3] lg:aspect-square" />
          </div>
          <figcaption className="border-t border-border px-4 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Raish Momin · Ahmedabad, India
          </figcaption>
        </figure>
      </div>
    </PageSection>
  );
}

import { Accent, ButtonLink, Container, Kicker, StatusDot } from "../ui/primitives";
import { Portrait } from "../ui/portrait";
import { PROFILE } from "@/lib/profile";
import { LocalTime } from "./local-time";
import { SceneNote, aiText } from "./ui";

export type HeroStat = { value: number; suffix?: string; label: string; ai?: boolean };

/**
 * Home hero: full viewport, text on the left over the calm side of the 3D neural
 * network (a CSS gradient scrim keeps it readable over any glow). The h1, the
 * positioning line and the intro are the LCP candidates: plain server-rendered text,
 * never animated (no reveal/split hooks in this section). Stats carry data-count for
 * the counter enhancement; the server HTML already holds the final numbers.
 */
export function Hero({
  intro,
  resumeUrl,
  stats,
}: {
  intro: string;
  resumeUrl: string | null;
  stats: HeroStat[];
}) {
  return (
    <section
      id="top"
      data-section="hero"
      aria-labelledby="hero-heading"
      className="relative"
    >
      {/* Scrim: solid behind the text column, clear over the network on the right. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-background/75 lg:bg-transparent lg:bg-[linear-gradient(90deg,hsl(var(--background))_0%,hsl(var(--background)/0.92)_30%,hsl(var(--background)/0.5)_48%,transparent_64%)]"
      />
      <Container className="relative flex min-h-[calc(100svh-4rem-1px)] flex-col justify-center py-12 md:py-16">
        <div className="max-w-[44rem]">
          <div className="flex items-center gap-4">
            <Portrait size={56} decorative className="rounded-full ring-1 ring-border ring-offset-2 ring-offset-background" />
            <Kicker>Full Stack Developer · DevOps Engineer · AI products</Kicker>
          </div>

          <h1 id="hero-heading" className="mt-5 text-display font-semibold text-foreground">
            {PROFILE.name}
            <span className="sr-only">, </span>
            <span className="mt-3 block text-[clamp(1.25rem,2.4vw,2rem)] font-medium leading-tight tracking-[-0.02em] text-muted-foreground">
              Full-Stack &amp; DevOps Engineer
            </span>
          </h1>

          <p className="mt-8 max-w-[24ch] text-balance text-[clamp(1.625rem,3vw,2.5rem)] font-medium leading-[1.1] tracking-[-0.025em] text-foreground">
            I build <Accent>AI products</Accent>, web apps and the infrastructure behind them.
          </p>

          {intro ? <p className="mt-6 max-w-[58ch] text-muted-foreground">{intro}</p> : null}

          <dl className="mt-8 grid max-w-[36rem] grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col-reverse gap-1 border-l border-border pl-3">
                <dt className="font-mono text-[11px] uppercase leading-4 tracking-[0.1em] text-muted-foreground">{s.label}</dt>
                <dd className={`text-[clamp(1.75rem,3.4vw,2.5rem)] font-semibold leading-none tracking-[-0.03em] tabular-nums ${s.ai ? aiText : "text-foreground"}`}>
                  <span data-count={s.value}>{s.value}</span>
                  {s.suffix}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-9 flex flex-wrap gap-3">
            <ButtonLink href="#contact" data-magnetic="">
              Start a project
            </ButtonLink>
            <ButtonLink href="#ai" variant="ghost">
              See the AI work <span aria-hidden="true">↓</span>
            </ButtonLink>
            {resumeUrl ? (
              <ButtonLink href={resumeUrl} variant="ghost" aria-label="Résumé (opens in a new tab)">
                Résumé <span aria-hidden="true">↗</span>
              </ButtonLink>
            ) : null}
          </div>

          <p className="mt-7 flex items-start gap-2.5 text-[15px] leading-6 text-foreground">
            <StatusDot className="mt-2 shrink-0" />
            Open to {PROFILE.availability}
          </p>
          <p className="mt-2 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
            {PROFILE.location.locality}, {PROFILE.location.countryCode} · IST (UTC+5:30) <LocalTime />
          </p>
        </div>

        <SceneNote className="mt-10 max-w-[30rem] lg:absolute lg:bottom-10 lg:right-8 lg:mt-0 lg:max-w-[22rem] lg:rounded-xl lg:border lg:border-border lg:bg-background/85 lg:p-4">
          Behind this text is a neural network: signals travel layer by layer from input to output, and the network
          leans toward your cursor.
        </SceneNote>
      </Container>
    </section>
  );
}

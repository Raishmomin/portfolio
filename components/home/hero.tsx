import { Accent, ButtonLink, Container, Kicker, StatusDot } from "../ui/primitives";
import { PROFILE } from "@/lib/profile";
import { LocalTime } from "./local-time";
import { SceneNote, aiText, reveal } from "./ui";

export type HeroStat = { value: number; suffix?: string; label: string; ai?: boolean };

/**
 * Home hero, "left" composition: the text column on the left, the 3D neural core (a brain
 * of particle-neurons) in the free right side, sized to the empty [data-hero-core] box; on
 * phones that box is a band above the text. The stage and the server poster both draw
 * into that box, so the visual never sits under the copy.
 * The h1, the positioning line and the intro are the LCP candidates: plain
 * server-rendered text, never animated. What moves in the DOM: the stat tiles rise in
 * as a wave (CSS reveal, before gsap loads), then the calls to action and the caption
 * chip. Stats carry data-count; the server HTML already holds the final numbers.
 */
const CORE_LEFT = "lg:left-[calc(max(0px,(100%-1280px)/2)+47rem)]";
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
      data-stage="left"
      aria-labelledby="hero-heading"
      className="relative"
    >
      {/* Scrim: solid behind the text column, clear over the neural core. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 top-[36svh] bg-[linear-gradient(180deg,transparent,hsl(var(--background)/0.8)_3rem)] lg:top-0 lg:bg-[linear-gradient(90deg,hsl(var(--background))_0%,hsl(var(--background)/0.88)_36%,transparent_56%)]"
      />
      {/* The neural core's box (empty): the 3D brain and its poster fill it. A band on phones. */}
      <div
        aria-hidden="true"
        data-hero-core=""
        className={`pointer-events-none absolute inset-x-4 top-4 h-[calc(36svh-1.5rem)] lg:inset-x-auto lg:right-4 lg:top-6 lg:h-[calc(100svh-4rem-1px-9.5rem)] ${CORE_LEFT}`}
      />
      <Container className="relative flex min-h-[calc(100svh-4rem-1px)] flex-col justify-center pb-6 pt-[36svh] lg:py-16">
        <div data-stage-content="" className="max-w-[44rem]">
          <Kicker>Full Stack Developer · DevOps Engineer · AI products</Kicker>

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
            {stats.map((s, i) => (
              <div key={s.label} className="flex flex-col-reverse gap-1 border-l border-border pl-3" {...reveal(120 + i * 90)} data-reveal-y="28">
                <dt className="font-mono text-[11px] uppercase leading-4 tracking-[0.1em] text-muted-foreground">{s.label}</dt>
                <dd className={`text-[clamp(1.75rem,3.4vw,2.5rem)] font-semibold leading-none tracking-[-0.03em] tabular-nums ${s.ai ? aiText : "text-foreground"}`}>
                  <span data-count={s.value}>{s.value}</span>
                  {s.suffix}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-9 flex flex-wrap gap-3" {...reveal(480)}>
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
      </Container>
      <div
        className={`mx-auto max-w-[1280px] px-4 pb-12 md:px-8 lg:absolute lg:right-4 lg:top-[calc(100svh-4rem-1px-7rem)] lg:flex lg:max-w-none lg:justify-center lg:p-0 ${CORE_LEFT}`}>
        <SceneNote {...reveal(900)} className="mt-4 max-w-[30rem] lg:mt-0 lg:max-w-[25rem]">
          The 3D brain is a neural network of thousands of glowing neurons: signals fire along its connections, and
          it turns toward your cursor.
        </SceneNote>
      </div>
    </section>
  );
}

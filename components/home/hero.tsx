import { Accent, ButtonLink, Kicker, StatusDot } from "../ui/primitives";
import { PROFILE } from "@/lib/profile";
import { CopyEmail } from "../copy-email";
import { LocalTime } from "./local-time";

/**
 * Home hero. The h1, display line and intro are the LCP candidates: plain
 * server-rendered text, never animated (no reveal props anywhere in this section).
 */
export function Hero({
  intro,
  resumeUrl,
  proof,
}: {
  intro: string;
  resumeUrl: string | null;
  /** Mono proof ticker items, computed from data on the server. */
  proof: string[];
}) {
  return (
    <section
      id="top"
      data-section="hero"
      aria-labelledby="hero-heading"
      className="pb-16 pt-12 md:pb-20 md:pt-20"
    >
      <Kicker>Full Stack Developer · DevOps Engineer</Kicker>

      <h1 id="hero-heading" className="mt-5 text-display font-semibold text-foreground">
        {PROFILE.name}
        <span className="sr-only">, </span>
        <span className="mt-3 block text-[clamp(1.25rem,2.4vw,2rem)] font-medium leading-tight tracking-[-0.02em] text-muted-foreground">
          Full-Stack &amp; DevOps Engineer
        </span>
      </h1>

      <p className="mt-8 max-w-[22ch] text-balance text-[clamp(1.625rem,3vw,2.5rem)] font-medium leading-[1.1] tracking-[-0.025em] text-foreground">
        I build web products — <Accent>and the pipelines that ship them.</Accent>
      </p>

      {intro ? <p className="mt-6 max-w-[60ch] text-muted-foreground">{intro}</p> : null}

      <p className="mt-6 flex items-start gap-2.5 text-[15px] leading-6 text-foreground">
        <StatusDot className="mt-2 shrink-0" />
        Open to {PROFILE.availability}
      </p>

      <ul
        aria-label="At a glance"
        className="mt-6 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground tabular-nums"
      >
        {proof.map((item) => (
          <li
            key={item}
            className="inline-flex items-center gap-2 whitespace-nowrap before:block before:h-1 before:w-1 before:bg-muted-foreground/50 before:content-['']"
          >
            {item}
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href={`mailto:${PROFILE.email}`}>Email me</ButtonLink>
        <CopyEmail email={PROFILE.email} />
        {resumeUrl ? (
          <ButtonLink href={resumeUrl} variant="ghost" aria-label="Résumé (opens in a new tab)">
            Résumé <span aria-hidden="true">↗</span>
          </ButtonLink>
        ) : null}
      </div>

      <p className="mt-6 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
        {PROFILE.location.locality}, {PROFILE.location.countryCode} · IST (UTC+5:30) <LocalTime />
      </p>
    </section>
  );
}

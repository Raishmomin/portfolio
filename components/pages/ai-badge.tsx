// "AI" badge for projects where isAiProject() is true. Colours are the spec's AI accent
// (light #3F5BD9, dark #7C9CFF; both above 4.5:1 on their backgrounds).
// clsx, not cn(): the filter island imports NeuralGlyph, and tailwind-merge must stay off the client.
import { cx as cn } from "@/lib/cx";

export const AI_TEXT = "text-[#3F5BD9] dark:text-[#7C9CFF]";

/** Tiny 3-2-1 neural glyph (decorative). */
export function NeuralGlyph({ className }: { className?: string }) {
  const a = [2, 7, 12];
  const b = [4.5, 9.5];
  return (
    <svg aria-hidden="true" viewBox="0 0 16 14" className={cn("h-3.5 w-4", className)} fill="none">
      {a.flatMap((y1) => b.map((y2) => <line key={`${y1}-${y2}`} x1="2" y1={y1} x2="8" y2={y2} stroke="currentColor" strokeOpacity="0.55" strokeWidth="0.8" />))}
      {b.map((y1) => <line key={`o${y1}`} x1="8" y1={y1} x2="14" y2="7" stroke="currentColor" strokeOpacity="0.55" strokeWidth="0.8" />)}
      {a.map((y) => <circle key={`a${y}`} cx="2" cy={y} r="1.4" fill="currentColor" />)}
      {b.map((y) => <circle key={`b${y}`} cx="8" cy={y} r="1.4" fill="currentColor" />)}
      <circle cx="14" cy="7" r="1.8" fill="currentColor" />
    </svg>
  );
}

export function AiBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-[#3F5BD9]/40 bg-[#3F5BD9]/[0.06] px-2.5 py-1 font-mono text-[11px] uppercase leading-none tracking-[0.12em] dark:border-[#7C9CFF]/40 dark:bg-[#7C9CFF]/[0.08]",
        AI_TEXT,
        className,
      )}
    >
      <NeuralGlyph />
      AI
    </span>
  );
}

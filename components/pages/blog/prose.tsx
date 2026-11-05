// Component-scoped prose styles for rendered post bodies (no typography plugin, no globals).
// The HTML comes from renderMarkdown (app/lib/markdown.ts), which escapes all source text;
// descendant selectors here (specificity 0,1,1+) override the renderer's utility classes.
// A plain join, not cn(): tailwind-merge must not collapse these variant groups.
const PROSE = [
  "max-w-[68ch] text-[18px] leading-[30px] text-foreground/90",
  // paragraphs and lists: Geist 18/30
  "[&_p]:mb-6 [&_p]:text-[18px] [&_p]:leading-[30px] [&_p]:text-foreground/90",
  "[&_ul]:my-6 [&_ul]:space-y-2 [&_ul]:pl-6 [&_ol]:my-6 [&_ol]:space-y-2 [&_ol]:pl-6",
  "[&_li]:pl-1 [&_li]:text-[18px] [&_li]:leading-[30px] [&_li]:text-foreground/90 [&_li::marker]:text-muted-foreground",
  // headings
  "[&_h2]:mb-4 [&_h2]:mt-14 [&_h2]:scroll-mt-28 [&_h2]:text-[28px] [&_h2]:font-semibold [&_h2]:leading-[1.2] [&_h2]:tracking-[-0.02em] [&_h2]:text-foreground",
  "[&_h3]:mb-3 [&_h3]:mt-10 [&_h3]:scroll-mt-28 [&_h3]:text-[21px] [&_h3]:font-semibold [&_h3]:leading-[1.3] [&_h3]:tracking-[-0.015em] [&_h3]:text-foreground",
  "[&_h4]:mb-2 [&_h4]:mt-8 [&_h4]:scroll-mt-28 [&_h4]:text-lg [&_h4]:font-semibold [&_h4]:text-foreground",
  "[&>*:first-child]:mt-0",
  // inline emphasis and links
  "[&_strong]:font-semibold [&_strong]:text-foreground",
  "[&_a]:text-foreground [&_a]:underline [&_a]:decoration-primary [&_a]:decoration-1 [&_a]:underline-offset-[3px] [&_a:hover]:text-primary",
  "[&_a:focus-visible]:rounded-sm [&_a:focus-visible]:outline-none [&_a:focus-visible]:ring-2 [&_a:focus-visible]:ring-ring",
  // code: mono on the panel colour; blocks scroll horizontally inside the measure
  "[&_.blog-inline-code]:rounded [&_.blog-inline-code]:border [&_.blog-inline-code]:border-border [&_.blog-inline-code]:bg-card [&_.blog-inline-code]:px-1.5 [&_.blog-inline-code]:py-0.5 [&_.blog-inline-code]:font-mono [&_.blog-inline-code]:text-[0.85em]",
  "[&_pre]:my-8 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:border [&_pre]:border-border [&_pre]:bg-card [&_pre]:p-5 [&_pre]:font-mono [&_pre]:text-[14px] [&_pre]:leading-[1.7] [&_pre]:text-foreground",
  "[&_pre:focus-visible]:outline-none [&_pre:focus-visible]:ring-2 [&_pre:focus-visible]:ring-ring",
  "[&_pre_code]:font-mono",
  "[&_hr]:my-12 [&_hr]:border-border",
].join(" ");

/**
 * Renders the sanitized post HTML. Code blocks get tabindex="0" so keyboard users can
 * scroll them (a fixed attribute on the renderer's own <pre> tag; nothing else changes).
 */
export function BlogProse({ html, className }: { html: string; className?: string }) {
  const withFocusableCode = html.replace(/<pre class="blog-pre">/g, '<pre class="blog-pre" tabindex="0">');
  return <div className={className ? `${PROSE} ${className}` : PROSE} dangerouslySetInnerHTML={{ __html: withFocusableCode }} />;
}

import type { TocItem } from "@/lib/markdown";

// Items come from renderMarkdown, so they always match the rendered heading ids.
// Placement (sticky rail on desktop, block above the post on mobile) is set by the page.

export function TableOfContents({ items, className }: { items: TocItem[]; className?: string }) {
  if (items.length < 3) return null;

  return (
    <nav aria-label="Table of contents" className={className}>
      <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">On this page</h2>
      <ol className="mt-4 space-y-1 border-l border-border text-sm leading-5">
        {items.map((item, i) => (
          <li key={`${item.slug}-${i}`}>
            <a
              href={`#${item.slug}`}
              className={`-ml-px block border-l border-transparent py-1.5 pr-2 text-muted-foreground transition-colors duration-150 hover:border-primary hover:text-foreground focus-visible:border-primary focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                item.depth === 3 ? "pl-7" : "pl-4"
              }`}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

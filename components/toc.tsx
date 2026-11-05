import type { TocItem } from "@/lib/markdown";

// Items come from renderMarkdown, so they always match the rendered heading ids.

export function TableOfContents({ items }: { items: TocItem[] }) {
  if (items.length < 3) return null;

  return (
    <nav
      aria-label="Table of contents"
      className="mb-12 p-5 md:p-6 rounded-xl border border-border bg-card"
    >
      <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4">
        On this page
      </h2>
      <ol className="space-y-2 text-sm">
        {items.map((item, i) => (
          <li
            key={`${item.slug}-${i}`}
            className={item.depth === 3 ? "pl-4" : ""}
          >
            <a
              href={`#${item.slug}`}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {item.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

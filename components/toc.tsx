export type TocItem = { text: string; slug: string; depth: 2 | 3 };

export function extractToc(markdown: string): TocItem[] {
  const lines = markdown.split("\n");
  const items: TocItem[] = [];
  let inCodeFence = false;
  for (const raw of lines) {
    if (raw.startsWith("```")) {
      inCodeFence = !inCodeFence;
      continue;
    }
    if (inCodeFence) continue;
    const h2 = raw.match(/^##\s+(.+?)\s*$/);
    if (h2) {
      items.push({ text: h2[1], slug: slugifyHeading(h2[1]), depth: 2 });
      continue;
    }
    const h3 = raw.match(/^###\s+(.+?)\s*$/);
    if (h3) items.push({ text: h3[1], slug: slugifyHeading(h3[1]), depth: 3 });
  }
  return items;
}

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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

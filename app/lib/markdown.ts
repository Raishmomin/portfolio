// Markdown -> HTML for blog posts. Post bodies are LLM-generated, so the source
// is treated as untrusted text: every character is HTML-escaped and the only
// markup in the output is what this renderer emits. Supports what the posts
// use: fenced code, headings, paragraphs, lists, rules, inline code, bold,
// italic and links.

import { SITE_URL } from "./config";
import { blogPath } from "./blog";
import { autolink } from "./internal-links";

export type TocItem = { text: string; slug: string; depth: 2 | 3 };

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ESCAPES[c]);

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const SITE_HOST = new URL(SITE_URL).host;
const LINK_CLASS =
  "text-foreground underline underline-offset-4 hover:text-foreground/70 transition-colors";

/**
 * Only http(s), mailto, site-relative and #fragment links survive; external ones
 * open in a new tab. Paths are resolved against the site URL, so a path the
 * browser would read as another host ("/\evil.com", "//evil.com") is treated as
 * external, never as an internal link.
 */
function link(label: string, rawHref: string): string {
  const href = rawHref.trim();
  let target: { href: string; external: boolean } | null = null;
  if (href.startsWith("#")) {
    target = { href, external: false };
  } else if (/^mailto:/i.test(href)) {
    target = { href, external: false };
  } else if (href.startsWith("/") || /^https?:/i.test(href)) {
    try {
      const url = new URL(href, SITE_URL);
      if (url.protocol === "http:" || url.protocol === "https:") {
        target =
          url.host === SITE_HOST
            ? { href: `${url.pathname}${url.search}${url.hash}`, external: false }
            : { href: url.href, external: true };
      }
    } catch {
      // not a URL: render the label as plain text
    }
  }
  if (!target) return label;
  // Skip the 301 hop for links to consolidated posts.
  const internal = target.href.replace(/^\/blog\/([^/?#]+)/, (_m, slug: string) => blogPath(slug));
  const attrs = target.external
    ? `href="${escapeHtml(target.href)}" target="_blank" rel="noopener noreferrer"`
    : `href="${escapeHtml(internal)}"`;
  return `<a ${attrs} class="${LINK_CLASS}">${label}</a>`;
}

/** Inline markdown on raw text. Code spans and links become placeholders so emphasis never reaches inside them. */
function inline(raw: string): string {
  const tokens: string[] = [];
  const hold = (html: string) => `\u0000${tokens.push(html) - 1}\u0000`;

  let text = raw
    .replace(/`([^`\n]+)`/g, (_m, code: string) =>
      hold(`<code class="blog-inline-code">${escapeHtml(code)}</code>`)
    )
    // Images render as their alt text; hrefs may hold one level of balanced parens,
    // so a rejected "(javascript:f(1))" link never leaves a stray ")".
    .replace(
      /(!?)\[([^\]\n]*)\]\(((?:[^()\s]|\([^()\s]*\))+)(?:\s+"[^"\n]*")?\)/g,
      (_m, bang: string, label: string, href: string) =>
        hold(bang ? escapeHtml(label) : label ? link(emphasis(escapeHtml(label)), href) : "")
    );

  text = emphasis(escapeHtml(text));
  // Restore placeholders (labels may hold code-span placeholders, hence the loop).
  while (/\u0000\d+\u0000/.test(text)) {
    text = text.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => tokens[Number(i)]);
  }
  return text;
}

function emphasis(html: string): string {
  return html
    .replace(/\*\*(?=\S)([\s\S]+?)(?<=\S)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*\w])\*(?=[^\s*])([^*\n]+?)(?<=\S)\*(?![*\w])/g, "$1<em>$2</em>");
}

/** Plain heading text for ids and the table of contents. */
const headingText = (s: string) => s.replace(/[*`]/g, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").trim();

const HEADING_CLASS: Record<2 | 3 | 4, string> = {
  2: "text-xl font-semibold tracking-tight text-foreground mt-10 mb-4 scroll-mt-24",
  3: "text-lg font-semibold tracking-tight text-foreground mt-8 mb-3 scroll-mt-24",
  4: "text-base font-semibold tracking-tight text-foreground mt-6 mb-2 scroll-mt-24",
};
const P_CLASS = "text-base text-muted-foreground leading-relaxed mb-4";
const LIST_CLASS = "space-y-2 pl-5 my-4 text-muted-foreground";

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

const FENCE_RE = /^ {0,3}(`{3,}|~{3,})\s*([\w+#.-]*)/;
const closingFence = (marker: string) =>
  new RegExp(`^ {0,3}${marker[0] === "`" ? "`" : "~"}{${marker.length},}\\s*$`);

function parseHeading(line: string): { level: number; source: string; text: string } | null {
  // The text is optional: a bare "###" line is an empty heading (dropped by the
  // caller), never a paragraph that prints the hashes.
  const m = line.match(/^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/);
  if (!m) return null;
  // "### ### Foo" occurs in generated posts; keep only the text.
  const source = (m[2] ?? "").replace(/^(#+\s*)+/, "");
  return { level: m[1].length, source, text: headingText(source) };
}

/**
 * Generated posts often open with "## <title>" and nest every section under it.
 * Returns the line index of that repeated title (-1 if none) and how many levels
 * to lift the remaining headings so the shallowest one renders as h2.
 */
function outline(lines: string[], title?: string): { skip: number; shift: number } {
  let skip = -1;
  let min = 6;
  let first = true;
  let fence: RegExp | null = null;
  lines.forEach((line, i) => {
    if (fence) {
      if (fence.test(line)) fence = null;
      return;
    }
    const open = line.match(FENCE_RE);
    if (open) {
      fence = closingFence(open[1]);
      first = false;
      return;
    }
    if (!line.trim()) return;
    const heading = parseHeading(line);
    if (heading && first && title && normalize(heading.text) === normalize(title)) skip = i;
    else if (heading?.text) min = Math.min(min, heading.level);
    first = false;
  });
  return { skip, shift: Math.max(0, min - 2) };
}

/**
 * Renders a post body. Headings render as h2-h4 (the page title stays the only
 * h1): a leading heading that repeats `title` is dropped and the outline lifted
 * so top-level sections are h2. Returns the HTML plus the h2/h3 outline for the
 * table of contents.
 */
export function renderMarkdown(md: string, title?: string): { html: string; toc: TocItem[] } {
  const lines = (md || "").replace(/\r\n?/g, "\n").replace(/\u0000/g, "").split("\n");
  const { skip, shift } = outline(lines, title);
  const out: string[] = [];
  const toc: TocItem[] = [];
  const ids = new Map<string, number>();

  let para: string[] = [];
  let list: { ordered: boolean; start: number; items: string[] } | null = null;

  const flushPara = () => {
    if (para.length) out.push(`<p class="${P_CLASS}">${inline(para.join("\n"))}</p>`);
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    const items = list.items.map((item) => `<li class="blog-li">${inline(item)}</li>`).join("\n");
    out.push(
      list.ordered
        ? `<ol${list.start !== 1 ? ` start="${list.start}"` : ""} class="${LIST_CLASS} list-decimal">${items}</ol>`
        : `<ul class="${LIST_CLASS} list-disc">${items}</ul>`
    );
    list = null;
  };
  const flush = () => {
    flushPara();
    flushList();
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const fence = line.match(FENCE_RE);
    if (fence) {
      flush();
      const [, marker, lang] = fence;
      const closing = closingFence(marker);
      const code: string[] = [];
      for (i++; i < lines.length && !closing.test(lines[i]); i++) code.push(lines[i]);
      out.push(
        `<pre class="blog-pre"><code class="language-${escapeHtml(lang || "text")}">${escapeHtml(
          code.join("\n")
        )}</code></pre>`
      );
      continue;
    }

    if (!line.trim()) {
      flush();
      continue;
    }

    const heading = parseHeading(line);
    if (heading) {
      flush();
      const { source, text } = heading;
      if (i === skip || !text) continue;
      const level = Math.min(Math.max(heading.level - shift, 2), 4) as 2 | 3 | 4;
      const base = slugifyHeading(text) || "section";
      const n = (ids.get(base) ?? 0) + 1;
      ids.set(base, n);
      const id = n === 1 ? base : `${base}-${n}`;
      if (level !== 4) toc.push({ text, slug: id, depth: level });
      out.push(`<h${level} id="${id}" class="${HEADING_CLASS[level]}">${inline(source)}</h${level}>`);
      continue;
    }

    if (/^ {0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flush();
      out.push('<hr class="my-8 border-border" />');
      continue;
    }

    const item = line.match(/^\s*([-*+]|(\d{1,9})[.)])\s+(.*)$/);
    if (item) {
      flushPara();
      const ordered = item[2] !== undefined;
      if (list && list.ordered !== ordered) flushList();
      if (!list) list = { ordered, start: ordered ? Number(item[2]) : 1, items: [] };
      list.items.push(item[3]);
      continue;
    }

    if (list && /^\s+\S/.test(line)) {
      // Indented continuation of the previous list item.
      list.items[list.items.length - 1] += `\n${line.trim()}`;
      continue;
    }

    flushList();
    para.push(line);
  }
  flush();

  // Inject internal links to service pages on plain prose.
  return { html: autolink(out.join("\n")), toc };
}

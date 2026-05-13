type LinkRule = { match: RegExp; href: string; title?: string };

const RULES: LinkRule[] = [
  {
    match: /\bNext\.?\s?js\s+(?:14|15|App\s+Router|developer|development)\b/gi,
    href: "/services/nextjs-development",
    title: "Next.js development services",
  },
  {
    match: /\bMERN\s+stack\b/gi,
    href: "/services/mern-stack-development",
    title: "MERN stack development",
  },
  {
    match: /\b(?:AWS\s+DevOps|DevOps\s+engineer|CI\/?CD\s+pipeline)\b/gi,
    href: "/services/devops-aws-consulting",
    title: "DevOps & AWS consulting",
  },
  {
    match: /\b(?:Node\.?js\s+API|REST\s+API|API\s+development|backend\s+development)\b/gi,
    href: "/services/api-backend-development",
    title: "API & backend development",
  },
];

const MAX_PER_RULE = 2;

/**
 * Inject up to MAX_PER_RULE internal links per rule into already-rendered HTML,
 * skipping text inside existing anchors, headings, and code blocks.
 */
export function autolink(html: string): string {
  if (!html) return html;

  const PROTECTED_RE =
    /(<a\b[^>]*>[\s\S]*?<\/a>|<code\b[^>]*>[\s\S]*?<\/code>|<pre\b[^>]*>[\s\S]*?<\/pre>|<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]>)/gi;

  const chunks: { text: string; protected: boolean }[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PROTECTED_RE.exec(html)) !== null) {
    if (m.index > lastIndex) chunks.push({ text: html.slice(lastIndex, m.index), protected: false });
    chunks.push({ text: m[0], protected: true });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < html.length) chunks.push({ text: html.slice(lastIndex), protected: false });

  const counts = new Map<RegExp, number>();

  return chunks
    .map((chunk) => {
      if (chunk.protected) return chunk.text;
      let out = chunk.text;
      for (const rule of RULES) {
        const remaining = MAX_PER_RULE - (counts.get(rule.match) || 0);
        if (remaining <= 0) continue;
        let used = 0;
        out = out.replace(rule.match, (match) => {
          if (used >= remaining) return match;
          used += 1;
          return `<a href="${rule.href}" class="text-foreground underline underline-offset-4 hover:text-foreground/70 transition-colors"${
            rule.title ? ` title="${rule.title}"` : ""
          }>${match}</a>`;
        });
        counts.set(rule.match, (counts.get(rule.match) || 0) + used);
      }
      return out;
    })
    .join("");
}

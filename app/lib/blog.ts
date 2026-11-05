// Blog listing rules shared by every surface that lists or links posts (blog
// index, post pages, sitemap, RSS, llms.txt, related posts). Pure module: no DB.

import redirects from "./blog-redirects.json";

/**
 * Near-duplicate posts consolidated into one canonical post: from-slug -> to-slug.
 * next.config.js serves these as 301s; the posts stay in the DB but are never listed.
 */
export const BLOG_REDIRECTS: Readonly<Record<string, string>> = redirects;

const REDIRECTED_SLUGS = Object.keys(BLOG_REDIRECTS);

/** Mongo filter for posts that may be listed, linked or prerendered. */
export const LISTED_POSTS = {
  published: { $ne: false },
  slug: { $nin: REDIRECTED_SLUGS },
};

/** Display title (H1, headline, lists): generated titles sometimes end with a stray period. */
export const postTitle = (title: string) => title.replace(/\s+/g, " ").trim().replace(/\.+$/, "");

/** Fields a post listing renders (blog index, RSS): never the full `content`. */
export const POST_SUMMARY_PROJECTION = {
  title: 1,
  slug: 1,
  excerpt: 1,
  tags: 1,
  publishedAt: 1,
  updatedAt: 1,
  readTime: 1,
} as const;

/** Site path for a post, following a consolidation redirect if there is one. */
export const blogPath = (slug: string) => `/blog/${BLOG_REDIRECTS[slug] ?? slug}`;

export const SEO_TITLE_MAX = 60;
// A title only a few characters over the limit is kept whole: that costs less
// than a cut that drops topic words ("… and Kubernetes Ingress").
const SEO_TITLE_KEEP_WHOLE = 65;

// A cut is "clean" when the next word starts a new phrase, so the shortened
// title never ends on one of these or mid-phrase.
const CONNECTORS = new Set([
  "a", "an", "and", "as", "at", "by", "for", "from", "in", "into", "of", "on", "or",
  "the", "to", "using", "via", "vs", "with", "without",
]);
const isConnector = (word: string) => CONNECTORS.has(word.toLowerCase());

/**
 * `<title>`/og:title for a post whose title is over 60 chars: the whole title when
 * it is at most 65 chars, else the longest prefix of at most 60 chars that ends
 * where a phrase ends ("… with Edge Runtime" before "for 35% …"), else the longest
 * word-boundary prefix. Undefined when the title already fits. The H1 always
 * keeps the full title.
 */
export function shortPostTitle(title: string): string | undefined {
  const clean = postTitle(title);
  if (title.length <= SEO_TITLE_MAX) return undefined;
  if (clean.length <= SEO_TITLE_KEEP_WHOLE) return clean;

  const words = clean.split(" ");
  let phrase = "";
  let fallback = "";
  for (let k = 1; k < words.length; k++) {
    const prefix = words.slice(0, k).join(" ");
    if (prefix.length > SEO_TITLE_MAX) break;
    const last = words[k - 1];
    if (isConnector(last)) continue;
    fallback = prefix;
    if (isConnector(words[k]) || /[,:;]$/.test(last)) phrase = prefix;
  }
  return (phrase.length >= 20 ? phrase : fallback || clean.slice(0, SEO_TITLE_MAX)).replace(
    /[\s,:;.\-–—]+$/,
    ""
  );
}

/** Excerpt as plain text: generated excerpts sometimes arrive quoted or with markdown. */
export function plainExcerpt(excerpt: string | undefined): string {
  return (excerpt ?? "")
    .replace(/(^|\s)#{1,6}(?=\s)/g, "$1")
    .replace(/\*\*|`/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["“'](.*)["”']$/, "$1")
    .trim();
}

/** Meta description: plain excerpt cut at a word boundary to at most 160 chars. */
export function metaDescription(excerpt: string | undefined, max = 160): string {
  const text = plainExcerpt(excerpt);
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[\s,;:.\-–—]+$/, "")}…`;
}

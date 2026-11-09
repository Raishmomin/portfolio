import { unstable_cache } from "next/cache";
import clientPromise from "@/lib/mongodb";
import { SITE_URL } from "@/lib/config";
import { SERVICES } from "@/lib/services";
import { FAQS } from "@/lib/faqs";
import { TAGS } from "@/lib/cache-tags";
import { getExperience } from "@/lib/data";
import { LISTED_POSTS, plainExcerpt, postTitle } from "@/lib/blog";
import {
  LLMS_HEADERS,
  contactLines,
  faqLines,
  keyFacts,
  resourceLines,
  siteHeading,
} from "@/lib/llms";

export const revalidate = 3600;

type RecentPost = { title: string; slug: string; excerpt: string };

// DB errors throw (never cached), so a failed ISR revalidation keeps the last good output.
const getRecentPosts = unstable_cache(
  async (): Promise<RecentPost[]> => {
    const client = await clientPromise;
    const posts = await client
      .db("Portfolio")
      .collection("blogs")
      // Near-duplicate posts are consolidated (301) and never listed, see app/lib/blog.ts.
      .find(LISTED_POSTS, { projection: { _id: 0, title: 1, slug: 1, excerpt: 1 } })
      .sort({ publishedAt: -1 })
      .limit(15)
      .toArray();
    return posts as unknown as RecentPost[];
  },
  ["llms-recent-posts"],
  { tags: [TAGS.blogs], revalidate: 3600 }
);

export async function GET() {
  const [experience, posts] = await Promise.all([getExperience(), getRecentPosts()]);

  const lines: string[] = [...siteHeading()];
  lines.push("## Key facts", "");
  lines.push(...keyFacts(experience).map((f) => `- ${f}`), "");

  lines.push("## Services", "");
  for (const svc of Object.values(SERVICES)) {
    lines.push(`- [${svc.h1}](${SITE_URL}/services/${svc.slug}): ${svc.tagline}`);
  }
  lines.push("");

  lines.push("## Key pages", "");
  lines.push(
    `- [Home](${SITE_URL}/): profile overview, skills, experience and featured projects`,
    `- [About](${SITE_URL}/about): background and FAQ`,
    `- [Services](${SITE_URL}/services): engagement models and pricing`,
    `- [Projects](${SITE_URL}/projects): project descriptions, stacks and live links`,
    `- [Experience](${SITE_URL}/experience): roles and timeline`,
    `- [Skills](${SITE_URL}/skills): skills by category`,
    `- [Blog](${SITE_URL}/blog): technical writing on full-stack development and DevOps`,
    `- [Contact](${SITE_URL}/contact): contact form`,
    ""
  );

  if (posts.length > 0) {
    lines.push("## Recent blog posts", "");
    for (const p of posts) {
      lines.push(`- [${postTitle(p.title)}](${SITE_URL}/blog/${p.slug})${p.excerpt ? `: ${plainExcerpt(p.excerpt)}` : ""}`);
    }
    lines.push("");
  }

  // The core profile questions; the full set is in /llms-full.txt.
  lines.push("## FAQ", "", ...faqLines((FAQS["/about"] ?? []).slice(0, 4)));

  lines.push("## Contact", "", ...contactLines(), "");
  lines.push("## Machine-readable resources", "", ...resourceLines(), "");

  return new Response(lines.join("\n"), { headers: LLMS_HEADERS });
}

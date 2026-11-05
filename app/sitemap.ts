import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";
import clientPromise from "@/lib/mongodb";
import { PROFILE } from "@/lib/profile";
import { SERVICES } from "@/lib/services";
import { LISTED_POSTS } from "@/lib/blog";

export const revalidate = 3600;

type Freq = NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;

// Last edit of each page's own copy/template — bump when it changes. Pages built
// from DB collections also move forward when a newer document is inserted.
const CODE_UPDATED = "2026-11-05";

const STATIC_PAGES: {
  path: string;
  updated: string;
  collections?: string[];
  changeFrequency: Freq;
  priority: number;
}[] = [
  { path: "", updated: PROFILE.updatedAt, collections: ["skills", "experience", "projects"], changeFrequency: "monthly", priority: 1 },
  { path: "/about", updated: PROFILE.updatedAt, collections: ["projects"], changeFrequency: "monthly", priority: 0.9 },
  { path: "/projects", updated: CODE_UPDATED, collections: ["projects"], changeFrequency: "monthly", priority: 0.9 },
  { path: "/experience", updated: CODE_UPDATED, collections: ["experience"], changeFrequency: "monthly", priority: 0.8 },
  { path: "/skills", updated: CODE_UPDATED, collections: ["skills"], changeFrequency: "monthly", priority: 0.8 },
  { path: "/contact", updated: CODE_UPDATED, changeFrequency: "yearly", priority: 0.7 },
  { path: "/services", updated: CODE_UPDATED, changeFrequency: "monthly", priority: 0.9 },
];

const toDate = (v: unknown): Date | undefined => {
  const d = v ? new Date(v as string | Date) : undefined;
  return d && !isNaN(d.getTime()) ? d : undefined;
};

const latest = (...dates: (Date | undefined)[]): Date =>
  new Date(Math.max(...dates.map((d) => d?.getTime() ?? 0)));

async function db() {
  return (await clientPromise).db("Portfolio");
}

// DB errors are thrown, never swallowed: a failed ISR revalidation keeps serving the
// last good sitemap instead of caching one with no blog posts for an hour.

/** Insert time of the newest document in a collection (from its ObjectId). */
async function newestDocDate(collection: string): Promise<Date | undefined> {
  const [doc] = await (await db())
    .collection(collection)
    .find({}, { projection: { _id: 1 } })
    .sort({ _id: -1 })
    .limit(1)
    .toArray();
  return doc?._id.getTimestamp();
}

async function blogRoutes(): Promise<MetadataRoute.Sitemap> {
  const posts = await (await db())
    .collection("blogs")
    .find(LISTED_POSTS, { projection: { slug: 1, publishedAt: 1, updatedAt: 1, createdAt: 1 } })
    .sort({ publishedAt: -1 })
    .toArray();
  return posts.map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastModified: toDate(post.updatedAt) ?? toDate(post.publishedAt) ?? toDate(post.createdAt),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const collections = [...new Set(STATIC_PAGES.flatMap((p) => p.collections ?? []))];
  const [posts, newest] = await Promise.all([
    blogRoutes(),
    Promise.all(collections.map(newestDocDate)),
  ]);
  const newestBy = Object.fromEntries(collections.map((c, i) => [c, newest[i]]));

  const staticRoutes: MetadataRoute.Sitemap = STATIC_PAGES.map((p) => ({
    url: `${SITE_URL}${p.path}`,
    lastModified: latest(new Date(p.updated), ...(p.collections ?? []).map((c) => newestBy[c])),
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));

  const blogIndex: MetadataRoute.Sitemap[number] = {
    url: `${SITE_URL}/blog`,
    lastModified: latest(new Date(CODE_UPDATED), ...posts.map((p) => toDate(p.lastModified))),
    changeFrequency: "daily",
    priority: 0.8,
  };

  const serviceRoutes: MetadataRoute.Sitemap = Object.keys(SERVICES).map((slug) => ({
    url: `${SITE_URL}/services/${slug}`,
    lastModified: new Date(CODE_UPDATED),
    changeFrequency: "monthly",
    priority: 0.95,
  }));

  return [...staticRoutes, blogIndex, ...serviceRoutes, ...posts];
}

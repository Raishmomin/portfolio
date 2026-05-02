import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";
import clientPromise from "@/lib/mongodb";


export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/about`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/projects`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/experience`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/skills`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/contact`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/blog`,
      lastModified,
      changeFrequency: "daily",
      priority: 0.8,
    },
  ];

  // Dynamic blog post URLs
  let blogRoutes: MetadataRoute.Sitemap = [];
  try {
    const client = await clientPromise;
    const db = client.db("Portfolio");
    const posts = await db
      .collection("blogs")
      .find({}, { projection: { slug: 1, publishedAt: 1 } })
      .sort({ publishedAt: -1 })
      .toArray();

    blogRoutes = posts.map((post) => ({
      url: `${SITE_URL}/blog/${post.slug}`,
      lastModified: new Date(post.publishedAt),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    }));
  } catch (error) {
    console.error("Sitemap: failed to fetch blog posts", error);
  }

  return [...staticRoutes, ...blogRoutes];
}

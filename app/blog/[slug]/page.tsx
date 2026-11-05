import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_cache } from "next/cache";
import { Navbar } from "../../../components/navbar";
import { Footer } from "../../../components/footer";
import { PageJsonLd } from "../../../components/page-json-ld";
import { AuthorBio } from "../../../components/author-bio";
import { RelatedPosts } from "../../../components/related-posts";
import { TableOfContents } from "../../../components/toc";
import { buildMetadata, breadcrumbList } from "@/lib/seo";
import { SITE, SITE_URL } from "@/lib/config";
import { TAGS } from "@/lib/cache-tags";
import {
    LISTED_POSTS,
    SEO_TITLE_MAX,
    metaDescription,
    plainExcerpt,
    postTags,
    postTitle,
    shortPostTitle,
} from "@/lib/blog";
import { renderMarkdown } from "@/lib/markdown";
import { Calendar, Clock, ArrowLeft, Tag } from "lucide-react";
import clientPromise from "@/lib/mongodb";
import type { BlogPost } from "@/lib/blog-types";

export const revalidate = 3600;

// Consolidated (redirected) slugs are left out; next.config.js 301s them.
export async function generateStaticParams() {
    try {
        const client = await clientPromise;
        const db = client.db("Portfolio");
        const posts = await db
            .collection("blogs")
            .find(LISTED_POSTS, { projection: { slug: 1 } })
            .toArray();
        return posts.map((p) => ({ slug: p.slug as string }));
    } catch {
        return [];
    }
}

// Unpublished (draft) posts 404. DB errors throw instead of returning null, so a
// failed ISR revalidation keeps serving the last good page rather than caching a 404.
function getPostCached(slug: string) {
    return unstable_cache(
        async (): Promise<BlogPost | null> => {
            const client = await clientPromise;
            const db = client.db("Portfolio");
            const post = await db
                .collection("blogs")
                .findOne({ slug, published: { $ne: false } });
            if (!post) return null;
            return JSON.parse(JSON.stringify(post));
        },
        ["blog-post", slug],
        { tags: [TAGS.blogs, TAGS.blog(slug)], revalidate: 3600 }
    )();
}

async function getPost(slug: string): Promise<BlogPost | null> {
    return getPostCached(slug);
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    const { slug } = await params;
    const post = await getPost(slug);
    // Same as the page: an unknown slug renders the not-found boundary on the server
    // (returning a fallback title here left an empty client-only 404 shell).
    if (!post) notFound();
    const tags = postTags(post.tags);

    // Long generated titles get a phrase-boundary cut for <title>/og:title; the H1 keeps the full title.
    const shortTitle = shortPostTitle(post.title);
    const metadata = buildMetadata({
        path: `/blog/${post.slug}`,
        image: `/blog/${post.slug}/opengraph-image`,
        title: shortTitle ?? post.title,
        ogTitle: shortTitle,
        description: metaDescription(post.excerpt),
        keywords: tags,
        ogType: "article",
        publishedTime: new Date(post.publishedAt).toISOString(),
        modifiedTime: new Date(post.updatedAt || post.publishedAt).toISOString(),
        authors: [SITE.name],
        tags,
    });
    // The cut title keeps the layout's " | Raish Momin" suffix when both fit in 60 chars;
    // otherwise `absolute` drops the suffix.
    const keepBrand = !shortTitle || `${shortTitle} | ${SITE.name}`.length <= SEO_TITLE_MAX;
    return keepBrand ? metadata : { ...metadata, title: { absolute: shortTitle } };
}

function formatDate(date: string | Date): string {
    return new Date(date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}

export default async function BlogPostPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const post = await getPost(slug);
    if (!post) notFound();

    const url = `${SITE_URL}/blog/${post.slug}`;
    const title = postTitle(post.title);
    const published = new Date(post.publishedAt).toISOString();
    const modified = new Date(post.updatedAt || post.publishedAt).toISOString();
    const { html, toc } = renderMarkdown(post.content, post.title);
    const excerpt = plainExcerpt(post.excerpt);
    const tags = postTags(post.tags);
    const wordCount = post.content?.split(/\s+/).filter(Boolean).length || 0;

    const schema: object[] = [
        {
            "@context": "https://schema.org",
            "@type": ["BlogPosting", "Article"],
            "@id": `${url}#blogposting`,
            mainEntityOfPage: { "@type": "WebPage", "@id": url },
            headline: title,
            name: title,
            description: excerpt,
            url,
            datePublished: published,
            dateModified: modified,
            wordCount,
            timeRequired: `PT${post.readTime || 1}M`,
            keywords: tags.join(", "),
            inLanguage: "en-US",
            image: [`${url}/opengraph-image`],
            author: { "@id": `${SITE_URL}#person` },
            publisher: { "@id": `${SITE_URL}#person` },
        },
        breadcrumbList([
            { name: "Home", path: "/" },
            { name: "Blog", path: "/blog" },
            { name: title, path: `/blog/${post.slug}` },
        ]),
    ];

    const showToc = wordCount > 1000 && toc.length >= 3;

    return (
        <>
            <PageJsonLd data={schema} />
            <Navbar />
            <main id="main" tabIndex={-1} className="relative pt-24 outline-none">
                <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
                    {/* Back link */}
                    <Link
                        href="/blog"
                        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-12 group"
                    >
                        <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
                        Back to blog
                    </Link>

                    {/* Header */}
                    <header className="mb-12">
                        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mb-6">
                            <span className="inline-flex items-center gap-1.5">
                                <Calendar className="w-3 h-3" />
                                {formatDate(post.publishedAt)}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                                <Clock className="w-3 h-3" />
                                {post.readTime} min read
                            </span>
                        </div>

                        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground leading-tight mb-6">
                            {title}
                        </h1>

                        <p className="text-lg text-muted-foreground leading-relaxed">
                            {excerpt}
                        </p>

                        {/* Tags */}
                        <div className="flex flex-wrap gap-2 mt-6">
                            {tags.map((tag) => (
                                <span
                                    key={tag}
                                    className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full border border-border text-muted-foreground"
                                >
                                    <Tag className="w-2.5 h-2.5" />
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </header>

                    {/* Divider */}
                    <div className="h-px bg-border mb-12" />

                    {/* Table of Contents (long posts only) */}
                    {showToc && <TableOfContents items={toc} />}

                    {/* Content */}
                    <div
                        className="blog-content"
                        dangerouslySetInnerHTML={{ __html: html }}
                    />

                    {/* Author bio */}
                    <AuthorBio />

                    {/* Related posts (matched on the raw DB tag strings) */}
                    <RelatedPosts currentSlug={post.slug} tags={post.tags || []} />

                    {/* Footer nav */}
                    <div className="mt-16 pt-8 border-t border-border">
                        <Link
                            href="/blog"
                            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
                        >
                            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
                            All posts
                        </Link>
                    </div>
                </article>
            </main>
            <Footer />
        </>
    );
}

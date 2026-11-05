import type { Metadata } from "next";
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
    postTitle,
    shortPostTitle,
} from "@/lib/blog";
import { renderMarkdown } from "@/lib/markdown";
import clientPromise from "@/lib/mongodb";
import type { BlogPost } from "@/lib/blog-types";
import { ButtonLink, Container, Kicker } from "../../../components/ui/primitives";
import { Crumbs } from "../../../components/pages/projects/subpage-header";
import { BlogProse } from "../../../components/pages/blog/prose";
import { cleanTag, shortDate } from "../../../components/pages/blog/post-list";

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
    if (!post) return { title: "Post Not Found" };

    // Long generated titles get a phrase-boundary cut for <title>/og:title; the H1 keeps the full title.
    const shortTitle = shortPostTitle(post.title);
    const metadata = buildMetadata({
        path: `/blog/${post.slug}`,
        image: `/blog/${post.slug}/opengraph-image`,
        title: shortTitle ?? post.title,
        ogTitle: shortTitle,
        description: metaDescription(post.excerpt),
        keywords: post.tags,
        ogType: "article",
        publishedTime: new Date(post.publishedAt).toISOString(),
        modifiedTime: new Date(post.updatedAt || post.publishedAt).toISOString(),
        authors: [SITE.name],
        tags: post.tags,
    });
    // The cut title keeps the layout's " | Raish Momin" suffix when both fit in 60 chars;
    // otherwise `absolute` drops the suffix.
    const keepBrand = !shortTitle || `${shortTitle} | ${SITE.name}`.length <= SEO_TITLE_MAX;
    return keepBrand ? metadata : { ...metadata, title: { absolute: shortTitle } };
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
            keywords: post.tags?.join(", "),
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
            <main id="main" tabIndex={-1} className="relative outline-none">
                <article>
                    <Container className="pb-12 pt-28 md:pb-16 md:pt-36">
                        <Crumbs
                            items={[
                                { name: "Home", href: "/" },
                                { name: "Blog", href: "/blog" },
                                { name: title },
                            ]}
                        />
                        <header className="mt-10 max-w-4xl md:mt-14">
                            <Kicker>
                                <time dateTime={published}>{shortDate(post.publishedAt)}</time>
                                <span aria-hidden="true"> · </span>
                                <span className="sr-only">, </span>
                                {post.readTime} min read
                            </Kicker>
                            <h1 className="mt-4 text-[clamp(2rem,4.2vw,3.25rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-foreground">
                                {title}
                            </h1>
                            <p className="mt-6 max-w-[68ch] text-lg leading-8 text-muted-foreground">
                                {excerpt}
                            </p>
                            {post.tags?.length ? (
                                <ul aria-label="Tags" className="mt-6 flex flex-wrap gap-1.5">
                                    {post.tags.map((tag) => (
                                        <li
                                            key={tag}
                                            className="inline-flex items-center rounded-full border border-border px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground"
                                        >
                                            {cleanTag(tag)}
                                        </li>
                                    ))}
                                </ul>
                            ) : null}
                        </header>
                    </Container>

                    <div className="border-t border-border">
                        <Container
                            className={
                                showToc
                                    ? "grid gap-10 py-12 text-[18px] md:py-16 lg:grid-cols-[minmax(0,68ch)_minmax(0,1fr)] lg:gap-16 xl:gap-24"
                                    : "py-12 md:py-16"
                            }
                        >
                            {/* Table of contents: a block above the post on mobile, a sticky rail on desktop */}
                            {showToc && (
                                <div className="lg:col-start-2 lg:row-start-1">
                                    <TableOfContents
                                        items={toc}
                                        className="rounded-lg border border-border bg-card p-5 lg:sticky lg:max-w-xs lg:top-28 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0"
                                    />
                                </div>
                            )}

                            <div className="min-w-0 lg:col-start-1 lg:row-start-1">
                                <BlogProse html={html} />

                                <div className="max-w-[68ch]">
                                    <AuthorBio />
                                    <RelatedPosts currentSlug={post.slug} tags={post.tags || []} />
                                    <div className="mt-16 border-t border-border pt-8">
                                        <ButtonLink href="/blog" variant="ghost">
                                            <span aria-hidden="true">←</span>
                                            All posts
                                        </ButtonLink>
                                    </div>
                                </div>
                            </div>
                        </Container>
                    </div>
                </article>
            </main>
            <Footer />
        </>
    );
}

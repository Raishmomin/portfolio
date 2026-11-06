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
    postTags,
    postTitle,
    shortPostTitle,
} from "@/lib/blog";
import { renderMarkdown } from "@/lib/markdown";
import clientPromise from "@/lib/mongodb";
import type { BlogPost } from "@/lib/blog-types";
import { ButtonLink, Container, Kicker } from "../../../components/ui/primitives";
import { Crumbs } from "../../../components/pages/ui";
import { pageNeuralData } from "../../../components/pages/neural";
import { NeuralStage } from "../../../components/neural";
import { BlogProse } from "../../../components/pages/blog/prose";
import { cleanTag } from "../../../components/pages/blog/post-list";
import { shortDate } from "@/lib/derive";

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

export default async function BlogPostPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const [post, neural] = await Promise.all([getPost(slug), pageNeuralData()]);
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
            <main id="main" tabIndex={-1} className="relative outline-none">
                <NeuralStage data={neural} />
                <article>
                    {/* "band" composition: the ambient scene owns the top of the viewport, the
                        header sits below it on a panel (the h1 is plain text, never animated). */}
                    <section
                        data-section="intro"
                        data-scene="ambient"
                        data-stage="band"
                        aria-labelledby="post-title"
                        className="relative pb-12 pt-[22svh] md:pb-16 lg:pt-[30vh]"
                    >
                        <Container>
                            <header className="panel max-w-4xl p-6 md:p-10">
                                <Crumbs
                                    items={[
                                        { name: "Home", href: "/" },
                                        { name: "Blog", href: "/blog" },
                                        { name: title },
                                    ]}
                                />
                                <Kicker className="mt-8">
                                    <time dateTime={published}>{shortDate(post.publishedAt)}</time>
                                    <span aria-hidden="true"> · </span>
                                    <span className="sr-only">, </span>
                                    {post.readTime} min read
                                </Kicker>
                                <h1
                                    id="post-title"
                                    className="mt-4 text-balance text-[clamp(2rem,4.2vw,3.25rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-foreground"
                                >
                                    {title}
                                </h1>
                                <p className="mt-6 max-w-[34em] text-lg leading-8 text-muted-foreground">
                                    {excerpt}
                                </p>
                                {tags.length ? (
                                    <ul aria-label="Tags" className="mt-6 flex flex-wrap gap-1.5">
                                        {tags.map((tag) => (
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
                    </section>

                    {/* The article body is calm: an opaque surface over the stage. */}
                    <div className="relative border-t border-border bg-background">
                        {/* text-[18px] on the grid, so every 34em measure in it (prose and the blocks
                            under it, about 68 characters per line) resolves at the 18px body size. */}
                        <Container className="grid gap-10 py-12 text-[18px] md:py-16 lg:grid-cols-[minmax(0,34em)_minmax(0,1fr)] lg:gap-16 xl:gap-24">
                            {/* Right rail: the table of contents (a block above the post on mobile, sticky
                                on desktop). */}
                            {showToc ? (
                                <div className="lg:col-start-2 lg:row-start-1">
                                    <TableOfContents
                                        items={toc}
                                        className="rounded-lg border border-border bg-card p-5 lg:sticky lg:max-w-xs lg:top-28 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0"
                                    />
                                </div>
                            ) : null}

                            <div className="relative min-w-0 lg:col-start-1 lg:row-start-1">
                                {/* Reading line: draws down the left edge as you read (desktop). */}
                                <svg
                                    aria-hidden="true"
                                    data-draw=""
                                    viewBox="0 0 2 100"
                                    preserveAspectRatio="none"
                                    className="absolute -left-8 top-1 hidden h-[calc(100%-0.5rem)] w-[2px] text-primary/50 xl:block"
                                >
                                    <line x1="1" y1="0" x2="1" y2="100" stroke="currentColor" strokeWidth="2" />
                                </svg>
                                <BlogProse html={html} />

                                <div className="max-w-[34em]">
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

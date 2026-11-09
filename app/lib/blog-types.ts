export type BlogPost = {
    _id?: string;
    title: string;
    slug: string;
    excerpt: string;
    content: string;
    tags: string[];
    readTime: number;
    publishedAt: Date;
    updatedAt?: Date;
    published?: boolean;
    generatedBy: string;
};

/** A post as listings load it (see POST_SUMMARY_PROJECTION). */
export type BlogPostSummary = Pick<
    BlogPost,
    "_id" | "title" | "slug" | "excerpt" | "tags" | "publishedAt" | "updatedAt" | "readTime"
>;

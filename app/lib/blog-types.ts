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

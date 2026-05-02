const { MongoClient } = require('mongodb');

/** @type {import('next-sitemap').IConfig} */
module.exports = {
    siteUrl: 'https://raish-portfolio.vercel.app',
    generateRobotsTxt: true,
    outDir: './public',
    additionalPaths: async (config) => {
        const result = [];
        try {
            const client = new MongoClient(process.env.MONGODB_URI);
            await client.connect();
            const db = client.db("Portfolio");
            const posts = await db.collection("blogs").find({}, { projection: { slug: 1, publishedAt: 1 } }).toArray();

            posts.forEach(post => {
                result.push({
                    loc: `/blog/${post.slug}`,
                    lastmod: new Date(post.publishedAt).toISOString(),
                    changefreq: 'monthly',
                    priority: 0.7,
                });
            });
            await client.close();
        } catch (error) {
            console.error('next-sitemap: Error fetching blogs', error);
        }
        return result;
    }
};
